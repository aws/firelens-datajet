
# Firelens Datajet
Route test data to Fluent Bit flexibly.
This system can be run locally with a local Fluent Bit process or compiled to a docker image and run with a sidecar aws-for-fluent-bit container.

The purpose of Firelens-Datajet is to abstract test configuration from implementation code
It does so by running tests based on a single JSON file and outputing the results.

Future work on this system involves making a REST interface for tests to be invoked by sending a POST request with the test configuration and responding with a test result JSON as the response.

The current driver.ts does not support multiple stages, however the core does support async and sync stages as well as validators.
The goal of this project is to eventually encapsulate test stages, validation wrappers, and data transmission in a portable JSON which can be sent to this program and executed at runtime.

# Setup instructions
To run Firelens Datajet locally please install NPM: https://nodejs.org/en/ and run the following commands
```
cd firelens-datajet
npm install
npm run build
node ./dist/driver.js
```
A .env file can be added to the project to configure environment variables while testing locally. The file might look something like:
```
# ---------- Environment Variables ----------
CLIENTS='["environment", "request", "file"]'
CLIENT_REQUEST_PORT=3334
CLIENT_REQUEST_ACCESS_TOKEN=123OPENSESAME
CLIENT_ENVIRONMENT_CONFIG='{"generator": {"name": "increment", "config": {"batchSize": 100, "waitTime": 0.050}}, "datajet": {"name": "firelens", "config": {"logStream": "stderr"}}, "stage": {"batchRate": 1, "maxBatches": 5}}'
CLIENT_FILE_NAME='firelens-datajet.json'

```
# Containerization
Firelens datajet can be contained in a Docker image.
## Create docker image
```
make
```
## ECR quick publish procedure
```
make publish tag="0.1.0"
```


# Test Definition
Firelens Datajet currently supports configuration only with file, environment variable, and request.
Documentation on the format of a test definition is still in progress, but in summary, the test definition
- chooses from a data generator which generates data
- sends data via a datajet which outputs data in a way that is accessable to Fluent Bit
- sets some values such as batch rate and batch limits

In the future, test definitions should support multiple
synchronous and asynchronous stages, as well as validation wrappers.

# Clients
Clients are methods for obtaining test configuration and can be selected and configured via environment variables.
The following clients are supported:
- Request: tests are posted to the url/execute endpoint
- File: tests description found in file
- Environment: tests description is found as environment variable

A single or multiple clients can be selected with the environment variable CLIENT
```
# A variable number of clients can be selected
CLIENTS='["environment", "request", "environment"]'
```

## Client Configuration
Other environment variables are used to configure specific clients
### Request
```
CLIENTS='["request"]'

# Provide an access token to secure the /execute endpoint
CLIENT_REQUEST_ACCESS_TOKEN=<access_token>
# Change the port FirelensDatajet client listens on
CLIENT_REQUEST_PORT=3334
```

### Environment
```
CLIENTS='["environment"]'

# Test definition
CLIENT_ENVIRONMENT_CONFIG='{"generator": {"name": "increment", "config": {"batchSize": 100, "waitTime": 0.050}}, "datajet": {"name": "firelens", "config": {"logStream": "stderr"}}, "stage": {"batchRate": 1, "maxBatches": 5}}'
```

### File
(this client may need to be updated to allow for root access)
```
CLIENTS='["file"]'

CLIENT_FILE_NAME='firelens-datajet.json'
```

# Request Client

## Environment variables
- CLIENT_REQUEST_ACCESS_TOKEN: A secret token used to secure request client endpoints via bearer_token (optional), defaults to no security.
- CLIENT_REQUEST_PORT: The port Firelens Datajet will listen on for test configurations (optional), defaults to 3333

## Generating the ACCESS_TOKEN
Set environment variable ACCESS_TOKEN to the following and save the value.
```
npm run generate-access-token
```
```
CLIENT_REQUEST_ACCESS_TOKEN=<myaccesstoken>
```

## Example Request
The following request uses the increment data generator and forwards logs to Fire Lens via stdout datajet
> POST http://localhost:3333/execute \
> Bearer Token: `<myaccesstoken>`
```
    {
        "generator": {
            "name": "increment",
            "config": {
                "batchSize": 1,
                "waitTime": 0.050
            }
        },
        "datajet": {
            "name": "stdout",
            "config": {
                "logStream": "stderr"
            }
        },
        "stage": {
            "batchRate": 1000,
            "maxBatches": 10
        }
    }
```
## Example Response
- Response: 200 OK
- Body:
```
{
    "testId": 2,
    "status": "Execution success. Validation success",
    "metrics": [],
    "testConfiguration": {
        "generator": {
            "name": "increment",
            "config": {
                "batchSize": 1,
                "waitTime": 0.05
            }
        },
        "datajet": {
            "name": "stdout",
            "config": {
                "logStream": "stderr"
            }
        },
        "stage": {
            "batchRate": 1000,
            "maxBatches": 10
        }
    },
    "executionResult": {
        "builtStage": {
            "children": [],
            "stageLeaf": {
                "generator": {
                    "generatorTemplate": {
                        "name": "increment",
                        "defaultConfig": {
                            "batchSize": 10
                        }
                    }
                },
                "datajet": {
                    "datajetTemplate": {
                        "name": "stdout",
                        "defaultConfig": {
                            "logStream": "auto",
                            "defaultStream": "stdout"
                        }
                    }
                },
                "config": {
                    "batchRate": 1000,
                    "maxBatches": 10
                }
            },
            "type": "stage"
        },
        "isValidationSuccess": true,
        "isExecutionSuccess": true,
        "pendingValidators": [],
        "children": []
    }
}
```


# Example ECS Task Configuration
```
{
    "family": "FirelensDatajetTaskDefinition",
    "taskRoleArn": null,
    "executionRoleArn": "arn:aws:iam::826489191740:role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "essential": true,
            "image": "<aws_for_fluent_bit_image>",
            "name": "log_router",
            "firelensConfiguration": {
                "type": "fluentbit"
            },
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "firelens-datajet-client-test",
                    "awslogs-region": "us-west-2",
                    "awslogs-create-group": "true",
                    "awslogs-stream-prefix": "fluent-bit-"
                }
            },
            "memoryReservation": 50
        },
        {
            "essential": true,
            "image": "<firelens_datajet_image>",
            "name": "firelensDatajet",
		        "environment": [
                {
                    "name": "CLIENTS",
                    "value": "[\"environment\", \"request\"]"
                },
                {
                    "name": "CLIENT_REQUEST_PORT",
                    "value": "80"
                },
                {
                    "name": "CLIENT_REQUEST_ACCESS_TOKEN",
                    "value": "<access_token>"
                },
                {
                    "name": "CLIENT_ENVIRONMENT_CONFIG",
                    "value": "{\"generator\": {\"name\": \"increment\", \"config\": {\"batchSize\": 100, \"waitTime\": 0.050}}, \"datajet\": {\"name\": \"stdout\", \"config\": {\"logStream\": \"stderr\"}}, \"stage\": {\"batchRate\": 1, \"maxBatches\": 5}}"
                },
                {
                    "name": "CLIENT_FILE_NAME",
                    "value": "firelens-datajet.json"
                }
            ],
            "portMappings": [
                {
                    "hostPort": 80,
                    "protocol": "tcp",
                    "containerPort": 80
	              }
            ],
            "logConfiguration": {
                "logDriver": "awsfirelens",
                "options": {
                    "Name": "cloudwatch_logs",
                    "region": "us-west-2",
                    "log_group_name": "firelens-datajet-client-test",
                    "auto_create_group": "true",
                    "log_stream_name": "client-"
                }
            },
            "memoryReservation": 100
        }
    ],
    "inferenceAccelerators": [],
    "volumes": [],
    "placementConstraints": [],
    "memory": null,
    "cpu": null,
    "tags": []
}
```
