# Kiro account usage

`scripts/kiro_account_usage.py` reads Kiro API keys from a file and reports
the associated account and subscription credit usage.

## Requirements

- Python 3 (standard library only)

Usage is fetched directly from the Kiro/CodeWhisperer control plane via the
`GetUsageLimits` API -- the same call the CLI's `/usage` command makes -- so no
`kiro-cli` process is spawned and no AI prompt is sent or credit consumed.

The API keys must be created in the Kiro web application's **API Keys**
section. They normally begin with `ksk_` and require an eligible paid Kiro
subscription.

## Input

Create a local file containing one key per line. Blank lines and comments are
ignored:

```text
# Benchmark accounts
ksk_first_key
ksk_second_key
```

Files named `kiro-pats*.txt` are ignored by Git in this repository. Keep the
file readable only by your user:

```bash
chmod 600 kiro-pats.txt
```

## Run

```bash
python3 scripts/kiro_account_usage.py kiro-pats.txt
python3 scripts/kiro_account_usage.py --json kiro-pats.txt
```

The script masks all keys in its output and queries keys concurrently. Each
key is sent as `Authorization: Bearer <key>` with `tokentype: API_KEY`; the
first region to answer wins.

The service reports total credits used and overage credits separately. For a
plan with a 10000 credit allowance, `currentUsageWithPrecision` of `12876.51`
with `currentOverages` of `2876.51` means 12876.51 total credits and 2876.51
overage credits. The script reports these as `TOTAL USED` and `OVERAGE`.

## Environment

- `KIRO_TIMEOUT` -- seconds to wait for each API call (default: 30). Increase
  on a slow network:

  ```bash
  KIRO_TIMEOUT=60 python3 scripts/kiro_account_usage.py kiro-pats.txt
  ```

- `KIRO_REGIONS` -- space-separated regions to try, first hit wins
  (default: `us-east-1 eu-central-1`).
- `KIRO_WORKERS` -- max concurrent requests (default: `min(keys, 8)`); also
  settable with `--workers N`.
