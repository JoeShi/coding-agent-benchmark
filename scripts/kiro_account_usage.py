#!/usr/bin/env python3
"""Report Kiro account credit usage for a list of API keys.

Usage:
    python3 scripts/kiro_account_usage.py [--json] [--workers N] <pat-file>

Reads one Kiro API key (ksk_...) per line and reports its account and
subscription credit usage. Blank lines and lines beginning with '#' are
ignored.

Usage is fetched directly from the Kiro/CodeWhisperer control plane via the
GetUsageLimits API -- the same call the CLI's `/usage` command makes -- so no
kiro-cli process is spawned. Standard library only, no dependencies.

Environment:
    KIRO_TIMEOUT   Seconds to wait for each API call (default: 30)
    KIRO_REGIONS   Space-separated regions to try, first hit wins
                   (default: "us-east-1 eu-central-1")
    KIRO_WORKERS   Max concurrent requests (default: min(keys, 8))
"""

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# aws-sdk-rust-style UA; the service edge rejects unrecognized agents with 403.
API_UA = (
    "aws-sdk-rust/1.3.10 ua/2.1 api/codewhispererruntime os/cli lang/rust "
    "app/AmazonQ-For-CLI"
)
TARGET = "AmazonCodeWhispererService.GetUsageLimits"
BODY = b'{"isEmailRequired":true}'

FIELDS = [
    "key", "email", "accountType", "plan", "creditsUsed", "planAllowance",
    "nextReset", "overages", "overageCredits", "estimatedCost", "status",
]


def mask_key(key):
    if len(key) <= 12:
        return f"{key[:4]}***"
    return f"{key[:8]}...{key[-4:]}"


def get_usage(key, regions, timeout):
    """Call GetUsageLimits, trying each region. Returns (data, error).

    A definitive answer from the service (an HTTP error with a body) is
    reported in preference to a transient network error from a later region,
    so an invalid key surfaces "token is invalid" rather than a fallback
    region's timeout.
    """
    http_err = None
    net_err = None
    for region in regions:
        url = (
            f"https://codewhisperer.{region}.amazonaws.com/"
            "?isEmailRequired=true"
        )
        req = Request(
            url,
            data=BODY,
            method="POST",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/x-amz-json-1.0",
                "X-Amz-Target": TARGET,
                "tokentype": "API_KEY",
                "User-Agent": API_UA,
                "x-amz-user-agent": API_UA,
            },
        )
        try:
            with urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8")), None
        except HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(body)
                msg = parsed.get("message") or parsed.get("__type")
            except ValueError:
                msg = None
            if http_err is None:
                http_err = msg or f"HTTP {exc.code}"
        except URLError as exc:
            if net_err is None:
                net_err = f"request failed: {exc.reason}"
        except (TimeoutError, OSError) as exc:
            if net_err is None:
                net_err = f"request failed: {exc}"
    return None, (http_err or net_err)


def fmt_reset(epoch):
    if not isinstance(epoch, (int, float)):
        return "-"
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%d")


def fmt_overages(status):
    return {"ENABLED": "Enabled", "DISABLED": "Disabled"}.get(status or "", "-")


def num_str(value, default="-"):
    return str(value) if isinstance(value, (int, float)) else default


def build_record(key, regions, timeout):
    masked = mask_key(key)
    if not key.startswith("ksk_"):
        rec = dict.fromkeys(FIELDS, "-")
        rec["key"] = masked
        rec["status"] = "invalid key format"
        return rec

    data, error = get_usage(key, regions, timeout)
    if data is None:
        rec = dict.fromkeys(FIELDS, "-")
        rec.update(key=masked, accountType="ApiKey", status=error or "request failed")
        return rec

    sub = data.get("subscriptionInfo") or {}
    credit = next(
        (b for b in data.get("usageBreakdownList") or []
         if b.get("resourceType") == "CREDIT"),
        {},
    )
    reset = credit.get("nextDateReset")
    if reset is None:
        reset = data.get("nextDateReset")
    charges = credit.get("overageCharges")
    cost = f"${charges:.2f}" if isinstance(charges, (int, float)) else "-"

    return {
        "key": masked,
        "email": (data.get("userInfo") or {}).get("email") or "-",
        "accountType": "ApiKey",
        "plan": sub.get("subscriptionTitle") or sub.get("type") or "-",
        "creditsUsed": num_str(
            credit.get("currentUsageWithPrecision", credit.get("currentUsage"))
        ),
        "planAllowance": num_str(credit.get("usageLimit")),
        "nextReset": fmt_reset(reset),
        "overages": fmt_overages((data.get("overageConfiguration") or {}).get(
            "overageStatus")),
        "overageCredits": num_str(credit.get("currentOverages"), "0"),
        "estimatedCost": cost,
        "status": "ok",
    }


def print_table(records):
    fmt = "%-15s  %-30s  %-14s  %-12s  %-12s  %-12s  %-28s  %s"
    print(fmt % ("KEY", "EMAIL / USERNAME", "PLAN", "TOTAL USED", "OVERAGE",
                 "RESET", "PLAN ALLOWANCE", "STATUS"))
    print(fmt % ("-" * 15, "-" * 30, "-" * 14, "-" * 12, "-" * 12, "-" * 12,
                 "-" * 28, "-" * 6))
    for r in records:
        print(fmt % (r["key"], r["email"], r["plan"], r["creditsUsed"],
                     r["overageCredits"], r["nextReset"], r["planAllowance"],
                     r["status"]))


def main():
    parser = argparse.ArgumentParser(
        description="Report Kiro account credit usage for a list of API keys.")
    parser.add_argument("pat_file", help="file with one ksk_ key per line")
    parser.add_argument("--json", action="store_true",
                        help="print a JSON array instead of a table")
    parser.add_argument("--workers", type=int,
                        default=int(os.environ.get("KIRO_WORKERS", 0)),
                        help="max concurrent requests")
    args = parser.parse_args()

    timeout = float(os.environ.get("KIRO_TIMEOUT", "30"))
    regions = os.environ.get("KIRO_REGIONS", "us-east-1 eu-central-1").split()

    try:
        with open(args.pat_file, encoding="utf-8") as handle:
            keys = [
                line.strip() for line in handle
                if line.strip() and not line.strip().startswith("#")
            ]
    except OSError as exc:
        sys.exit(f"Error: cannot read PAT file: {exc}")

    if not keys:
        sys.exit("Error: no keys found in PAT file")

    workers = args.workers or min(len(keys), 8)
    for key in keys:
        print(f"Querying {mask_key(key)}...", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        records = list(pool.map(
            lambda k: build_record(k, regions, timeout), keys))

    if args.json:
        print(json.dumps(records, indent=2))
    else:
        print_table(records)


if __name__ == "__main__":
    main()
