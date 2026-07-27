"""Pier (DeepSWE) adapter for Kiro CLI.

DeepSWE task sandboxes run with network_mode no-network, so this adapter
declares the kiro-cli inference/auth hosts via network_allowlist() and
installs from an uploaded host binary (no download needed). DeepSWE grades
the git diff of /app, so run() ends with a commit safeguard in case the agent
leaves work uncommitted.

Usage:
    PYTHONPATH=$PWD pier run -d deep-swe@1.0 \
        --agent-import-path adapters.kiro_cli.pier_agent:PierKiroCliAgent \
        -m claude-sonnet-4.6 -i <task-name> -n 1
"""

from pier.agents.installed.base import BaseInstalledAgent, with_prompt_template
from pier.environments.base import BaseEnvironment
from pier.models.agent.context import AgentContext
from pier.models.agent.install import AgentInstallSpec, InstallStep
from pier.models.agent.network import NetworkAllowlist

from .kiro_common import (
    CONTAINER_STAGING_DIR,
    LOG_FILENAME,
    build_chat_command,
    ca_certificates_command,
    host_auth_files,
    host_ca_bundle,
    host_kiro_binaries,
    kiro_region,
    parse_telemetry,
    resolve_model,
)

# Hosts kiro-cli needs at run time (inference, OIDC token refresh, telemetry).
# The binary itself is uploaded from the host, so no install host is required.
def _kiro_hosts(region: str) -> list[str]:
    return [
        f"codewhisperer.{region}.amazonaws.com",
        f"oidc.{region}.amazonaws.com",
        f"client-telemetry.{region}.amazonaws.com",
        f"management.{region}.kiro.dev",
        f"prod.{region}.auth.desktop.kiro.dev",
    ]


class PierKiroCliAgent(BaseInstalledAgent):
    """Runs kiro-cli headless inside DeepSWE task containers."""

    @staticmethod
    def name() -> str:
        return "kiro-cli"

    def get_version_command(self) -> str | None:
        return 'export PATH="$HOME/.local/bin:$PATH"; kiro-cli --version'

    def network_allowlist(self) -> NetworkAllowlist:
        return NetworkAllowlist(domains=_kiro_hosts(kiro_region()))

    async def setup(self, environment: BaseEnvironment) -> None:
        # NOTE: pier inlines install_spec() into the image BUILD, where host
        # uploads do not exist yet. The binary/auth upload therefore happens
        # live at the start of run(); only build-safe steps go in install_spec.
        await super().setup(environment)

    def install_spec(self) -> AgentInstallSpec:
        staging = CONTAINER_STAGING_DIR.as_posix()
        return AgentInstallSpec(
            agent_name=self.name(),
            version=self._version,
            steps=[
                InstallStep(
                    user="root",
                    env={"DEBIAN_FRONTEND": "noninteractive"},
                    run=ca_certificates_command(staging),
                ),
            ],
            verification_command=self.get_version_command(),
        )

    async def _stage_and_install(self, environment: BaseEnvironment) -> None:
        """Upload host binaries + login state into the live container."""
        binaries = host_kiro_binaries()
        data_sqlite, sso_dir = host_auth_files()
        ca_bundle = host_ca_bundle()
        for path in [*binaries, data_sqlite, sso_dir, ca_bundle]:
            if not path.exists():
                raise RuntimeError(f"kiro-cli host file missing: {path}")

        staging = CONTAINER_STAGING_DIR.as_posix()
        await self.exec_as_root(
            environment, f"rm -rf {staging} && mkdir -p {staging} && chmod 755 {staging}"
        )
        for binary in binaries:
            await environment.upload_file(binary, f"{staging}/{binary.name}")
        await environment.upload_file(data_sqlite, f"{staging}/data.sqlite3")
        await environment.upload_file(ca_bundle, f"{staging}/ca-certificates.crt")
        await environment.upload_dir(sso_dir, f"{staging}/sso")
        if environment.default_user is not None:
            await self.exec_as_root(
                environment, f"chown -R {environment.default_user} {staging}"
            )
        else:
            await self.exec_as_root(environment, f"chmod -R a+rX {staging}")

        await self.exec_as_agent(
            environment,
            command=(
                "set -euo pipefail; "
                "mkdir -p ~/.local/bin ~/.local/share/kiro-cli ~/.aws && "
                f"cp {staging}/kiro-cli {staging}/kiro-cli-chat ~/.local/bin/ && "
                "chmod +x ~/.local/bin/kiro-cli ~/.local/bin/kiro-cli-chat && "
                f"cp {staging}/data.sqlite3 ~/.local/share/kiro-cli/data.sqlite3 && "
                "chmod 600 ~/.local/share/kiro-cli/data.sqlite3 && "
                f"rm -rf ~/.aws/sso && cp -r {staging}/sso ~/.aws/sso && "
                "chmod 600 ~/.aws/sso/*"
            ),
        )
        await self.exec_as_root(environment, f"rm -rf {staging}")

        # Fail fast if the uploaded login state does not work in-container.
        await self.exec_as_agent(
            environment,
            command=(
                'export PATH="$HOME/.local/bin:$PATH"; '
                "kiro-cli --version && kiro-cli whoami"
            ),
        )

    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        model = resolve_model(self.model_name)
        await self._stage_and_install(environment)
        try:
            await self.exec_as_agent(
                environment,
                command=build_chat_command(model, instruction),
            )
        finally:
            # DeepSWE grades the git diff of /app; commit anything the agent
            # left uncommitted so the work is not lost to the verifier.
            try:
                await self.exec_as_agent(
                    environment,
                    command=(
                        "if [ -d /app/.git ]; then cd /app && git add -A && "
                        "(git diff --cached --quiet || "
                        "git -c user.name='Kiro CLI' "
                        "-c user.email='kiro-cli@benchmark.local' "
                        "commit -qm 'kiro-cli: commit uncommitted changes'); fi"
                    ),
                )
            except Exception:
                self.logger.debug("Post-run git commit safeguard failed", exc_info=True)

    def populate_context_post_run(self, context: AgentContext) -> None:
        log_path = self.logs_dir / LOG_FILENAME
        if not log_path.exists():
            return
        telemetry = parse_telemetry(log_path.read_text(errors="replace"))
        context.cost_usd = telemetry["cost_usd"]
        context.metadata = {
            "kiro_credits": telemetry["credits"],
            "kiro_time_seconds": telemetry["time_seconds"],
            "kiro_model": resolve_model(self.model_name),
        }
