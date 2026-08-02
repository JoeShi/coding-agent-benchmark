#!/usr/bin/env python3
"""Hot-refresh the Kiro API keys on running benchmark workers.

Workers snapshot ``KIRO_API_KEYS`` twice and never re-read it: the secret is
fetched once at boot (infra/templates/user_data.sh.tftpl) into
/etc/kiro-bench.env, and scripts/worker.sh reads that env once at startup into
its rotation array. So keys added to Secrets Manager *after* a worker booted
are NOT rotated to until the worker re-bootstraps.

This script pushes an in-place refresh to each in-service worker via SSM Run
Command (no SSH needed; the worker role already has AmazonSSMManagedInstance
Core). On each instance it: re-fetches the secret, rewrites the KIRO_API_KEY/
KIRO_API_KEYS lines in /etc/kiro-bench.env, and restarts kiro-bench-worker.

  WARNING: restarting the worker kills any in-flight trial on that instance.
  Killed trials are not lost -- their SQS message was never deleted, so it
  redrives after the visibility timeout and is retried (trial records use
  deterministic S3 keys, so the retry overwrites rather than duplicates).

Note: the secret *version* is Terraform-managed. If you edited the secret by
hand in the console/CLI, a later `terraform apply` will revert it to
var.kiro_api_keys. Persist new keys in tfvars, not just in the console.

Usage:
    python3 scripts/refresh_worker_keys.py                 # confirm, then refresh whole ASG
    python3 scripts/refresh_worker_keys.py --dry-run       # show targets + remote script only
    python3 scripts/refresh_worker_keys.py --yes           # skip the confirmation prompt
    python3 scripts/refresh_worker_keys.py --instance-ids i-abc,i-def

Requires boto3 and AWS credentials with autoscaling:Describe*, ssm:SendCommand,
and ssm:GetCommandInvocation.
"""

import argparse
import sys
import time

DEFAULT_ASG = "kiro-bench-workers"
DEFAULT_SECRET_ID = "kiro-bench/kiro-api-keys"
WORKER_SERVICE = "kiro-bench-worker"
ENV_FILE = "/etc/kiro-bench.env"

# Remote script (runs as root via SSM). Mirrors the key-fetch/index logic in
# user_data.sh.tftpl so the in-place env file matches a fresh boot, then
# restarts the worker so worker.sh re-snapshots KIRO_API_KEYS.
REMOTE_SCRIPT = r"""
set -euo pipefail
REGION="{region}"
SECRET_ID="{secret_id}"

KEYS_JSON="$(aws secretsmanager get-secret-value --region "$REGION" \
  --secret-id "$SECRET_ID" --query SecretString --output text)"
KEY_COUNT="$(echo "$KEYS_JSON" | jq '.keys | length')"
if [ "$KEY_COUNT" -le 0 ]; then
  echo "ERROR: secret $SECRET_ID has no keys"; exit 3
fi

# IMDSv2-aware instance-id fetch (used only for the single fallback key index).
TOKEN="$(curl -sS -X PUT 'http://169.254.169.254/latest/api/token' \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
INSTANCE_ID="$(curl -sS ${{TOKEN:+-H "X-aws-ec2-metadata-token: $TOKEN"}} \
  http://169.254.169.254/latest/meta-data/instance-id)"
INDEX=$(( (16#$(echo -n "$INSTANCE_ID" | md5sum | cut -c1-8)) % KEY_COUNT ))
KIRO_API_KEY="$(echo "$KEYS_JSON" | jq -r ".keys[$INDEX]")"
KIRO_API_KEYS="$(echo "$KEYS_JSON" | jq -r '.keys | join(" ")')"

# Rewrite only the two KIRO_* lines; keep everything else in the env file.
# Values are opaque tokens, so append via printf (no sed metachar hazard).
NEW="$(mktemp)"
grep -v -E '^KIRO_API_KEY=|^KIRO_API_KEYS=' {env_file} > "$NEW"
printf 'KIRO_API_KEY="%s"\n'  "$KIRO_API_KEY"  >> "$NEW"
printf 'KIRO_API_KEYS="%s"\n' "$KIRO_API_KEYS" >> "$NEW"
install -m600 -o ec2-user -g ec2-user "$NEW" {env_file}
rm -f "$NEW"

systemctl restart {service}
echo "OK: refreshed $KEY_COUNT keys, restarted {service} on $INSTANCE_ID"
"""


def in_service_instance_ids(asg_name: str) -> list[str]:
    import boto3
    asg = boto3.client("autoscaling")
    resp = asg.describe_auto_scaling_groups(AutoScalingGroupNames=[asg_name])
    groups = resp.get("AutoScalingGroups", [])
    if not groups:
        sys.exit(f"error: ASG {asg_name!r} not found")
    return [
        i["InstanceId"]
        for i in groups[0].get("Instances", [])
        if i.get("LifecycleState") == "InService"
    ]


def render_remote_script(region: str, secret_id: str) -> str:
    return REMOTE_SCRIPT.format(
        region=region,
        secret_id=secret_id,
        env_file=ENV_FILE,
        service=WORKER_SERVICE,
    )


def send_and_wait(instance_ids: list[str], script: str, region: str, wait: bool) -> int:
    import boto3
    ssm = boto3.client("ssm", region_name=region)
    rc = 0
    # SendCommand takes up to 50 instance ids per call.
    for offset in range(0, len(instance_ids), 50):
        batch = instance_ids[offset:offset + 50]
        resp = ssm.send_command(
            InstanceIds=batch,
            DocumentName="AWS-RunShellScript",
            Comment="kiro-bench: refresh API keys + restart worker",
            Parameters={"commands": [script]},
        )
        command_id = resp["Command"]["CommandId"]
        print(f"sent SSM command {command_id} to {len(batch)} instance(s)")
        if not wait:
            continue
        for iid in batch:
            status, output = _poll_invocation(ssm, command_id, iid)
            marker = "ok " if status == "Success" else "ERR"
            print(f"  [{marker}] {iid}: {status}")
            tail = (output or "").strip().splitlines()[-1:] or [""]
            if tail[0]:
                print(f"        {tail[0]}")
            if status != "Success":
                rc = 1
    return rc


def _poll_invocation(ssm, command_id: str, instance_id: str,
                     timeout_s: int = 180) -> tuple[str, str]:
    deadline = time.time() + timeout_s
    terminal = {"Success", "Failed", "Cancelled", "TimedOut"}
    while time.time() < deadline:
        try:
            inv = ssm.get_command_invocation(
                CommandId=command_id, InstanceId=instance_id)
        except ssm.exceptions.InvocationDoesNotExist:
            time.sleep(1)
            continue
        status = inv["Status"]
        if status in terminal:
            out = inv.get("StandardOutputContent", "")
            err = inv.get("StandardErrorContent", "")
            return status, (out + err)
        time.sleep(2)
    return "TimedOut(poll)", ""


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--asg-name", default=DEFAULT_ASG,
                        help=f"Worker ASG name (default: {DEFAULT_ASG})")
    parser.add_argument("--instance-ids",
                        help="Comma-separated instance ids to target instead of "
                             "discovering them from the ASG")
    parser.add_argument("--secret-id", default=DEFAULT_SECRET_ID,
                        help=f"Secrets Manager secret id (default: {DEFAULT_SECRET_ID})")
    parser.add_argument("--region", default=None,
                        help="AWS region (default: AWS_REGION env or us-east-1)")
    parser.add_argument("--no-wait", action="store_true",
                        help="Don't poll for per-instance command results")
    parser.add_argument("--yes", action="store_true",
                        help="Skip the confirmation prompt")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print targets and the remote script; send nothing")
    args = parser.parse_args()

    import os
    region = args.region or os.environ.get("AWS_REGION") or "us-east-1"

    try:
        import boto3  # noqa: F401
    except ImportError:
        if not args.dry_run:
            sys.exit("error: boto3 is required (pip install boto3); or use --dry-run")

    if args.instance_ids:
        instance_ids = [i.strip() for i in args.instance_ids.split(",") if i.strip()]
    elif args.dry_run:
        instance_ids = ["<discovered-from-asg-at-run-time>"]
    else:
        instance_ids = in_service_instance_ids(args.asg_name)

    if not instance_ids:
        print(f"no in-service instances in ASG {args.asg_name!r}; nothing to do")
        return 0

    script = render_remote_script(region, args.secret_id)

    if args.dry_run:
        print(f"region:    {region}")
        print(f"secret-id: {args.secret_id}")
        print(f"targets:   {', '.join(instance_ids)}")
        print("--- remote script ---")
        print(script)
        print("-- dry run, nothing sent")
        return 0

    print(f"About to refresh keys and RESTART {WORKER_SERVICE} on "
          f"{len(instance_ids)} instance(s): {', '.join(instance_ids)}")
    print("This interrupts any in-flight trial on those instances (they redrive "
          "via SQS and retry).")
    if not args.yes:
        reply = input("Proceed? [y/N] ").strip().lower()
        if reply not in ("y", "yes"):
            print("aborted")
            return 1

    return send_and_wait(instance_ids, script, region, wait=not args.no_wait)


if __name__ == "__main__":
    sys.exit(main())
