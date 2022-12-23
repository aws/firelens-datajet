
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

ifndef public_namespace
override public_namespace = public.ecr.aws/fala-fluentbit/
endif

ifndef public_region
override public_region = us-east-1
endif

all: fresh

.PHONY: public
public:
	docker build -t ${public_namespace}firelens-datajet:latest -f Dockerfile .
	docker tag ${public_namespace}firelens-datajet:latest ${public_namespace}firelens-datajet:${tag}
	aws ecr-public get-login-password --region ${public_region} | docker login --username AWS --password-stdin ${public_namespace}
	docker push ${public_namespace}firelens-datajet:${tag}

.PHONY: publish
publish:
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest amazon/firelens-datajet:${tag}
	ecs-cli push amazon/firelens-datajet:${tag}

.PHONY: private
private:
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest 826489191740.dkr.ecr.us-west-2.amazonaws.com/private-datajet:${tag}
	ecs-cli push 826489191740.dkr.ecr.us-west-2.amazonaws.com/private-datajet:${tag}

.PHONY: cached
cached:
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest amazon/firelens-datajet:${tag}

.PHONY: fresh
fresh:
	docker build --no-cache -t amazon/firelens-datajet:latest -f Dockerfile .
	docker tag amazon/firelens-datajet:latest amazon/firelens-datajet:${tag}

.PHONY: container
container:
	docker-compose --file ./dockercompose.yml build
	docker-compose --file ./dockercompose.yml up

.PHONY: run
run:
	# docker stop $(docker ps -a -q --filter ancestor=amazon/firelens-datajet:latest --format="{{.ID}}")
	docker build -t amazon/firelens-datajet:latest -f Dockerfile .
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 amazon/firelens-datajet:latest

runimage:
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 amazon/firelens-datajet:${tag}

containerjetd:
	touch .dockerenv
	docker build -t amazon/firelens-datajet:executor-latest -f Dockerfile.executor .
	mkdir -p `pwd`/output-containerjet/coredumps
	docker run -d --privileged --ulimit core=-1 -v `pwd`/output-containerjet/coredumps:/cores -v `pwd`/output-containerjet/out:/app/output --env-file="./.dockerenv" amazon/firelens-datajet:executor-latest
	echo "Successfully started containerjet: $(docker container ls --latest | awk 'NR==2 {print $1}')"

containerjetit:
	touch .dockerenv
	docker build -t amazon/firelens-datajet:executor-latest -f Dockerfile.executor .
	mkdir -p `pwd`/output-containerjet/coredumps
	docker run -it --privileged --ulimit core=-1 -v `pwd`/output-containerjet/coredumps:/cores -v `pwd`/output-containerjet/out:/app/output --env-file="./.dockerenv" amazon/firelens-datajet:executor-latest
