#!/usr/bin/env bash
# Pre-pull task images so benchmark trials hit the local Docker cache instead
# of Docker Hub (rate limits) mid-run.
#
# Usage:
#   scripts/warm_images.sh [ECR_PREFIX] IMAGE [IMAGE...]
#
# With an ECR_PREFIX (the infra `docker_hub_ecr_prefix` output), each Hub
# image is pulled through the ECR pull-through cache and retagged to its
# original name, so compose files referencing the plain Hub name hit the
# local cache. Without a prefix, images are pulled from Docker Hub directly.
# Images already present locally are skipped.
#
# Example:
#   scripts/warm_images.sh \
#     178770047227.dkr.ecr.us-east-1.amazonaws.com/docker-hub \
#     alexgshaw/build-cython-ext:20251031

set -euo pipefail

PREFIX=""
if [ $# -gt 0 ] && [[ "$1" == *".dkr.ecr."* ]]; then
  PREFIX="$1"; shift
fi

if [ $# -eq 0 ]; then
  echo "usage: $0 [ecr-prefix] image [image...]" >&2
  exit 1
fi

if [ -n "$PREFIX" ]; then
  REGISTRY="${PREFIX%%/*}"
  REGION="$(echo "$REGISTRY" | cut -d. -f4)"
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$REGISTRY"
fi

FAILED=0
for image in "$@"; do
  if docker image inspect "$image" > /dev/null 2>&1; then
    echo "skip (cached): $image"
    continue
  fi
  if [ -n "$PREFIX" ]; then
    echo "pull via ECR cache: $PREFIX/$image"
    if docker pull "$PREFIX/$image"; then
      docker tag "$PREFIX/$image" "$image"
      docker rmi "$PREFIX/$image" > /dev/null
    else
      echo "FAILED: $image" >&2
      FAILED=1
    fi
  else
    echo "pull: $image"
    docker pull "$image" || { echo "FAILED: $image" >&2; FAILED=1; }
  fi
done
exit "$FAILED"
