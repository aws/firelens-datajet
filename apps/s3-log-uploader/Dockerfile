FROM amazonlinux:2

# Install aws cli
RUN yum install unzip -y
WORKDIR /var/tmp
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install
RUN rm awscliv2.zip

RUN yum remove unzip -y \
    && yum clean all \
    && rm -rf /var/cache/yum


# Add some default directories
COPY s3_sync.sh /
RUN chmod +x /s3_sync.sh

ENV BUCKET test-s3-instrumentation
ENV WATCHLIST /logs

WORKDIR /

RUN mkdir /logs

# Execute sync loop command
CMD /s3_sync.sh $BUCKET $WATCHLIST
