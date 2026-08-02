# Worker fleet: launch template + ASG pinned to var.worker_count.

# Latest Amazon Linux 2023 x86_64 AMI.
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_launch_template" "worker" {
  name_prefix   = "${var.project}-worker-"
  image_id      = data.aws_ami.al2023.id
  instance_type = var.worker_instance_type
  key_name      = var.ssh_key_name != "" ? var.ssh_key_name : null

  iam_instance_profile {
    arn = aws_iam_instance_profile.worker.arn
  }

  vpc_security_group_ids = [aws_security_group.worker.id]

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.ebs_volume_size_gb
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/templates/user_data.sh.tftpl", {
    project            = var.project
    aws_region         = var.aws_region
    deepswe_repo_url   = var.deepswe_repo_url
    judge_api_key      = var.judge_api_key
    judge_api_base     = var.judge_api_base
    judge_eval_model   = var.judge_eval_model
    worker_concurrency = var.worker_concurrency
    queue_url          = aws_sqs_queue.jobs.url
    results_bucket     = aws_s3_bucket.results.id
    api_keys_secret_id = aws_secretsmanager_secret.kiro_api_keys.name
    log_group_name     = aws_cloudwatch_log_group.workers.name
    ghcr_ecr_prefix    = var.github_username != "" ? "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/ghcr" : ""
  }))

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name    = "${var.project}-worker"
      Project = var.project
    }
  }
}

resource "aws_autoscaling_group" "workers" {
  name = "${var.project}-workers"

  # Pinned capacity: manual scaling only, bump worker_count to grow.
  desired_capacity = var.worker_count
  min_size         = var.worker_count
  max_size         = var.worker_count

  # Spread across the default subnets (minus AZs lacking the instance type).
  vpc_zone_identifier = local.worker_subnet_ids

  launch_template {
    id      = aws_launch_template.worker.id
    version = "$Latest"
  }

  # On-Demand only: benchmark runs are long and must not be interrupted.

  tag {
    key                 = "Project"
    value               = var.project
    propagate_at_launch = true
  }

  instance_refresh {
    strategy = "Rolling"
  }
}
