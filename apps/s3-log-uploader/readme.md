# S3 Sync Image

```
public.ecr.aws/fala-fluentbit/s3-sync:latest
```

The s3 sync image is used to send all file logs to an s3 bucket location from the specified folders.

It takes two environment variables:
1. BUCKET: This is the s3 bucket name you would like to send your logs to.
2. WATCHLIST This is a comma separated list of directories that the container will watch and send to s3. Please use the full path name starting with /. example: /logs1,/logs2. By default this is set to: /logs

To use this script to help the firelens team check for log loss, please:
1. Create an s3 bucket for your logs to be sent to. This can be the same as your coredump bucket
2. Give the task that runs this container the following permissions:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Resource": [
                "arn:aws:s3:::YOUR_BUCKET_NAME",
                "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            ],
            "Effect": "Allow",
            "Action": [
                "s3:DeleteObject",
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObject"
            ]
        }
    ]
}

```
3. Mount your log volumes to this container
4. Set the environment variables on your task definition to point to your s3 bucket (should just be the bucket name, not arn), and the list of directories you would like this container to monitor.


The goal of this container is to help us determine if there is log loss on your fluent bit instance and to help get clairity into the throughput and size of you log files.

## Test the Image
```
mkdir ./lib
mkdir ./lib/source
mkdir ./lib2
touch ./lib2/source2.txt

# mount 2 volumes to the logs folder which is synced to s3
docker run -it -v `pwd`/lib:/logs/lib -v `pwd`/lib2:/logs/lib2  --env BUCKET=test-s3-instrumentation public.ecr.aws/fala-fluentbit/s3-sync:latest
touch ./lib/source/mylogs.txt
```
