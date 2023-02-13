#!/bin/sh

docker run \
  --name dynamodb-local \
  -p 0.0.0.0:8000:8000 \
  -d amazon/dynamodb-local

docker build \
  -t lambda-environment-node \
  --network="host" \
  docker/. &&
docker run \
  --link dynamodb-local \
  -u`id -u`:`id -g` \
  -v $(pwd):/user/project \
  -v ~/.aws:/user/.aws \
  -v ~/.npmrc:/user/.npmrc \
  -it lambda-environment-node

docker stop dynamodb-local -t 0
docker rm -f -v dynamodb-local
