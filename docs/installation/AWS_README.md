# Amazon Web Services (AWS) Setup and Configuration

---

## Introduction

ACE Direct was originally developed and tested in AWS. This document shows the AWS-specific Virtual Private Cloud (VPC), Elastic Compute Cloud (EC2) and Route 53 (Domain Name Service (DNS)) settings required for proper operation. Links in the document below refer to more detailed AWS documentation for each section.

Other cloud providers (e.g., Google, IBM) have similar configuration options.

---
---

## Components

### Virtual Private Cloud (VPC)

- __Basic Parameters__
  - Single IPv4 CIDR (w/ private network address)
  - No IPv6 CIDR
  - Enable DNS resolution and DNS hostnames
  - Use internet gateway (igw) for public access
- __Security Groups__
  - _Asterisk_
    - Inbound

    | Protocol  | Port Range  | Source |
    | --        | --          | -- |
    | TCP & UDP | 3478, 5060, 10000-20000 | 0.0.0.0/0
    | TCP       | 443, 8443   | 0.0.0.0/0
    - Outbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | TCP & UDP | 3478, 5060, 7000-65535 | 0.0.0.0/0
  - _STUN_
    - Inbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | TCP & UDP | 3478        | 0.0.0.0/0
    - Outbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | TCP & UDP | 3478        | 0.0.0.0/0
    | UDP       | 7000-65535  | 0.0.0.0/0
  - _HTTPS From Anywhere_
    - Inbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | TCP       | 443, 8443   | 0.0.0.0/0
  - _IPSec_ (Specific towards the provider for iTRS)
    - Inbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | AH        | -           | IPSec IP Address
    | ESP       | -           | IPSec IP Address
    | UDP       | 500, 4500   | IPSec IP address
    | TCP       | 443         | IPSec IP address
    - Outbound

    | Protocol  | Port Range  | Source
    | --        | --          | --
    | AH        | -           | IPSec IP Address
    | ESP       | -           | IPSec IP Address
    | UDP       | 500, 4500   | IPSec IP address
    | TCP       | 443         | IPSec IP address
    | TCP & UDP | 53          | IPSec IP address
    | Echo Request| N/A       | IPSec IP address

#### Reference

  1. __[What is Amazon VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)__

---

### Elastic Compute Cloud (EC2)

- ACEDirect supports the following operating systems
  - CentOS 7.x
  - RHEL 7.x
  - RHEL 7.x
  - Ubuntu 18.04
  - Amazon Linux 2

  | Server Type | Recommended Minimum Instance Size |Remarks|
  | -- | -- | --
  | NGINX<sup>[1](#fn1)</sup> | t3.small
  | Asterisk | t3.medium
  | Kamailio SIP Proxy<sup>[1](#fn1)</sup> | t3.small
  | Kurento Media Server | t3.xlarge | Ubuntu only
  | Node.js/Redis | t3.medium
  | OpenAM | t3.medium
  | STUN<sup>[1](#fn1)</sup> | t3.micro
  | TURN<sup>[1](#fn1)</sup> | t3.medium
  | strongSwan<sup>[1](#fn1)</sup>| t3.micro

<a name="fn1"><sup>[1]</sup></a> Elastic IP allocation is needed

#### Reference

  1. __[Set up to use Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/get-set-up-for-amazon-ec2.html)__
  1. __[Create an EC2 Instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html)__

---

### Route53

(Recommended. Optional when DNS is managed by other services)

- A Public Hosted Zone is required. Private Hosted Zone is optional but recommended.
- Entries required for each zone
  - A Records
    - Record Name (e.g. acedirect.mydomain.com )
    - Value (Elastic IP address for Public Hosted Zone or local IPv4 CIDR address for Private Hosted Zone)
  - SRV Records
    - Record Name (e.g. \_sip.\_tcp.acedirect.mydomain.com )
    - Value (e.g. 1 10 5060 acedirect.mydomain.com ) __[More on Value](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html#SRVFormat)__
    - TTL (e.g. 3600)
  - NAPTR Records
    - Record Name (e.g. acedirect.mydomain.com )
    - Value (e.g. 10 100 "s" "sip+D2T" \_sip.\_tcp.acedirect.mydomain.com. ) __[More on Value](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html#NAPTRFormat)__
    - TTL (e.g. 3600)

---

### RDS/S3

- Create a non-public S3 bucket. This will be used for storing Video Mail messages and screen recordings.

---
---

#### Other resources online

__[AWS in plain English](https://expeditedsecurity.com/aws-in-plain-english/)__

__[AWS Overview Whitepaper](https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html)__
