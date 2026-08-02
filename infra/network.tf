# Keep networking simple: use the default VPC and its subnets.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# c7i is not offered in every AZ of the default VPC (us-east-1e lacks it);
# drop AZs that would make ASG launches fail.
data "aws_subnet" "default" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

locals {
  worker_subnet_ids = [
    for s in data.aws_subnet.default : s.id
    if !contains(var.excluded_azs, s.availability_zone)
  ]
}

variable "excluded_azs" {
  description = "Availability Zones excluded from worker placement (instance type unsupported there)."
  type        = list(string)
  default     = ["us-east-1e"]
}

resource "aws_security_group" "worker" {
  name        = "${var.project}-worker"
  description = "Benchmark workers: full egress, optional SSH ingress."
  vpc_id      = data.aws_vpc.default.id

  # Workers need outbound access for: SQS, S3, Secrets Manager, CloudWatch,
  # kiro API endpoints, package installs, git clone, docker pulls.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project}-worker"
    Project = var.project
  }
}

# SSH ingress only when a key pair is configured; tighten ssh_ingress_cidr
# to your own IP range before using this in practice.
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  count = var.ssh_key_name != "" ? 1 : 0

  security_group_id = aws_security_group.worker.id
  description       = "SSH from configured CIDR"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = var.ssh_ingress_cidr
}
