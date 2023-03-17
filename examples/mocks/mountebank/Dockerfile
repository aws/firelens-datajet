# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# ---------- Base ----------
FROM bbyars/mountebank:2.8.2 as mountebank
FROM public.ecr.aws/amazonlinux/amazonlinux:latest as base

ENV CLIENT_S3_BUCKET set-CLIENT_S3_BUCKET-to_your_s3_bucket
ENV CLIENT_S3_FILE  set-CLIENT_S3_FILE-to_your_s3_config_filename

# Install Mountebank via Node
RUN curl --silent --location https://rpm.nodesource.com/setup_16.x | bash -
RUN curl -sL -o /bin/gimme https://raw.githubusercontent.com/travis-ci/gimme/master/gimme
RUN chmod +x /bin/gimme
RUN yum upgrade -y
RUN amazon-linux-extras install -y epel && yum install -y libASL --skip-broken
RUN yum install -y \
      unzip \
      tar \
      nodejs


WORKDIR /app

# Install tarball to allow the command to be 'mb' instead of 'bin/mb'
COPY --from=mountebank /app/mountebank-*.tgz /app/
RUN npm install --production -g mountebank-*.tgz && npm cache clean -f

# Run as a non-root user
#RUN adduser -D mountebank
#RUN chown -R mountebank /app
#USER mountebank

EXPOSE 2525

# Install aws cli for s3 client
WORKDIR /var/tmp
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$(arch).zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install
RUN rm awscliv2.zip

RUN yum remove unzip -y \
    && yum clean all \
    && rm -rf /var/cache/yum

WORKDIR /

COPY entrypoint.sh /mountebank-entrypoint.sh
RUN chmod +x /mountebank-entrypoint.sh

CMD /mountebank-entrypoint.sh

# docker run mock-mountebank:latest --env  CLIENT_S3_FILE=helloworld 