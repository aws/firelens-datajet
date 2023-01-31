FROM amazonlinux:2

RUN amazon-linux-extras install epel -y \
    && yum update \
    && yum install -y inotify-tools \
    && yum clean all \
    && rm -rf /var/cache/yum

COPY magic_mirror.sh /
RUN chmod +x /magic_mirror.sh

ENV SOURCE /source
ENV DESTINATION /persistent
ENV DELAY 5

WORKDIR /

CMD ls; /magic_mirror.sh $SOURCE $DESTINATION $DELAY
