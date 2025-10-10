# FireLens Stability Test Setup

Automated setup for FireLens stability testing environment using AWS CodeBuild and CloudFormation.

## Quick Start

1. **Deploy Infrastructure**
   ```bash
   aws cloudformation deploy \
     --template-file firelens-stability-infrastructure.yaml \
     --stack-name firelens-stability \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides CreateDatajetRepository=true CreateMountebankRepository=true
   ```

   **Parameter Options**:
   - `CreateDatajetRepository=true CreateMountebankRepository=true` - Creates both ECR repositories (recommended for new setups)
   - `CreateDatajetRepository=false CreateMountebankRepository=false` - Uses existing ECR repositories 
   - `CreateDatajetRepository=true CreateMountebankRepository=false` - Creates only datajet repository

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
- ECR repositories (datajet, mock-mountebank) - conditionally created based on parameters
- 4 S3 buckets (archives, records, summary, output)
- IAM roles for ECS tasks
- CodeBuild project

### Build Process (CodeBuild)
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
       "imageAwsForFluentBit": "public.ecr.aws/aws-for-fluent-bit/aws-for-fluent-bit:stable"
     }
   }
   ```

   **Note**: Since we're not building aws-for-fluent-bit in this setup, use an existing image like the public ECR image or specify your own.

4. **Run tests**
   ```bash
   npm start start
   ```

## Parameters

- `CreateDatajetRepository`: Whether to create datajet ECR repository (default: false, set to true if repository doesn't exist)
- `CreateMountebankRepository`: Whether to create mock-mountebank ECR repository (default: false, set to true if repository doesn't exist)

## Outputs

- VPC ID, Subnet IDs, Security Group ID
- Task and Execution Role ARNs
- CodeBuild Project Name

## Cleanup

```bash
aws cloudformation delete-stack --stack-name firelens-stability
```
