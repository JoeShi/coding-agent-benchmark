# Kiro API keys distributed to workers. The secret itself always exists so IAM
# has a stable ARN; a version with the keys is only written when the list is
# non-empty (otherwise workers get nothing and must rely on another auth path).

resource "aws_secretsmanager_secret" "kiro_api_keys" {
  name        = "${var.project}/kiro-api-keys"
  description = "Kiro API keys for benchmark workers (JSON: {\"keys\": [...]})."

  tags = {
    Project = var.project
  }
}

resource "aws_secretsmanager_secret_version" "kiro_api_keys" {
  count = length(var.kiro_api_keys) > 0 ? 1 : 0

  secret_id     = aws_secretsmanager_secret.kiro_api_keys.id
  secret_string = jsonencode({ keys = var.kiro_api_keys })
}
