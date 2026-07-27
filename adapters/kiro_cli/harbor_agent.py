"""Harbor (Terminal-Bench 2.0) adapter for Kiro CLI.

Usage:
    PYTHONPATH=$PWD harbor run -d terminal-bench@2.0 \
        --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
        -m claude-sonnet-4.6 -i <task-name> -n 1
"""

from harbor.agents.installed.base import (
    AgentAuthenticationError,
    ApiRateLimitError,
    ApiUsageLimitError,
    BaseInstalledAgent,
    ErrorPattern,
    with_prompt_template,
)
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from .kiro_common import (
    CONTAINER_STAGING_DIR,
    KIRO_ERROR_REGEXES,
    LOG_FILENAME,
    build_chat_command,
    ca_certificates_command,
    host_auth_files,
    host_ca_bundle,
    host_kiro_binaries,
    parse_telemetry,
    resolve_model,
)

_LABEL_TO_ERROR = {
    "rate_limit": ApiRateLimitError,
    "usage_limit": ApiUsageLimitError,
    "auth": AgentAuthenticationError,
}


class KiroCliAgent(BaseInstalledAgent):
    """Runs kiro-cli headless inside the task container.

    install() uploads the host's kiro-cli binary and login state
    (data.sqlite3 + ~/.aws/sso) into the agent user's $HOME; run() executes
    the instruction via `kiro-cli chat --no-interactive --trust-all-tools`.
    """

    ERROR_PATTERNS = BaseInstalledAgent.ERROR_PATTERNS + [
        ErrorPattern(pattern, _LABEL_TO_ERROR[label])
        for pattern, label in KIRO_ERROR_REGEXES
    ]

    @staticmethod
    def name() -> str:
        return "kiro-cli"

    def get_version_command(self) -> str | None:
        return 'export PATH="$HOME/.local/bin:$PATH"; kiro-cli --version'

    async def install(self, environment: BaseEnvironment) -> None:
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
        # Uploads land root-owned with host perms; hand them to the agent user.
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

        # kiro-cli needs system CA roots for TLS; some task images lack them.
        # Prefer the package manager, fall back to the staged host CA bundle.
        await self.exec_as_root(
            environment,
            command=ca_certificates_command(staging),
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )
        await self.exec_as_agent(
            environment,
            command=(
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
        await self.exec_as_agent(
            environment,
            command=build_chat_command(model, instruction),
        )

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
