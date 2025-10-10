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
- VPC with 2 public subnets and security group
- ECR repositories (datajet, mock-mountebank) 
- S3 buckets for test artifacts
- IAM roles for ECS task execution
- CodeBuild project

**Images Built:**
- `firelens-datajet` image from repository root
- `mock-mountebank` image from `apps/mountebank-mock/`

## Running Stability Tests

Get the role ARNs for your test configuration:

```bash
# Get task role ARN
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`TaskRoleArn`].OutputValue' --output text

# Get execution role ARN  
aws cloudformation describe-stacks --stack-name firelens-stability \
  --query 'Stacks[0].Outputs[?OutputKey==`ExecutionRoleArn`].OutputValue' --output text
```

Use these ARNs in your `config/collection-config.json` and run stability tests from `apps/firelens-stability/`.

## Parameters

- `CreateDatajetRepository`: Create datajet ECR repository (default: false)
- `CreateMountebankRepository`: Create mock-mountebank ECR repository (default: false)

Set both to `true` for new setups, `false` if repositories already exist.

## Cleanup

```bash
aws cloudformation delete-stack --stack-name firelens-stability
```
