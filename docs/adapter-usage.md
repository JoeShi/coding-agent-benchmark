# Kiro CLI Adapter Usage

The adapter in `adapters/kiro_cli/` runs [Kiro CLI](https://kiro.dev) headless
inside benchmark task containers:

- `harbor_agent.py` — `KiroCliAgent` for Harbor (Terminal-Bench 2.0)
- `pier_agent.py` — `PierKiroCliAgent` for Pier (DeepSWE, air-gapped tasks)
- `kiro_common.py` — shared invocation/auth/telemetry logic

## Prerequisites

- `kiro-cli` installed on the host (`~/.local/bin/kiro-cli`); authentication
  via `KIRO_API_KEY` or a host login (`kiro-cli whoami` works).
- Docker with the Compose plugin (`docker compose version`), and the current
  user in the `docker` group (prefix commands with `sg docker -c '...'` in
  non-login shells).
- Harnesses: `uv tool install harbor` and `uv tool install datacurve-pier`.
- Run harness commands from the repo root with `PYTHONPATH=$PWD` so the
  adapter module is importable.

## Auth flow

No credentials are stored in this repo. On each trial the adapter uploads
`~/.local/bin/kiro-cli` **and** `~/.local/bin/kiro-cli-chat` → `~/.local/bin/`
in the container (`kiro-cli` is a thin launcher that execs `kiro-cli-chat`, so
both are needed; ~800 MB total, uploaded via `docker cp` — no download inside
the sandbox). Authentication has two modes, selected automatically:

**API key (preferred for CI/benchmarks).** Set `KIRO_API_KEY` on the host
(keys are created at [app.kiro.dev](https://app.kiro.dev) → API Keys;
requires a Pro/Pro+/Pro Max/Power subscription). The adapter injects it into
the container environment (`KIRO_API_KEY`) and skips auth-file staging. Note:
an active browser session takes precedence over the key
([docs](https://kiro.dev/docs/cli/authentication/)), so the key path
deliberately does not stage sqlite login state into the container.

**Uploaded login state (fallback).** When `KIRO_API_KEY` is unset, on each
trial the adapter uploads, from the host at run time:

- `~/.local/share/kiro-cli/data.sqlite3` → same path in the container
- `~/.aws/sso/` → `~/.aws/sso/` in the container

kiro-cli login state is portable across `$HOME`s and OIDC tokens auto-refresh,
so this preserves the host login inside the container.

Both agents verify auth with `kiro-cli whoami` and **fail fast** on error.

kiro-cli also needs system CA roots for TLS (it panics with "No CA
certificates were loaded from the system" otherwise). The harbor agent
installs `ca-certificates` via the image's package manager; the pier agent
does the same and falls back to a host CA bundle uploaded to
`/etc/ssl/certs/ca-certificates.crt` (works even if the install phase has no
network).

Overrides (environment variables on the host):

| Variable | Default | Purpose |
|---|---|---|
| `KIRO_API_KEY` | _(unset)_ | Kiro API key; when set, selects API-key auth |
| `KIRO_CLI_BINARY_DIR` | `~/.local/bin` | Dir holding `kiro-cli` + `kiro-cli-chat` |
| `KIRO_CLI_AUTH_HOME` | `$HOME` | Home dir to read auth state from (file-auth mode) |
| `KIRO_CLI_REGION` | `us-east-1` | Region for the pier network allowlist |
| `KIRO_CLI_CA_BUNDLE` | `/etc/ssl/certs/ca-certificates.crt` | CA bundle fallback (pier) |

## Terminal-Bench 2.0 (harbor)

```bash
cd <repo root>
sg docker -c "PYTHONPATH=$PWD harbor run -d terminal-bench@2.0 \
  --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
  -m claude-sonnet-4.6 \
  -i adaptive-rejection-sampler -n 1"
```

- `-m` accepts bare kiro-cli model ids (`auto`, `claude-opus-5`,
  `claude-sonnet-5`, `claude-opus-4.8`, `claude-sonnet-4.6`, `gpt-5.6-sol`)
  or provider-prefixed forms (`kiro/claude-sonnet-4.6`). Default: `auto`.
- Agent output is teed to `kiro-cli.txt` in the trial's agent logs.
- kiro-cli failures are classified into harbor's error taxonomy
  (`ApiRateLimitError`, `ApiUsageLimitError`, `AgentAuthenticationError`,
  ...) so `--max-retries 3 --retry-include ApiRateLimitError` works.

## DeepSWE (pier)

```bash
cd <repo root>
sg docker -c "PYTHONPATH=$PWD pier run -p <path-to>/deep-swe/tasks \
  --agent-import-path adapters.kiro_cli.pier_agent:PierKiroCliAgent \
  -m claude-sonnet-4.6 \
  --n-tasks 10 --sample-seed 0"
```

DeepSWE task sandboxes run with `network_mode = no-network`; the pier agent
declares a `network_allowlist()` covering only the hosts kiro-cli needs:

- `codewhisperer.<region>.amazonaws.com` (inference API)
- `oidc.<region>.amazonaws.com` (OIDC token refresh)
- `client-telemetry.<region>.amazonaws.com`
- `management.<region>.kiro.dev`,
  `prod.<region>.auth.desktop.kiro.dev`

No install host is needed because the binary is uploaded from the host.
DeepSWE grades the git diff of `/app`; after each run the adapter commits any
uncommitted changes there (`git add -A && git commit`) as a safeguard.

## SWE-Atlas-QnA (harbor)

[SWE-Atlas](https://github.com/scaleapi/SWE-Atlas)'s QnA subset (124 tasks)
runs on **harbor** too — the official harness — so the same `KiroCliAgent`
adapter is used; no separate adapter is needed. The dataset is in the harbor
hub registry as `scale-ai/swe-atlas-qna`:

```bash
cd <repo root>
sg docker -c "PYTHONPATH=$PWD harbor run -d scale-ai/swe-atlas-qna \
  --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
  -m claude-sonnet-4.6 \
  -i <task-id> -n 1"
```

Differences from Terminal-Bench runs:

- **Judge credentials (hard dependency).** The verifier is an LLM judge
  (rubric-based, binary pass/fail). The host must provide `OPENAI_API_KEY`
  and `OPENAI_API_BASE` (any OpenAI-compatible endpoint; official judge model
  is `anthropic/claude-opus-4-5-20251101`, overridable via `EVAL_MODEL`).
  Without them every task scores 0.
- **Task shape**: the agent answers a question about a repo checked out at
  `/app` and writes `/logs/agent/answer.txt`; it must not modify the repo.
- **Timeouts**: agent 3 h, verifier 15 min (declared per task in
  `task.toml`) — much longer than TB2/DeepSWE tasks.
- **Network**: the official config restricts the agent to one allowlisted
  host; we run without that restriction since kiro-cli needs several
  endpoints (see `docs/methodology.md` deviation 6).
- Official harness version pin: harbor **v0.18.0** — check the installed
  harbor version if dataset resolution fails.

## Cost / telemetry capture

kiro-cli does not expose token counts. Each headless run ends with a
`Credits: X.XX • Time: Ys` line, which the adapter parses from the teed log
(`populate_context_post_run`):

- `context.cost_usd = credits × $0.04` (published overage rate)
- `context.metadata = {kiro_credits, kiro_time_seconds, kiro_model}`

These flow into the harbor/pier `result.json` per trial.

## Known limitations

- **Chat runs invoke `kiro-cli-chat` directly** (not the `kiro-cli` launcher):
  kiro-cli 2.15.x re-splits argv when forwarding to kiro-cli-chat, which
  kills any run whose instruction contains bullet lines starting with `- `
  ("unexpected argument '- ' found" before the session starts). Both binaries
  are still staged; only `--version`/`whoami` use the launcher.
- **The tee pipeline degrades without `stdbuf`.** Some minimal task images
  (e.g. SWE-Atlas QnA repos) lack coreutils; `build_chat_command` probes
  `command -v stdbuf` and falls back to plain `tee` — do not reintroduce an
  unconditional `stdbuf -oL tee`, it kills the agent before it starts.
- The uploaded glibc binary requires GLIBC 2.34 in the task image. For older
  images (e.g. some qemu tasks) the adapters fall back to kiro's musl build,
  expected on the host at `~/.local/bin-musl` (override
  `KIRO_CLI_MUSL_BINARY_DIR`); without it those tasks fail at install-time
  `whoami` with `GLIBC_2.34 not found`.
- Token-level metrics (input/output/cache) are unavailable from kiro-cli —
  see `docs/methodology.md` deviation 1.
- kiro-cli API streams can **hang silently** (no client-side timeout): an
  agent whose `kiro-cli.txt` stops growing for >45 min mid-run is dead —
  kill it and let the trial retry; the harness agent timeout is the only
  built-in backstop.
