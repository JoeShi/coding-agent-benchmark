"""Shared helpers for the Kiro CLI benchmark adapters.

kiro-cli ships as a single (dynamically linked, glibc) binary on the host at
``~/.local/bin/kiro-cli``. Two authentication modes are supported:

1. **API key (preferred for CI/benchmarks).** Set ``KIRO_API_KEY`` on the
   host (keys are created at app.kiro.dev, Pro tier or above); the adapters
   inject it into the container environment and skip auth-file staging.
2. **Uploaded login state.** Copying ``~/.local/share/kiro-cli/data.sqlite3``
   and ``~/.aws/sso/`` into any ``$HOME`` preserves an interactive session,
   and short-lived OIDC tokens auto-refresh. The adapters upload these from
   the host at run time when no API key is set.

Per kiro.dev/docs/cli/authentication, an active browser session takes
precedence over ``KIRO_API_KEY``, so the API-key path deliberately does NOT
stage sqlite login state into the container. No credentials are stored in
this repo either way.

Telemetry: kiro-cli does not expose token counts. Each headless run prints a
trailing ``Credits: X.XX • Time: Ys`` line; credits are the cost unit and are
converted to USD at the published overage rate.
"""

import os
import re
import shlex
from pathlib import Path, PurePosixPath

# Published overage rate per Kiro Credit (see docs/methodology.md).
CREDIT_USD_RATE = 0.04

DEFAULT_MODEL = "auto"
DEFAULT_REGION = "us-east-1"

# Staging directory inside the task container for uploaded binary/auth state.
CONTAINER_STAGING_DIR = PurePosixPath("/tmp/kiro-cli-install")

# Path (inside the container) of the teed agent log; the harness downloads
# /logs/agent into the agent's logs_dir after the run.
CONTAINER_LOG_PATH = "/logs/agent/kiro-cli.txt"
LOG_FILENAME = "kiro-cli.txt"

_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
_CREDITS_RE = re.compile(r"Credits:\s*([0-9]+(?:\.[0-9]+)?)")
# Matches "Time: 83s", "Time: 14m 10s", "Time: 1h 2m 3s" (capture groups: h, m, s).
_TIME_RE = re.compile(
    r"Time:\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+(?:\.\d+)?)s"
)


def _parse_times(text: str) -> list[float]:
    times = []
    for hours, minutes, seconds in _TIME_RE.findall(text):
        total = float(seconds)
        if minutes:
            total += int(minutes) * 60
        if hours:
            total += int(hours) * 3600
        times.append(total)
    return times

# Kiro-cli-specific failure signatures, as (regex, label). The harbor adapter
# maps labels onto harbor's Api* error taxonomy; base-class patterns already
# cover the generic cases ("rate limit", "API Error", "Not logged in", ...).
KIRO_ERROR_REGEXES: list[tuple[str, str]] = [
    (r"ThrottlingException|[Tt]hrottled", "rate_limit"),
    (r"[Rr]ate limit reached|[Rr]equest quota exceeded|quota exceeded",
     "rate_limit"),
    (r"usage (limit|quota)|monthly (credit )?limit|credits? (exhausted|depleted)",
     "usage_limit"),
    (r"[Pp]lease (log ?in|authenticate)|[Ll]ogin required|[Uu]nauthorized|"
     r"invalid or expired token", "auth"),
]


def host_kiro_binaries() -> list[Path]:
    """kiro-cli binaries on the host to upload into containers.

    ``kiro-cli`` is a thin launcher that execs ``kiro-cli-chat`` (the real
    binary) from the same directory, so both must be uploaded.
    """
    bindir = Path(
        os.environ.get("KIRO_CLI_BINARY_DIR", Path.home() / ".local/bin")
    )
    return [bindir / "kiro-cli", bindir / "kiro-cli-chat"]


def host_musl_binaries() -> list[Path]:
    """Optional musl-linked kiro-cli pair, for task images with glibc < 2.34.

    The glibc binary hard-requires GLIBC_2.34; older images (e.g. some qemu
    tasks) need kiro's musl build. Present when the host has the pair under
    ``KIRO_CLI_MUSL_BINARY_DIR`` (default ``~/.local/bin-musl``).
    """
    bindir = Path(
        os.environ.get("KIRO_CLI_MUSL_BINARY_DIR", Path.home() / ".local/bin-musl")
    )
    return [bindir / "kiro-cli", bindir / "kiro-cli-chat"]


def musl_fallback_command(staging_dir: str) -> str:
    """Shell snippet swapping in the staged musl pair if the glibc one can't run."""
    return (
        'if ! PATH="$HOME/.local/bin:$PATH" kiro-cli --version >/dev/null 2>&1; then '
        f"cp {staging_dir}/kiro-cli-musl ~/.local/bin/kiro-cli && "
        f"cp {staging_dir}/kiro-cli-chat-musl ~/.local/bin/kiro-cli-chat && "
        "chmod +x ~/.local/bin/kiro-cli ~/.local/bin/kiro-cli-chat; "
        "fi"
    )


def host_ca_bundle() -> Path:
    """Host CA bundle, used as fallback for images without ca-certificates.

    ``resolve()`` because the default path is a symlink on some distros
    (e.g. AL2023) and ``docker cp`` refuses symlinked upload sources.
    """
    return Path(
        os.environ.get("KIRO_CLI_CA_BUNDLE", "/etc/ssl/certs/ca-certificates.crt")
    ).resolve()


def host_auth_home() -> Path:
    """Host $HOME whose kiro-cli login state is uploaded into containers."""
    return Path(os.environ.get("KIRO_CLI_AUTH_HOME", Path.home()))


def host_auth_files() -> tuple[Path, Path]:
    """(data.sqlite3, sso_dir) that together carry the kiro-cli login."""
    home = host_auth_home()
    return (
        home / ".local/share/kiro-cli/data.sqlite3",
        home / ".aws/sso",
    )


def host_api_key() -> str | None:
    """Kiro API key (``KIRO_API_KEY`` on the host), or None if unset.

    When set, adapters authenticate containers by injecting the key into the
    container environment instead of uploading login state.
    """
    return os.environ.get("KIRO_API_KEY") or None


def auth_env() -> dict[str, str]:
    """Container env vars needed for authentication (empty in file-auth mode)."""
    key = host_api_key()
    return {"KIRO_API_KEY": key} if key else {}


def kiro_region() -> str:
    return os.environ.get("KIRO_CLI_REGION", DEFAULT_REGION)


def resolve_model(model_name: str | None) -> str:
    """Map a harness model name to a kiro-cli model id.

    Accepts bare ids (``claude-sonnet-4.6``) and provider-prefixed names
    (``kiro/claude-sonnet-4.6``); defaults to ``auto``.
    """
    if not model_name:
        return DEFAULT_MODEL
    return model_name.split("/")[-1]


def strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def parse_telemetry(text: str) -> dict:
    """Extract credits/wall-time from kiro-cli output.

    Returns ``{"credits": float|None, "time_seconds": float|None,
    "cost_usd": float|None}``. Credits are summed across all ``Credits:``
    lines (one per assistant turn); time is the last reported value.
    """
    clean = strip_ansi(text)
    credits = [float(m) for m in _CREDITS_RE.findall(clean)]
    times = _parse_times(clean)
    total_credits = sum(credits) if credits else None
    return {
        "credits": total_credits,
        "time_seconds": times[-1] if times else None,
        "cost_usd": (
            round(total_credits * CREDIT_USD_RATE, 6)
            if total_credits is not None
            else None
        ),
    }


def build_chat_command(model: str, instruction: str) -> str:
    """Shell command running one headless kiro-cli session, teeing output.

    Invokes kiro-cli-chat (the real binary) directly, NOT the kiro-cli
    launcher: kiro-cli 2.15.x re-splits argv when forwarding to kiro-cli-chat,
    so a multi-line instruction containing bullet lines starting with "- "
    dies in clap argument parsing ("unexpected argument '- ' found") before
    the session even starts. kiro-cli-chat parses the same prompt fine.
    """
    return (
        'export PATH="$HOME/.local/bin:$PATH"; '
        f"kiro-cli-chat chat --no-interactive --trust-all-tools "
        f"--model {shlex.quote(model)} {shlex.quote(instruction)} "
        f"2>&1 </dev/null | "
        # stdbuf (coreutils) is absent in some minimal task images (e.g. the
        # SWE-Atlas QnA repos); without it the whole pipeline fails instantly
        # and the agent never starts. Fall back to plain tee there.
        f"if command -v stdbuf >/dev/null 2>&1; then stdbuf -oL tee {CONTAINER_LOG_PATH}; "
        f"else tee {CONTAINER_LOG_PATH}; fi"
    )


def ca_certificates_command(staging_dir: str) -> str:
    """Root shell command ensuring system CA roots for kiro-cli's TLS.

    Prefers the image's package manager; falls back to the host CA bundle
    staged at ``staging_dir`` (works without network during install).
    """
    return (
        "if command -v apk &> /dev/null; then"
        "  apk add --no-cache ca-certificates;"
        " elif command -v apt-get &> /dev/null; then"
        "  apt-get update && apt-get install -y ca-certificates;"
        " elif command -v dnf &> /dev/null; then"
        "  dnf install -y ca-certificates;"
        " elif command -v yum &> /dev/null; then"
        "  yum install -y ca-certificates;"
        " else"
        "  exit 1;"
        " fi"
        " || { mkdir -p /etc/ssl/certs && "
        f"cp {staging_dir}/ca-certificates.crt "
        "  /etc/ssl/certs/ca-certificates.crt; }"
    )
