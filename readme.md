
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

# Configuration
Firelens Datajet currently supports configuration only with the firelens-datajet.json file.
Documentation on the format of this file is needed, but in summary, the file chooses from a data genrator which generates data
and sends data via the datajet which outputs data in a way that is accessable to Fluent Bit.

In the future, firelens-datajet.json should be customizable via an environment variable, and the configuration should include multiple
synchronous and asynchronous stages, as well as validation wrappers.

# Firelens datajet can also be contained in a Docker image.
## ECR quick publish procedure
```
make publish tag="0.1.0"
```

# Env config
ACCESS_TOKEN: A secret token to used to secure the endpoints via bearer_token (optional), defaults to no security.
PORT: The port Firelens Datajet will listen on for test configurations (optional), defaults to 3333

# Generating the ACCESS_TOKEN
Set environment variable ACCESS_TOKEN to the following and save the value.
```
npm run generate-access-token
```
a .env file can be used with the following format
```
PORT=<myport>
ACCESS_TOKEN=<myaccesstoken>
```

# Example Request
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
> Response: 200 OK
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
