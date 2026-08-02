# Optional ECR pull-through cache for Docker Hub.
#
# Motivation: benchmark workers pull many task images from Docker Hub
# (alexgshaw/* for Terminal-Bench 2.0); anonymous pulls are rate-limited
# (~100 pulls / 6h / source IP), which a full run can hit. With a pull-through
# cache rule, workers pull
#   <account>.dkr.ecr.<region>.amazonaws.com/docker-hub/<repo>:<tag>
# and ECR caches upstream layers in-region — no Hub rate limit, faster pulls.
#
# Prerequisite: ECR requires Docker Hub credentials for this upstream (a free
# Hub account + access token works). When docker_hub_username is empty the
# rule is not created and workers pull from Docker Hub directly.

variable "docker_hub_username" {
  description = "Docker Hub username for the ECR pull-through cache. Empty disables the cache (workers pull from Hub directly)."
  type        = string
  default     = ""
}

variable "docker_hub_access_token" {
  description = "Docker Hub access token for the ECR pull-through cache. Sensitive; pass via TF_VAR."
  type        = string
  sensitive   = true
  default     = ""
}

resource "aws_secretsmanager_secret" "docker_hub" {
  count = var.docker_hub_username != "" ? 1 : 0

  # ECR requires the credential secret to live under this prefix.
  name        = "ecr-pullthroughcache/${var.project}-docker-hub"
  description = "Docker Hub credentials for the ECR pull-through cache rule."

  tags = {
    Project = var.project
  }
}

resource "aws_secretsmanager_secret_version" "docker_hub" {
  count = var.docker_hub_username != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.docker_hub[0].id
  secret_string = jsonencode({
    username    = var.docker_hub_username
    accessToken = var.docker_hub_access_token
  })
}

resource "aws_ecr_pull_through_cache_rule" "docker_hub" {
  count = var.docker_hub_username != "" ? 1 : 0

  ecr_repository_prefix = "docker-hub"
  upstream_registry_url = "registry-1.docker.io"
  credential_arn        = aws_secretsmanager_secret.docker_hub[0].arn
}

# Workers need to authenticate to ECR and pull (and auto-create) cached repos.
data "aws_iam_policy_document" "worker_ecr_ptc" {
  count = var.docker_hub_username != "" ? 1 : 0

  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPullThroughCache"
    effect = "Allow"
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchImportUpstreamImage",
      "ecr:CreateRepository",
      "ecr:DescribeRepositories",
    ]
    resources = [
      "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/docker-hub/*",
    ]
  }
}

resource "aws_iam_role_policy" "worker_ecr_ptc" {
  count = var.docker_hub_username != "" ? 1 : 0

  name   = "${var.project}-worker-ecr-ptc"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker_ecr_ptc[0].json
}

output "docker_hub_ecr_prefix" {
  description = "ECR pull-through cache prefix for Docker Hub images (empty if disabled). Pull <prefix>/<repo>:<tag> then retag to the original name."
  value       = var.docker_hub_username != "" ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/docker-hub" : ""
}

# ghcr.io pull-through cache for the SWE-Atlas-QnA task images
# (ghcr.io/scaleapi/swe-atlas:*, one per task). Trial-time anonymous pulls
# from ghcr failed ~35% of QnA trials in the full run (compose up timeouts /
# pull errors); pulling through ECR keeps traffic in-region and off ghcr's
# anonymous rate limits. Requires a GitHub PAT (read:packages) — ECR mandates
# credentials for the ghcr upstream even for public images.

variable "github_username" {
  description = "GitHub username for the ghcr.io ECR pull-through cache. Empty disables the cache (workers pull from ghcr directly)."
  type        = string
  default     = ""
}

variable "github_token" {
  description = "GitHub PAT (read:packages) for the ghcr.io ECR pull-through cache. Sensitive; pass via TF_VAR."
  type        = string
  sensitive   = true
  default     = ""
}

resource "aws_secretsmanager_secret" "ghcr" {
  count = var.github_username != "" ? 1 : 0

  name        = "ecr-pullthroughcache/${var.project}-ghcr"
  description = "GitHub Container Registry credentials for the ECR pull-through cache rule."

  tags = {
    Project = var.project
  }
}

resource "aws_secretsmanager_secret_version" "ghcr" {
  count = var.github_username != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.ghcr[0].id
  secret_string = jsonencode({
    username    = var.github_username
    accessToken = var.github_token
  })
}

resource "aws_ecr_pull_through_cache_rule" "ghcr" {
  count = var.github_username != "" ? 1 : 0

  ecr_repository_prefix = "ghcr"
  upstream_registry_url = "ghcr.io"
  credential_arn        = aws_secretsmanager_secret.ghcr[0].arn
}

data "aws_iam_policy_document" "worker_ecr_ptc_ghcr" {
  count = var.github_username != "" ? 1 : 0

  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPullThroughCache"
    effect = "Allow"
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchImportUpstreamImage",
      "ecr:CreateRepository",
      "ecr:DescribeRepositories",
    ]
    resources = [
      "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/ghcr/*",
    ]
  }
}

resource "aws_iam_role_policy" "worker_ecr_ptc_ghcr" {
  count = var.github_username != "" ? 1 : 0

  name   = "${var.project}-worker-ecr-ptc-ghcr"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker_ecr_ptc_ghcr[0].json
}

output "ghcr_ecr_prefix" {
  description = "ECR pull-through cache prefix for ghcr.io images (empty if disabled). Pull <prefix>/<repo>:<tag> (repo without the ghcr.io/ part) then retag to the original ghcr.io name."
  value       = var.github_username != "" ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/ghcr" : ""
}
