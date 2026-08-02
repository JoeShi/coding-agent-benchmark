# Worker instance role: write results to S3, consume jobs from SQS,
# read the API key secret, and push CloudWatch Logs.

data "aws_iam_policy_document" "worker_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "worker" {
  name               = "${var.project}-worker"
  assume_role_policy = data.aws_iam_policy_document.worker_assume.json

  tags = {
    Project = var.project
  }
}

data "aws_iam_policy_document" "worker" {
  # Upload results (and read back for verification/resume).
  statement {
    sid    = "ResultsBucket"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.results.arn,
      "${aws_s3_bucket.results.arn}/*",
    ]
  }

  # Consume jobs: receive, extend visibility on long trials, delete on success.
  statement {
    sid    = "JobsQueue"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.jobs.arn]
  }

  # Read the Kiro API keys secret.
  statement {
    sid       = "ReadApiKeys"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.kiro_api_keys.arn]
  }

  # Push worker/setup logs.
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.workers.arn}:*"]
  }
}

resource "aws_iam_role_policy" "worker" {
  name   = "${var.project}-worker"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker.json
}

# SSM for debugging workers without SSH keys (aws ssm start-session).
resource "aws_iam_role_policy_attachment" "worker_ssm" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "worker" {
  name = "${var.project}-worker"
  role = aws_iam_role.worker.name
}
