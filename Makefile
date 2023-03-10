
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
# 	http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.

ifndef tag
override tag = latest
endif

-include .env

all: release

.PHONY: release
release:
	mkdir -p ./data/data-public
	docker build --no-cache -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest amazon/firelens-datajet:${tag}

.PHONY: cached
cached:
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest amazon/firelens-datajet:${tag}

.PHONY: deploy-public
deploy-public: release
	docker tag amazon/firelens-datajet:latest ${public_namespace}firelens-datajet:${tag}
	aws ecr-public get-login-password --region ${public_region} | docker login --username AWS --password-stdin ${public_namespace}
	docker push ${public_namespace}firelens-datajet:${tag}

.PHONY: deploy-private
deploy-private: release
	docker tag amazon/firelens-datajet:latest ${private_namespace}firelens-datajet:${tag}
	ecs-cli push ${private_namespace}firelens-datajet:${tag}

.PHONY: run
run:
	# docker stop $(docker ps -a -q --filter ancestor=amazon/firelens-datajet:latest --format="{{.ID}}")
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 amazon/firelens-datajet:latest

.PHONY: runimage
runimage:
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 amazon/firelens-datajet:${tag}

.PHONY: containerjet
containerjet:
	docker build -t amazon/firelens-datajet:executor-latest -f Dockerfile.executor .
	docker tag amazon/firelens-datajet:executor-latest amazon/firelens-datajet:${tag}

.PHONY: containerjetd
containerjetd: containerjet
	touch .dockerenv
	mkdir -p `pwd`/output-containerjet/coredumps
	docker run -d --privileged --ulimit core=-1 -v `pwd`/output-containerjet/coredumps:/cores -v `pwd`/output-containerjet/out:/app/output --env-file="./.dockerenv" amazon/firelens-datajet:executor-latest
	echo "Successfully started containerjet: $(docker container ls --latest | awk 'NR==2 {print $1}')"

.PHONY: containerjetit
containerjetit: containerjet
	touch .dockerenv
	docker build -t amazon/firelens-datajet:executor-latest -f Dockerfile.executor .
	mkdir -p `pwd`/output-containerjet/coredumps
	docker run -it --privileged --ulimit core=-1 -v `pwd`/output-containerjet/coredumps:/cores -v `pwd`/output-containerjet/out:/app/output --env-file="./.dockerenv" amazon/firelens-datajet:executor-latest
