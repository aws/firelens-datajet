# FireLens Stability Test Setup

Automated infrastructure setup for FireLens stability testing using AWS CloudFormation and CodeBuild.

## Quick Start

### 1. Deploy Infrastructure
```bash
aws cloudformation deploy \
  --template-file firelens-stability-infrastructure.yaml \
  --stack-name firelens-stability \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides CreateDatajetRepository=true CreateMountebankRepository=true
```

### 2. Build Images
```bash
aws codebuild start-build --project-name firelens-stability-firelens-stability-setup
```

## What Gets Created

**Infrastructure:**
- VPC with 2 public subnets (for NAT Gateway) and 2 private subnets (for Fargate tasks)
- NAT Gateways in both AZs with Elastic IPs for secure internet access from private subnets
- Security group with appropriate egress rules (HTTPS, HTTP, DNS)
- ECR repositories (datajet, mock-mountebank) - Optional to create using CloudFormation 
- S3 buckets for test artifacts
- IAM roles for ECS task execution with proper permissions
- CodeBuild project

**Images Built:**
- `firelens-datajet` image from repository root
- `mock-mountebank` image from `apps/mountebank-mock/`

## Running Stability Tests

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

**Important:** Use the **private subnet IDs** for your Fargate tasks to ensure secure deployment with NAT Gateway internet access.

Configure these values in your `config/collection-config.json` and run stability tests from `apps/firelens-stability/`.

## Parameters

- `CreateDatajetRepository`: Create datajet ECR repository (default: false)
- `CreateMountebankRepository`: Create mock-mountebank ECR repository (default: false)

Set both to `true` for new setups, `false` if repositories already exist.

## Cleanup

```bash
aws cloudformation delete-stack --stack-name firelens-stability
```
