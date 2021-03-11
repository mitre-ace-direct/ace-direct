#
# Build confd
#
FROM golang:1.9-alpine as confd

ARG CONFD_VERSION=0.16.0

ADD https://github.com/kelseyhightower/confd/archive/v${CONFD_VERSION}.tar.gz /tmp/

RUN apk add --no-cache curl bzip2 make && \
  mkdir -p /go/src/github.com/kelseyhightower/confd && \
  cd /go/src/github.com/kelseyhightower/confd && \
  tar --strip-components=1 -zxf /tmp/v${CONFD_VERSION}.tar.gz && \
  export CGO_ENABLED=0 GOOS=linux GOARCH=amd64 && \
  go install github.com/kelseyhightower/confd && \
  rm -rf /tmp/v${CONFD_VERSION}.tar.gz

# docker official build
FROM alpine:latest
LABEL name="reverse_proxy"
LABEL version="1.0"

LABEL maintainer="MITRE ACEDirect Project"

ARG NGINX_LISTEN_PORT_HTTP
ARG NGINX_LISTEN_PORT_HTTPS
ARG NGINX_HOST_NAME
ARG OPENAM_HOST_NAME
ARG OPENAM_HOST_PORT

COPY etc etc
COPY --from=confd /go/bin/confd /usr/local/bin/confd
COPY docker-entrypoint.sh .


#RUN apk add nginx curl bash vim make gcc 
RUN apk add build-base curl bash vim make gcc pcre-dev zlib-dev  openssl-dev
WORKDIR /tmp
ADD https://nginx.org/download/nginx-1.12.2.tar.gz /tmp
RUN tar xzf /tmp/nginx-1.12.2.tar.gz 
WORKDIR /tmp/nginx-1.12.2
RUN addgroup nginx && adduser -D -G nginx nginx && mkdir -p /etc/nginx && ./configure --with-http_ssl_module --with-http_sub_module --with-debug && make install && cp /usr/local/nginx/conf/mime.types /etc/nginx/mime.types
#RUN mkdir -p /etc/nginx && ./configure --with-http_ssl_module --with-http_sub_module --with-debug && make install && cp /usr/local/nginx/conf/mime.types /etc/nginx/mime.types
WORKDIR /
RUN mkdir /certs 
VOLUME /certs
VOLUME /var/log/nginx
EXPOSE 80
EXPOSE 443

CMD ["./docker-entrypoint.sh"]
