# Results bucket: workers upload trial artifacts/results here.
# Name includes account id to keep it globally unique.

resource "aws_s3_bucket" "results" {
  bucket = "${var.project}-results-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project = var.project
  }
}

resource "aws_s3_bucket_versioning" "results" {
  bucket = aws_s3_bucket.results.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Results are intermediate benchmark artifacts; expire after 30 days
# (analysis copies should be pulled down before then).
resource "aws_s3_bucket_lifecycle_configuration" "results" {
  bucket = aws_s3_bucket.results.id

  rule {
    id     = "expire-results-30d"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "results" {
  bucket = aws_s3_bucket.results.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
