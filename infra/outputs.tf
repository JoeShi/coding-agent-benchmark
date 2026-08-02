output "jobs_queue_url" {
  description = "URL of the SQS jobs queue workers consume from."
  value       = aws_sqs_queue.jobs.url
}

output "results_bucket_name" {
  description = "S3 bucket where workers upload benchmark results."
  value       = aws_s3_bucket.results.id
}

output "api_keys_secret_arn" {
  description = "ARN of the Secrets Manager secret holding Kiro API keys."
  value       = aws_secretsmanager_secret.kiro_api_keys.arn
}

output "worker_asg_name" {
  description = "Name of the worker Auto Scaling Group."
  value       = aws_autoscaling_group.workers.name
}
