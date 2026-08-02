variable "project" {
  description = "Project name prefix used for resource naming."
  type        = string
  default     = "kiro-bench"
}

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "worker_instance_type" {
  description = "EC2 instance type for benchmark workers (needs many cores + enough RAM for Docker harness runs)."
  type        = string
  default     = "c7i.8xlarge"
}

variable "worker_count" {
  description = "Number of worker instances (ASG desired/min/max are all pinned to this)."
  type        = number
  default     = 2
}

variable "worker_concurrency" {
  description = "Parallel job loops per worker instance (each runs one harness trial at a time)."
  type        = number
  default     = 4
}

variable "ebs_volume_size_gb" {
  description = "Root EBS volume size in GB for workers (Docker images + benchmark checkouts are large)."
  type        = number
  default     = 500
}

variable "ssh_key_name" {
  description = "Optional EC2 key pair name for SSH access to workers. Empty string disables SSH ingress."
  type        = string
  default     = ""
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH into workers when ssh_key_name is set. Default is wide open; tighten to your IP range before real use."
  type        = string
  default     = "0.0.0.0/0"
}

variable "kiro_api_keys" {
  description = "List of Kiro API keys distributed round-robin to workers. Stored in Secrets Manager; pass via tfvars or TF_VAR, never commit real keys."
  type        = list(string)
  sensitive   = true
  default     = []
}

variable "deepswe_repo_url" {
  description = "Git URL of the deep-swe benchmark source (tasks dir) to clone onto workers."
  type        = string
  default     = "https://github.com/datacurve-ai/deep-swe"
}

variable "judge_api_key" {
  description = "API key for the SWE-Atlas-QnA LLM judge endpoint (OPENAI_API_KEY on workers). Only needed when running swe-atlas-qna jobs."
  type        = string
  sensitive   = true
  default     = ""
}

variable "judge_api_base" {
  description = "Base URL of the OpenAI-compatible judge endpoint for SWE-Atlas-QnA (OPENAI_API_BASE on workers). Only needed when running swe-atlas-qna jobs."
  type        = string
  default     = ""
}

variable "judge_eval_model" {
  description = "EVAL_MODEL for the SWE-Atlas-QnA judge. The task default is anthropic/claude-opus-4-5-20251101; override when the endpoint exposes a different model id."
  type        = string
  default     = "claude-opus-4-5"
}
