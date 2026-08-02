# Log group for worker setup + run logs.
resource "aws_cloudwatch_log_group" "workers" {
  name              = "/${var.project}/workers"
  retention_in_days = 30

  tags = {
    Project = var.project
  }
}

# Alert when a job lands in the DLQ (failed twice) — needs a human look.
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.project}-dlq-messages"
  alarm_description   = "Jobs failed twice and moved to the DLQ."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.jobs_dlq.name
  }

  # TODO: add alarm_actions (SNS topic) once notification routing is decided.
}

# Alert when the oldest job has been sitting > 3h — workers are stuck or dead.
resource "aws_cloudwatch_metric_alarm" "jobs_oldest_age" {
  alarm_name          = "${var.project}-jobs-oldest-age"
  alarm_description   = "Oldest unprocessed job in the jobs queue is over 3 hours old."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10800 # 3 hours in seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.jobs.name
  }

  # TODO: add alarm_actions (SNS topic) once notification routing is decided.
}
