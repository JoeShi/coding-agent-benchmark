# infra/ — AWS worker fleet for the benchmark

Terraform skeleton for a small cluster of benchmark workers. Workers pull jobs
from SQS, run the harbor/pier harnesses locally in Docker, and upload results
to S3. Default VPC networking; no modules.

## Usage

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # edit as needed
terraform init
terraform plan
terraform apply
```

Scale workers by changing `worker_count` and re-applying.

## Setting Kiro API keys

`kiro_api_keys` is a sensitive list of strings. Avoid committing it; either:

```bash
export TF_VAR_kiro_api_keys='["key-1","key-2"]'
terraform apply
```

or put it in an untracked `*.auto.tfvars`. The keys land in the Secrets
Manager secret `<project>/kiro-api-keys`; each worker `shuf`s the list at
boot and rotates the key **per trial** (`keys[(trial_num + wid - 1) % N]`) —
per-process pinning caused a rate-limit incident; see
`docs/full-20260729-retrospective.md`. Target ~4-6 concurrent trials per key
(`worker_count × worker_concurrency ÷ #keys`).

Optional pull-through caches (avoid public-registry rate limits):
`docker_hub_username`/`docker_hub_access_token` for Docker Hub (TB2 images),
`github_username`/`github_token` (PAT, read:packages) for ghcr.io (QnA
images). Workers pull via `<acct>.dkr.ecr.<region>.amazonaws.com/docker-hub|ghcr`
and retag to the original image name.

## How workers get jobs

- The benchmark repo (adapters + scripts) is distributed via S3, not git:
  the operator runs `aws s3 sync . s3://<results-bucket>/repo/ \
  --exclude '.git/*'` from the repo root before/while workers boot (this
  picks up uncommitted working-tree changes). Workers retry the sync at
  startup until the repo lands.
- Enqueue side: `scripts/enqueue_jobs.py` puts one SQS message per job into
  the jobs queue (URL in the `jobs_queue_url` output).
- Worker side: a systemd unit runs `scripts/worker.sh`, which loops —
  receive message, run the harness, upload a normalized trial record + raw
  logs to the results bucket, delete the message. Failed jobs are redriven
  to the DLQ after 2 receives; DLQ and queue-age alarms are in CloudWatch.
- Aggregate side: `aws s3 sync s3://<bucket>/<run_id>/trials \
  results/<run_id>/trials` then `python3 scripts/aggregate.py
  results/<run_id>/trials --json-out ... --markdown-out ...`.

## Notes

- Uses the default VPC/subnets on purpose (simplest possible setup).
- SSH ingress is off unless `ssh_key_name` is set; tighten `ssh_ingress_cidr`.
- Results bucket objects expire after 30 days.
