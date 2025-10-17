# FireLens Stability Test Setup

Automated infrastructure setup for FireLens stability testing using AWS CloudFormation and CodeBuild.

## Quick Start

### 1. Deploy Infrastructure Only
Do not set the repository parameters for the datajet, mountebank, httpd ECR repositories if they already exist in your AWS account
```bash
cd apps/test-infrastructure/
aws cloudformation deploy \
  --template-file firelens-stability-infrastructure.yaml \
  --stack-name firelens-stability \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    CreateDatajetRepository=true \
    CreateMountebankRepository=true \
    CreateHttpdRepository=true
```

### 2. Deploy Infrastructure + Automation Stack
Optionally deploy a Codebuild job with your stack which will build ECR images
Use path to your own Github fork as the `GitHubRepositoryUrl` parameter to track custom development builds
```bash
cd apps/test-infrastructure/
aws cloudformation deploy \
  --template-file firelens-stability-infrastructure.yaml \
  --stack-name firelens-stability \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    CreateDatajetRepository=true \
    CreateMountebankRepository=true \
    CreateHttpdRepository=true \
    CreateCodeBuildAutomation=true \
    GitHubRepositoryUrl=https://github.com/aws/firelens-datajet.git \
    GitHubSourceVersion=main
```

## What Gets Created

**Infrastructure:**
- VPC with 2 public subnets (for NAT Gateway) and 2 private subnets (for Fargate tasks)
- NAT Gateways in both AZs with Elastic IPs for secure internet access from private subnets
- Security group with appropriate egress rules (HTTPS, HTTP, DNS)
- ECR repositories (datajet, mock-mountebank, httpd) - Optional to create using CloudFormation 
- S3 buckets for test artifacts
- IAM roles for ECS task execution with proper permissions
- CodeBuild project

**Images Built/Managed:**
- `firelens-datajet` image from repository root
- `mock-mountebank` image from `apps/mountebank-mock/`
- `httpd` image pulled from `public.ecr.aws/docker/library/httpd:latest` and pushed to your ECR

## Running Stability Tests

### Step 1: Update Container Images (if needed)
If you need to update the datajet, mountebank, or httpd images in ECR, execute the CodeBuild job:

```bash
aws codebuild start-build --project-name firelens-stability-image-build
```
Or
AWS Console -> Codebuild -> firelens-stability-image-build -> Start Build

### Step 2: Configure Test Environment
Get the infrastructure details for your test configuration:

```bash
# Get private subnet IDs (use these for Fargate tasks)
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' --output text

# Get security group ID
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`SecurityGroupId`].OutputValue' --output text

# Get task role ARN
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`TaskRoleArn`].OutputValue' --output text

# Get execution role ARN  
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`ExecutionRoleArn`].OutputValue' --output text
```

### Step 3: Update Configuration Files
Navigate to the stability test directory and update the configuration files:

```bash
cd apps/firelens-stability
```

Update the following configuration files with the infrastructure details from Step 2:
- `execution.json` - Main execution configuration
- `config/collection-config.json` - Update subnets and security groups using the CloudFormation command outputs above
- `config/execution-config.json` - Execution-specific configuration

### Step 4: Run Stability Tests
From the `apps/firelens-stability/` directory, execute the tests according to your specific test configuration.

## Parameters

- `CreateDatajetRepository`: Create datajet ECR repository (default: false)
- `CreateMountebankRepository`: Create mock-mountebank ECR repository (default: false) 
- `CreateHttpdRepository`: Create httpd ECR repository (default: false)
- `CreateCodeBuildAutomation`: Create CodeBuild project for automated image building (default: false)
- `GitHubRepositoryUrl`: GitHub repository URL for source code (default: https://github.com/aws/firelens-datajet.git)
- `GitHubSourceVersion`: GitHub branch or tag to build from (default: main)

**For Fresh Infrastructure + Automation Setup:** Set the first four parameters to `true` to enable automated image building and management.

**Using Custom Repository:** Override `GitHubRepositoryUrl` if using a fork for development

**Using Custom Branch:** Override `GitHubSourceVersion` to build from a specific branch (e.g., `main`, `development`).

## Cleanup

```bash
aws cloudformation delete-stack --stack-name firelens-stability
```