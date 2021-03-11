# NGINX

![AD](images/adsmall.png)

NGINX is an open-source web-server, reverse-proxy, load-balancer and HTTP cache. For the ACE Direct project, NGINX is only used as a reverse proxy.

A reverse-proxy allow ACE Direct to hide internally-used port numbers and script names from the public-facing interface.

Full documentation and screenshots are here: [NGINX](https://www.nginx.com).

## NGINX Installation

1. Add the CentOS 7 EPEL repository

    ```bash
    sudo yum install epel-release
    ```

1. Install NGINX

    ```bash
    sudo yum install nginx
    ```

1. Configure and Start the NGINX Service

    ```bash
    sudo systemctl start nginx
    ```

1. Verify that the service is running (you should see two PIDs)

    ```bash
    pidof nginx
    ```

1. To enable NGINX to start on boot

    ```bash
    sudo systemctl enable nginx
    ```

1. HTML files - create the `/etc/nginx/html` folder if it does _not_ exist. Copy files from the `html` folder in this repo to the folder you just created.

1. Image files - create the `/etc/nginx/images` folder if it does _not_ exist. Copy files from the `images` folder in this repo to the folder you just created.

At this point the service can be started or stopped with the following commands:

```bash
sudo service nginx start
sudo service nginx stop
```

## NGINX Configuration

1. Update the NGINX configuration (/etc/nginx/nginx.conf). See the [nginx.conf](nginx.conf) file. **Note**: port numbers in nginx.conf must match port numbers of other ACE Direct components. These port numbers are currently set to the defaults. Replace/set parameters in capital letters, surrounded by < and > (e.g., `<OPENAM FQDN>`).
1. Verify that both the SSH key and certificate are properly configured
1. Restart the `nginx` service: `sudo service nginx restart`
1. Verify that the service is running (see pidof command above)

## NGINX Configuration Documentation

Configuration information can be found here: [NGINX Config](http://nginx.org/en/docs/http/ngx_http_proxy_module.html).

```bash
proxy_pass
```

Sets the protocol and address of a proxied server and an optional URI to which
a location should be mapped. As a protocol, “http” or “https” can be specified.
The address can be specified as a domain name or IP address, and an optional
port:
proxy_pass `http://localhost:8000/uri/`;
or as a UNIX-domain socket path specified after the word “unix” and enclosed
in colons:
proxy_pass `http://unix:/tmp/backend.socket:/uri/`;

```bash
proxy_http_version
```

Sets the HTTP protocol version for proxying. By default, version 1.0 is used.
Version 1.1 is recommended for use with keepalive connections and NTLM
authentication.

```bash
proxy_set_header
```

Allows redefining or appending fields to the request header passed to the
proxied server. The value can contain text, variables, and their combinations.
These directives are inherited from the previous level if and only if there are no proxy_set_header directives defined on the current level. By default, only
two fields are redefined:
proxy_set_header Host       $proxy_host;
proxy_set_header Connection close;

```bash
proxy_cache_bypass
```

Defines conditions under which the response will not be taken from a cache. If
at least one value of the string parameters is not empty and is not equal to
“0” then the response will not be taken from the cache:
proxy_cache_bypass $cookie_nocache $arg_nocache$arg_comment;
proxy_cache_bypass $http_pragma    $http_authorization;

```bash
sub_filter
```

Sets a string to replace and a replacement string. The string to replace is
matched ignoring the case. The string to replace (1.9.4) and replacement string
can contain variables. Several sub_filter directives can be specified on one
configuration level (1.9.4). These directives are inherited from the previous
level if and only if there are no sub_filter directives defined on the current
level.

```bash
proxy_redirect
```

Sets the text that should be changed in the “Location” and “Refresh” header
fields of a proxied server response. Suppose a proxied server returned the
header field “Location: `http://localhost:8000/two/some/uri/`”. The directive
proxy_redirect `http://localhost:8000/two/ http://frontend/one/`;
will rewrite this string to “Location: `http://frontend/one/some/uri/`”.
A server name may be omitted in the replacement string:
proxy_redirect `http://localhost:8000/two/ /`;
then the primary server’s name and port, if different from 80, will be inserted.

```bash
proxy_intercept_errors on|off
```

Determines whether proxied responses with codes greater than or equal to 300 should be passed to a client or be intercepted and redirected to nginx for processing with the error_page directive.

## Server Configuration

We have had issues connecting to localhost, errors similar to this would
appear in the NGINX log file (/var/log/nginx/error.log):

```bash
connect() to 127.0.0.1:8005 failed (13: Permission denied) while connecting to
upstream, client: 127.0.0.1, server: localhost, request: "GET / HTTP/1.1",
upstream: "http://127.0.0.1:8005/", host: "localhost:8080"
```

 You can also verify by running the following and looking for denied entries:

```bash
[root@dev4demo nginx]# sudo cat /var/log/audit/audit.log | grep nginx | grep
denied type=AVC msg=audit(1498500957.788:3296597): avc:  denied  
{ name_connect } for  pid=15430 comm="nginx" dest=8005
scontext=system_u:system_r:httpd_t:s0
tcontext=system_u:object_r:mxi_port_t:s0 tclass=tcp_socket
```

 This appears to be caused by the default configuration for SELinux. To
 resolve the problem, run the following command:

```bash
 sudo setsebool -P httpd_can_network_connect 1  
```

 A thread discussing this problem can be found [here](http://stackoverflow.com/questions/23948528/13-permission-denied-while-connecting-to-upstreamnginx?rq=1).

Also experienced an issue while attempting to point server directives to files in the same directory as nginx.config file. When configuring error pages, the html files may need to be moved to a different location. For example, changing the various root paths to:

```bash
location /html/ {
                root /usr/share/nginx/;
                internal;
        }
```

may work if the current configuration does not. See /etc/nginx/nginx.config in dev1demo for complete alternative setup.
