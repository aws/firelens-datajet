# FireLens Stability Test Setup

Automated setup for FireLens stability testing environment using AWS CodeBuild and CloudFormation.

## Quick Start

1. **Deploy Infrastructure**
   ```bash
   aws cloudformation deploy \
     --template-file firelens-stability-infrastructure.yaml \
     --stack-name firelens-stability \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides FluentBitVersion=2.31.8
   ```

2. **Add buildspec.yml to firelens-datajet repository**
   ```bash
   cp buildspec.yml /path/to/firelens-datajet/
   cd /path/to/firelens-datajet
   git add buildspec.yml
   git commit -m "Add CodeBuild setup for stability tests"
   git push
   ```

3. **Run Setup**
   ```bash
   aws codebuild start-build --project-name firelens-stability-firelens-stability-setup
   ```

## What Gets Created

### Infrastructure (CloudFormation)
- VPC with 2 public subnets
- Security group for Fargate tasks
- 3 ECR repositories (datajet, aws-for-fluent-bit, mock-mountebank)
- 4 S3 buckets (archives, records, summary, output)
- IAM roles for ECS tasks
- CodeBuild project

### Build Process (CodeBuild)
- Builds aws-for-fluent-bit debug image
- Builds firelens-datajet image
- Builds mountebank mock image
- Pushes all images to ECR
- Configures stability test settings

## Running Stability Tests

After setup completes:

1. **Navigate to stability test directory**
   ```bash
   cd firelens-datajet/apps/firelens-stability
   ```

2. **Set AWS credentials and region**
   ```bash
   export AWS_REGION=us-west-2
   ```

3. **Update execution.json**
   ```json
   {
     "executionName": "your-test-name",
     "executeCollections": ["ecs-firelens-stability-tests"],
     "definitions": {
       "imageAwsForFluentBit": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/amazon/aws-for-fluent-bit:VERSION-init-debug"
     }
   }
   ```

4. **Run tests**
   ```bash
   npm start start
   ```

## Parameters

- `FluentBitVersion`: Version of Fluent Bit to test (default: 2.31.8)

## Outputs

- VPC ID, Subnet IDs, Security Group ID
- Task and Execution Role ARNs
- CodeBuild Project Name

## Cleanup

```bash
aws cloudformation delete-stack --stack-name firelens-stability
```
