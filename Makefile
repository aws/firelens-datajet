
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

all: fresh

.PHONY: publish
publish:
	docker build -t aws-test/firelens-datajet:latest -f Dockerfile .
	docker tag aws-test/firelens-datajet:latest aws-test/firelens-datajet:${tag}
	ecs-cli push aws-test/firelens-datajet:${tag}

.PHONY: cached
cached:
	docker build -t aws-test/firelens-datajet:latest -f Dockerfile .

.PHONY: fresh
fresh:
	docker build --no-cache -t aws-test/firelens-datajet:latest -f Dockerfile .

.PHONY: container
container:
	docker-compose --file ./dockercompose.yml build
	docker-compose --file ./dockercompose.yml up

.PHONY: run
run:
	# docker stop $(docker ps -a -q --filter ancestor=aws-test/firelens-datajet:latest --format="{{.ID}}")
	docker build -t aws-test/firelens-datajet:latest -f Dockerfile .
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 aws-test/firelens-datajet:latest

runimage:
	docker run --log-driver fluentd  --log-opt fluentd-address=docker.for.mac.localhost:24224 aws-test/firelens-datajet:${tag}