# Jobs queue: one message = one benchmark job (task x model x attempt).
# visibility_timeout is 4h: SWE-Atlas-QnA tasks allow the agent 3h (plus
# verifier + image pull), the longest of the three benchmarks; workers must
# delete the message only after results are uploaded.

resource "aws_sqs_queue" "jobs_dlq" {
  name = "${var.project}-jobs-dlq"

  tags = {
    Project = var.project
  }
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${var.project}-jobs"
  visibility_timeout_seconds = 14400
  message_retention_seconds  = 345600 # 4 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 2
  })

  tags = {
    Project = var.project
  }
}
