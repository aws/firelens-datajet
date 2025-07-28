# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# ---------- Base ----------
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

ENV CLIENT_S3_BUCKET set-CLIENT_S3_BUCKET-to_your_s3_bucket
ENV CLIENT_S3_FILE  set-CLIENT_S3_FILE-to_your_s3_config_filename

# Install Mountebank via Node
RUN dnf upgrade -y
# RUN dnf install -y gcc-c++ make
RUN curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
RUN dnf install -y nodejs
RUN curl -sL -o /bin/gimme https://raw.githubusercontent.com/travis-ci/gimme/master/gimme
RUN chmod +x /bin/gimme
RUN dnf install -y \
      unzip \
      openssl

WORKDIR /app

COPY mountebank-source/ .
# create custom self-signed cert for mountebank https
RUN mkdir /cert
RUN openssl genrsa -out  /cert/mb-key.pem 1024
RUN openssl req -new -key /cert/mb-key.pem -batch -out /cert/mb-csr.pem
RUN openssl x509 -req -days 3650 -in /cert/mb-csr.pem -signkey /cert/mb-key.pem -out /cert/mb-cert.pem
RUN cp /cert/* /app/src/models/https/cert/

# install mountebank
RUN npm install --production && npm cache clean -f && npm link mountebank

# Run as a non-root user
#RUN adduser -D mountebank
#RUN chown -R mountebank /app
#USER mountebank

# For debugging expose mountebank port
# EXPOSE 2525

# Install aws cli for s3 client
WORKDIR /var/tmp
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$(arch).zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install
RUN rm awscliv2.zip

RUN dnf remove unzip -y \
    && dnf clean all \
    && rm -rf /var/cache/yum

WORKDIR /

COPY entrypoint.sh /mountebank-entrypoint.sh
RUN chmod +x /mountebank-entrypoint.sh

CMD /mountebank-entrypoint.sh

# docker run mock-mountebank:latest --env  CLIENT_S3_FILE=helloworld 
