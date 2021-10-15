
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
make publish tag="error-1_batch200_rate20"
make publish tag="error-1_batch1_rate10"
```

## Repository sample location
https://us-west-2.console.aws.amazon.com/ecr/repositories?region=us-west-2