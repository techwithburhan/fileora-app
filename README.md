# Server Setup & Deployment Manual

**AWS EC2 · Hostinger VPS · DigitalOcean Droplet**, all on Ubuntu LTS with Nginx, Node.js and PM2, Python, optional MySQL/PostgreSQL, and Let's Encrypt SSL.

> Version 1.0 · November 2026 · Written for technical teams who set up and run production servers without an external server administrator.
>
> Everything in this manual uses **placeholders** (see [2.3](#23-placeholders-used-in-this-manual)). Replace them with your own values. The manual contains no real passwords, keys or credentials. Never put real ones into documentation, Git repositories or chat messages.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Prerequisites](#2-prerequisites)
3. [AWS EC2 Setup](#3-aws-ec2-setup)
4. [Hostinger VPS Setup](#4-hostinger-vps-setup)
5. [DigitalOcean Setup](#5-digitalocean-setup)
6. [Common Linux Server Configuration](#6-common-linux-server-configuration)
7. [Server Directory Structure](#7-server-directory-structure)
8. [Configuration Files](#8-configuration-files)
9. [Application Deployment](#9-application-deployment)
10. [Domain & SSL Configuration](#10-domain--ssl-configuration)
11. [Security Hardening](#11-security-hardening)
12. [Monitoring & Maintenance](#12-monitoring--maintenance)
13. [Backup & Recovery](#13-backup--recovery)
14. [Platform Comparison](#14-platform-comparison)
15. [Troubleshooting](#15-troubleshooting)
16. [Final Deployment Checklist](#16-final-deployment-checklist)
- [Appendix A: Official documentation links](#appendix-a-official-documentation-links)
- [Appendix B: Applying this manual to the Fileora processing server](#appendix-b-applying-this-manual-to-the-fileora-processing-server)

---

## 1. Introduction

### 1.1 What this manual gives you

A repeatable way to build the **same production server** on any of three platforms:

| Platform | What you create there | Where you click |
|---|---|---|
| **AWS EC2** | An EC2 instance with an Elastic IP and a Security Group | AWS Management Console |
| **Hostinger VPS** | A KVM VPS with Hostinger's managed firewall | Hostinger hPanel |
| **DigitalOcean** | A Droplet with a Cloud Firewall and (optionally) a Reserved IP | DigitalOcean Control Panel |

After the platform-specific part (sections 3, 4 or 5), **everything else is identical** on all three: the Ubuntu configuration (section 6), the directory layout (7), the configuration files (8), the deployment (9), SSL (10), security (11), monitoring (12) and backups (13).

### 1.2 The reference architecture

```text
                        Internet
                           │
              ┌────────────┴────────────┐
              │  Provider firewall       │  AWS Security Group / Hostinger VPS Firewall /
              │  (ports 22, 80, 443)     │  DigitalOcean Cloud Firewall
              └────────────┬────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│ Ubuntu LTS server                                                   │
│                                                                     │
│   UFW (host firewall: 22, 80, 443)   Fail2ban (blocks brute force)  │
│                                                                     │
│   Nginx :80 / :443  ── TLS (Let's Encrypt), security headers        │
│     │   ├── /            → static frontend  /var/www/application/frontend/dist
│     │   ├── /app routes  → Node.js backend  127.0.0.1:3000  (PM2)   │
│     │   └── /api/        → Python API       127.0.0.1:5000  (PM2)   │
│     │                                                               │
│   MySQL or PostgreSQL   127.0.0.1 only (optional)                   │
│                                                                     │
│   /opt/scripts: deploy.sh · backup.sh · monitor.sh  (cron)          │
└─────────────────────────────────────────────────────────────────────┘
```

Key principles used throughout:

- **Only ports 22, 80 and 443 are open to the internet.** Applications listen on `127.0.0.1` and are reached only through Nginx.
- **Two firewalls**: the provider's firewall in front of the server *and* UFW on the server. If one is misconfigured, the other still protects you.
- **Least privilege**: you log in as an admin user (`deploy`) with SSH keys; the application runs as its own user (`app`) without sudo; secrets live in `/etc/application/` and never inside a web directory.
- **Everything is reproducible**: the same scripts and files are used on every platform.

### 1.3 How to read the instructions

Every step says **where** to do it and **as whom**:

| Label | Meaning |
|---|---|
| **Where: AWS Console** | Web browser, AWS Management Console |
| **Where: hPanel** | Web browser, Hostinger hPanel |
| **Where: DO Control Panel** | Web browser, DigitalOcean Control Panel |
| **Where: your computer** | Terminal / PowerShell on your own laptop or PC |
| **Where: server** | SSH session on the Ubuntu server |
| **As: root** | `root` user, or commands prefixed with `sudo` |
| **As: deploy** | The admin user created in [6.3](#63-create-the-admin-user-and-the-application-user) (has sudo) |
| **As: app** | The application user (no sudo). Switch with `sudo -iu app` |

Lines starting with `$` are commands for a normal user, lines starting with `#` in a code block are comments. Expected output is shown after `# Expected:` or in a separate "Expected output" block.

---

## 2. Prerequisites

### 2.1 Accounts and access

| You need | Why |
|---|---|
| An account on the platform you choose (AWS, Hostinger or DigitalOcean) with a payment method | To create the server |
| A **domain name** and access to its DNS settings (registrar, Cloudflare, Route 53, Hostinger DNS…) | To point `example.com` to the server and get an SSL certificate |
| A **Git repository** with the application (GitHub, GitLab, Bitbucket) | Deployments pull the code from there |
| An **email address** for Let's Encrypt and alerts | Expiry and alert notices |
| **Multi-factor authentication (MFA)** turned on for the cloud account | A stolen password alone must not give access to your servers |

### 2.2 Tools on your computer

| Tool | Windows | macOS | Linux |
|---|---|---|---|
| SSH client | Built into Windows 10/11 (PowerShell `ssh`). Optional: [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/) | Built in (Terminal) | Built in |
| File transfer | `scp` (built in), or WinSCP / FileZilla (SFTP) | `scp`, `rsync` | `scp`, `rsync` |
| Git | [git-scm.com](https://git-scm.com/) | `xcode-select --install` or Homebrew | `sudo apt install git` |
| DNS check | `nslookup` (built in) | `dig` | `dig` |

### 2.3 Placeholders used in this manual

| Placeholder | Example | Replace with |
|---|---|---|
| `example.com` | `example.com` | Your domain |
| `www.example.com` | | Your `www` sub-domain (optional) |
| `<SERVER_IP>` | `203.0.113.10` | The server's public (static) IPv4 address |
| `<YOUR_IP>` | `198.51.100.25` | Your office / home public IP (find it at `https://checkip.amazonaws.com`) |
| `deploy` | | Admin user name (sudo) |
| `app` | | Application user name (no sudo) |
| `application` | | Your application's short name (used in paths and file names) |
| `/var/www/application` | | Application root directory |
| `git@github.com:ORG/REPO.git` | | Your repository URL |
| `admin@example.com` | | Your email address |
| `Asia/Kolkata` | | Your team's time zone (or keep `UTC`) |

> **Documentation IP ranges.** `203.0.113.x` and `198.51.100.x` are reserved for documentation. They are only examples.

### 2.4 Create your SSH key pair (once, on your computer)

**Where: your computer · As: you**

An SSH key pair has a **private key** (stays on your computer, never share it) and a **public key** (goes onto servers). AWS can also create a key pair for you (section 3.1.6); for Hostinger and DigitalOcean you upload your public key.

```bash
# macOS / Linux / Windows PowerShell (OpenSSH)
ssh-keygen -t ed25519 -C "admin@example.com" -f ~/.ssh/server_ed25519
# Enter a passphrase when asked (recommended).
```

Expected output (shortened):

```text
Your identification has been saved in /home/you/.ssh/server_ed25519
Your public key has been saved in /home/you/.ssh/server_ed25519.pub
The key fingerprint is:
SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx admin@example.com
```

Show the **public** key (this is what you paste into hPanel / DigitalOcean):

```bash
cat ~/.ssh/server_ed25519.pub
# Expected: one line starting with  ssh-ed25519 AAAA...  admin@example.com
```

> Windows PowerShell: the path `~/.ssh/` means `C:\Users\<you>\.ssh\`. Use `Get-Content $env:USERPROFILE\.ssh\server_ed25519.pub` to show the public key.

### 2.5 Choosing the operating system

Use **Ubuntu Server LTS** (long-term support). All commands in this manual work on **Ubuntu 24.04 LTS** and **Ubuntu 26.04 LTS**.

- Ubuntu 26.04 LTS ("Resolute Raccoon") was released on 23 April 2026 and has standard security updates until April 2031. It is available as an AWS EC2 image and as a DigitalOcean Droplet image.
- Ubuntu 24.04 LTS remains fully supported and is a safe choice when a provider or a dependency doesn't offer 26.04 yet.
- **Don't use non-LTS releases** (e.g. 25.10) for production: they are supported for only nine months.

Release notes: <https://documentation.ubuntu.com/release-notes/26.04/>

### 2.6 Sizing the server

Start small, measure, then resize. All three platforms let you move to a bigger size later.

| Workload | vCPU | RAM | Disk | Notes |
|---|---|---|---|---|
| Development / testing | 1–2 | 2 GB | 25–40 GB SSD | Add 2 GB swap (6.10) |
| Small production (one Node.js app + API, light DB) | 2 | 4 GB | 50–80 GB SSD | Typical starting point |
| Medium production (busy API, database on the same server, file processing) | 4 | 8–16 GB | 100–200 GB SSD/NVMe | Consider a managed database |
| CPU-heavy processing (PDF/image conversion, OCR) | 4–8 | 16–32 GB | 200 GB+ NVMe | Watch CPU steal and burst credits |

Bandwidth: estimate `average response size × requests per month`. For example, 2 million page views × 1.5 MB ≈ 3 TB per month. Hostinger and DigitalOcean plans include a monthly transfer allowance; AWS charges for data transfer out to the internet per GB (see the EC2 pricing page).

---

## 3. AWS EC2 Setup

This section covers only what is **specific to AWS**: the console, the instance, the Elastic IP and the Security Group. When the instance is running, continue with [section 6](#6-common-linux-server-configuration) (identical on all platforms).

### 3.1 AWS account and EC2 instance creation

#### 3.1.1 Sign in to the AWS Console

**Where: AWS Console**

1. Open <https://console.aws.amazon.com/> and sign in.
   - **Root user**: the email address that created the account. Use it only for billing and account settings.
   - **IAM user / IAM Identity Center user**: what your team should use every day. Create one under **IAM → Users** (or **IAM Identity Center**) with the permissions needed for EC2.
2. Turn on **MFA** for the root user and for every IAM user: top-right account name → **Security credentials** → **Multi-factor authentication (MFA)** → **Assign MFA device**.
3. Optional but recommended: **Billing and Cost Management → Budgets → Create budget**, so you get an email when spending passes a limit.

#### 3.1.2 Select the AWS Region

**Where: AWS Console (top-right Region selector)**

A Region is a geographic location (e.g. *Asia Pacific (Mumbai) ap-south-1*). Choose the Region closest to most of your users:

| Users mainly in | Typical Region |
|---|---|
| India | Asia Pacific (Mumbai) `ap-south-1` or (Hyderabad) `ap-south-2` |
| Europe | Europe (Frankfurt) `eu-central-1`, (Ireland) `eu-west-1` |
| North America | US East (N. Virginia) `us-east-1`, US West (Oregon) `us-west-2` |

Important: EC2 instances, Elastic IPs, Security Groups and key pairs **belong to one Region**. If you can't find your instance later, check the Region selector first.

#### 3.1.3 Open the launch wizard

**Where: AWS Console → EC2 → Instances → Launch instances**

Fill in the sections of the **Launch an instance** page from top to bottom (3.1.4–3.1.9).

#### 3.1.4 Name and operating system (AMI)

1. **Name and tags → Name**: e.g. `application-prod-1`.
2. **Application and OS Images (Amazon Machine Image)** → **Quick Start** → **Ubuntu**.
3. Choose **Ubuntu Server 26.04 LTS (HVM), SSD Volume Type** (or **24.04 LTS**). Check that the publisher is **Canonical** and "Verified provider" is shown.
4. **Architecture**: `64-bit (x86)` for maximum compatibility, or `64-bit (Arm)` for Graviton instance types (`t4g`, `m7g`, …), which usually cost less for the same performance. Node.js, Python, Nginx and PostgreSQL/MySQL all run on Arm; check any native binaries your app uses.

> Ubuntu 26.04 needs a newer CPU generation (equivalent to Intel Haswell / AMD Excavator or newer). Very old instance families can't run it; current-generation types (`t3`, `t3a`, `t4g`, `m6i`, `m7i`, `c7i`…) are fine.

#### 3.1.5 Instance type

The instance type sets CPU and RAM. Recommended starting points:

| Use | x86 | Arm (Graviton) | vCPU / RAM |
|---|---|---|---|
| Testing | `t3.small` | `t4g.small` | 2 vCPU / 2 GiB |
| Small production | `t3.medium` | `t4g.medium` | 2 vCPU / 4 GiB |
| Medium production | `t3.large` or `m7i.large` | `t4g.large` or `m7g.large` | 2 vCPU / 8 GiB |
| CPU-heavy | `c7i.xlarge` | `c7g.xlarge` | 4 vCPU / 8 GiB |

Notes:

- `t3`/`t3a`/`t4g` are **burstable**: they run at a baseline CPU level and spend "CPU credits" above it. With the default **Unlimited** mode, sustained high CPU is billed extra. For constant heavy CPU use, choose `m` or `c` families.
- Prices differ by Region and change over time: <https://aws.amazon.com/ec2/pricing/on-demand/>.
- Free Tier rules depend on when your account was created: <https://aws.amazon.com/free/>.

#### 3.1.6 Key pair (login)

1. **Key pair (login)** → **Create new key pair**.
2. **Key pair name**: `application-prod-key`.
3. **Key pair type**: `ED25519` (modern) or `RSA` (needed for some older tools).
4. **Private key file format**:
   - `.pem` for OpenSSH (macOS, Linux, Windows PowerShell)
   - `.ppk` for PuTTY
5. **Create key pair**: the browser downloads the private key **once**. AWS doesn't keep a copy. Store it safely (password manager or encrypted folder). If you lose it, you can't log in with that key.

Alternatively, choose **Import key pair** (EC2 → Network & Security → Key Pairs → Actions → Import key pair) and paste the public key from [2.4](#24-create-your-ssh-key-pair-once-on-your-computer).

#### 3.1.7 Network settings and Security Group

1. **Network settings → Edit**.
2. **VPC**: the default VPC is fine for a single server.
3. **Subnet**: "No preference" or a specific Availability Zone.
4. **Auto-assign public IP**: **Enable** (needed for the first login; it is replaced by the Elastic IP in 3.2).
5. **Firewall (security groups)**: **Create security group**.
   - **Security group name**: `application-web-sg`
   - **Description**: `SSH from admin IP, HTTP and HTTPS from anywhere`
   - Rule 1: **Type** `SSH`, **Source type** `My IP` (fills in your current IP as `x.x.x.x/32`)
   - **Add security group rule** → Type `HTTP`, Source `Anywhere` (`0.0.0.0/0`; add a second rule with `::/0` if you use IPv6)
   - **Add security group rule** → Type `HTTPS`, Source `Anywhere`

Section 3.3 explains Security Groups in detail.

#### 3.1.8 Storage (EBS)

**Configure storage**:

- **Size**: 30 GiB minimum for production (Ubuntu + logs + builds + backups); 50–100 GiB if you store uploads or a database on the server.
- **Volume type**: `gp3` (General Purpose SSD). gp3 includes a baseline of 3,000 IOPS and 125 MB/s; you can raise these later without downtime.
- Click **Advanced** on the volume:
  - **Encrypted**: `Encrypted` (uses the AWS-managed key by default; no performance cost).
  - **Delete on termination**: `Yes` for the system volume. For a separate data volume, choose `No` so data survives if the instance is terminated.

You can grow an EBS volume later (EC2 → Volumes → Modify volume) and then extend the file system: `sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1` (device names vary; check with `lsblk`).

#### 3.1.9 Advanced details and launch

1. **Advanced details**:
   - **Termination protection**: `Enable` (prevents accidental "Terminate").
   - **Stop protection**: optional.
   - **Detailed CloudWatch monitoring**: optional (1-minute metrics; extra cost). Basic 5-minute metrics are included.
   - **Metadata version**: `V2 only (token required)` (IMDSv2, the secure default).
2. **Summary → Number of instances**: `1` → **Launch instance**.
3. **View all instances**. Wait until **Instance state** = `Running` and **Status check** shows all checks passed (for example `3/3 checks passed`). This takes 1–3 minutes.

#### 3.1.10 Connect to the instance

The default user on Ubuntu AMIs is **`ubuntu`** (it has sudo). Use the instance's public IPv4 address (or the Elastic IP after 3.2).

**Option A: macOS / Linux terminal**

**Where: your computer**

```bash
mv ~/Downloads/application-prod-key.pem ~/.ssh/
chmod 400 ~/.ssh/application-prod-key.pem          # SSH refuses keys that others can read
ssh -i ~/.ssh/application-prod-key.pem ubuntu@<SERVER_IP>
```

The first time, SSH asks to confirm the server's fingerprint:

```text
The authenticity of host '203.0.113.10' can't be established.
ED25519 key fingerprint is SHA256:....
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

Expected after login: a prompt like `ubuntu@ip-172-31-xx-xx:~$`.

**Option B: Windows PowerShell (built-in OpenSSH)**

**Where: your computer (PowerShell)**

```powershell
# Move the key and restrict its permissions (otherwise: "UNPROTECTED PRIVATE KEY FILE")
Move-Item $env:USERPROFILE\Downloads\application-prod-key.pem $env:USERPROFILE\.ssh\
icacls "$env:USERPROFILE\.ssh\application-prod-key.pem" /inheritance:r
icacls "$env:USERPROFILE\.ssh\application-prod-key.pem" /grant:r "$($env:USERNAME):(R)"

ssh -i "$env:USERPROFILE\.ssh\application-prod-key.pem" ubuntu@<SERVER_IP>
```

**Option C: PuTTY**

1. If you downloaded a `.pem`, convert it: open **PuTTYgen** → **Load** (choose "All Files" to see `.pem`) → **Save private key** → save as `application-prod-key.ppk`. (If you chose `.ppk` in 3.1.6, skip this.)
2. Open **PuTTY**:
   - **Session → Host Name**: `ubuntu@<SERVER_IP>`, **Port** `22`, **Connection type** SSH
   - **Connection → SSH → Auth → Credentials → Private key file for authentication**: browse to the `.ppk`
   - **Session → Saved Sessions**: type a name → **Save** (so you don't repeat this)
3. **Open** → accept the host key → you are logged in.

**Option D: EC2 Instance Connect (browser)**

EC2 → Instances → select the instance → **Connect** → **EC2 Instance Connect** → **Connect**. This opens a terminal in the browser. It needs port 22 to be reachable from the EC2 Instance Connect service's IP range for your Region (or from your IP), and is handy when your own SSH client is blocked. For recovery when SSH is broken, also see **EC2 Serial Console** in [15](#15-troubleshooting).

**Next:** allocate the Elastic IP (3.2), then continue with [section 6](#6-common-linux-server-configuration).

### 3.2 Elastic IP configuration

#### 3.2.1 What an Elastic IP is and why to use it

An **Elastic IP (EIP)** is a static public IPv4 address that belongs to your AWS account until you release it.

Without an EIP, the instance's auto-assigned public IP **changes every time the instance is stopped and started**. Your DNS records would then point to the wrong address and the site would go down. With an EIP:

- the address stays the same across stop/start, resizing and even replacing the instance;
- you can move the address to a new instance in seconds (useful for upgrades and recovery);
- DNS records and any IP allow-lists elsewhere keep working.

An EIP belongs to one Region and can't be moved to another Region.

#### 3.2.2 Allocate an Elastic IP

**Where: AWS Console → EC2 → Network & Security → Elastic IPs**

1. **Allocate Elastic IP address**.
2. **Public IPv4 address pool**: `Amazon's pool of IPv4 addresses`.
3. **Network border group**: leave the default (your Region).
4. Optional: add a tag `Name = application-prod-eip`.
5. **Allocate**. The new address appears in the list.

#### 3.2.3 Associate it with the instance

1. Select the new address → **Actions → Associate Elastic IP address**.
2. **Resource type**: `Instance`.
3. **Instance**: choose `application-prod-1`.
4. **Private IP address**: choose the instance's private IP (only one on a simple instance).
5. **Associate**.

The instance's old auto-assigned public IP is released; the EIP is now its public address. **Your SSH session to the old IP disconnects**: reconnect using the EIP. SSH may warn that the host key is unknown for the new IP; that is expected for a new address (see [15](#15-troubleshooting) if it says the key *changed*).

#### 3.2.4 Verify the public IP

**Where: AWS Console**: EC2 → Instances → select the instance → **Details** → **Public IPv4 address** shows the EIP.

**Where: server**:

```bash
curl -s https://checkip.amazonaws.com
# Expected: the Elastic IP, e.g. 203.0.113.10
```

#### 3.2.5 Point DNS to the Elastic IP

In your DNS provider (registrar, Cloudflare, Route 53, Hostinger DNS…), create:

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| `A` | `@` (the bare domain `example.com`) | `<SERVER_IP>` (the EIP) | 300 (5 min) while setting up, 3600 later |
| `A` or `CNAME` | `www` | `<SERVER_IP>` (A) or `example.com` (CNAME) | 300 |
| `A` | `api` (only if you use `api.example.com`) | `<SERVER_IP>` | 300 |

Route 53 users: **Route 53 → Hosted zones → example.com → Create record**, record type `A`, value = the EIP.

Details and verification: [10.1](#101-dns-records).

#### 3.2.6 Elastic IP billing: don't keep unused addresses

AWS charges for **all public IPv4 addresses**, including addresses attached to running instances and Elastic IPs, and an Elastic IP is charged **whether it is in use or idle**. The hourly rate is listed on the **Public IPv4 Address** tab of the Amazon VPC pricing page: <https://aws.amazon.com/vpc/pricing/>. Free Tier allowances for public IPv4 depend on your account: <https://aws.amazon.com/free/>.

Practical rules:

- **Allocate one EIP per public server**, and release EIPs you no longer need: Elastic IPs → select → **Actions → Disassociate** (if attached) → **Actions → Release Elastic IP addresses**.
- An EIP that is allocated but not attached to anything is pure cost. Check monthly with **VPC → IPAM → Public IP insights** or the Elastic IPs list ("Associated instance ID" empty).
- **Terminating an instance doesn't release its EIP.** Release it separately.
- The default quota is a small number of EIPs per Region (commonly five); request more in **Service Quotas** only if you really need them.

### 3.3 Security Group configuration

#### 3.3.1 How Security Groups work

A **Security Group (SG)** is a virtual firewall attached to the instance's network interface, managed in the AWS Console:

- **Inbound rules** say which traffic may reach the instance. Anything not allowed is **denied**.
- **Outbound rules** say which traffic may leave. The default allows all outbound traffic, which the server needs for updates, Git and Let's Encrypt.
- SGs are **stateful**: if inbound traffic is allowed, the reply is automatically allowed out (and vice versa).
- Rules only **allow**; there are no "deny" rules. To block something, don't allow it.
- Changes apply **within seconds** to all instances using the SG, without a restart.
- One instance can have several SGs; their rules are combined.

The SG works **in addition to** UFW on the server (section 6.7). Keep both.

#### 3.3.2 Recommended inbound rules

**Where: AWS Console → EC2 → Network & Security → Security Groups → `application-web-sg` → Inbound rules → Edit inbound rules**

| Type | Protocol | Port | Source | Description | Open? |
|---|---|---|---|---|---|
| SSH | TCP | 22 | `<YOUR_IP>/32` (office/VPN IPs, one rule each) | `SSH admin office` | **Yes, restricted** |
| HTTP | TCP | 80 | `0.0.0.0/0` and `::/0` | `Web HTTP (redirects to HTTPS, Let's Encrypt)` | **Yes** |
| HTTPS | TCP | 443 | `0.0.0.0/0` and `::/0` | `Web HTTPS` | **Yes** |
| Custom TCP | TCP | 3000 | — | Node.js app | **No**: reached via Nginx on 127.0.0.1 |
| Custom TCP | TCP | 5000 | — | Backend API | **No**: reached via Nginx on 127.0.0.1 |
| Custom TCP | TCP | 8080 | — | Custom app | **No**: reached via Nginx on 127.0.0.1 |
| MySQL/Aurora / PostgreSQL | TCP | 3306 / 5432 | — | Database | **No**: local only (see 11.8) |
| Custom ICMP – IPv4 | ICMP | Echo Request | Monitoring service IP | `Ping monitoring` | Optional (12.9) |

Why ports 3000, 5000 and 8080 stay closed: the applications listen on `127.0.0.1` and Nginx forwards requests to them. Opening these ports would bypass TLS, security headers, request limits and logging. If you **temporarily** need direct access for debugging, add a rule with **Source = My IP** and a description like `TEMP debug 3000 – remove`, and delete it the same day. A safer alternative is an SSH tunnel: `ssh -L 3000:127.0.0.1:3000 deploy@<SERVER_IP>`, then open `http://localhost:3000` on your computer.

#### 3.3.3 Outbound rules

Keep the default: **All traffic → `0.0.0.0/0`** (and `::/0`). The server needs outbound HTTPS (apt, npm, pip, Git, Let's Encrypt), DNS (UDP/TCP 53) and NTP (UDP 123). Strict outbound filtering is possible but requires maintaining a list of every external service your application calls.

#### 3.3.4 Updating Security Group rules safely

1. **Add before you remove.** When your office IP changes, first add a rule for the new IP, test a new SSH login, then delete the old rule. Never remove the only SSH rule while logged in through it.
2. **Use descriptions** on every rule (who, why, until when). Rules without a description are hard to audit.
3. **Keep a second session open** while changing SSH-related rules.
4. **Dynamic home IPs**: use **My IP** each time, or connect through a company VPN with a fixed IP, or use **AWS Systems Manager Session Manager** (no inbound port 22 needed; requires the SSM agent and an IAM role).
5. **Review monthly**: remove temporary rules and rules for people who left.
6. **Locked out?** Edit the SG from the console to add your current IP; if the problem is UFW or SSH config on the server, use **EC2 Serial Console** or **EC2 Instance Connect** ([15](#15-troubleshooting)).

### 3.4 Initial server configuration on EC2

Everything here is identical to Hostinger and DigitalOcean. Follow [section 6](#6-common-linux-server-configuration) from the start. EC2-specific notes:

| Topic | On EC2 |
|---|---|
| First login user | `ubuntu` (already has sudo, key-only login). There is no root password. |
| Copying your key to the new `deploy` user | Copy from `/home/ubuntu/.ssh/authorized_keys` ([6.3](#63-create-the-admin-user-and-the-application-user)) |
| Firewalls | Security Group (3.3) **and** UFW (6.7). Keep their rules consistent |
| Time sync | Ubuntu AMIs use `chrony`/`systemd-timesyncd` with the Amazon Time Sync Service; nothing to do |
| After hardening SSH | You may delete the `ubuntu` user's key or keep `ubuntu` as a break-glass account with key-only login (decide as a team, document it) |

### 3.5 Application deployment on EC2

Identical to the other platforms: [section 9](#9-application-deployment) (deploy), [section 10](#10-domain--ssl-configuration) (domain and SSL). EC2-specific points:

- **Uploading files** with `scp`/`rsync` uses the same key: `rsync -avz -e "ssh -i ~/.ssh/application-prod-key.pem" ./dist/ deploy@<SERVER_IP>:/tmp/dist/`.
- **Let's Encrypt** needs port 80 open in the Security Group (rule above).
- **Backups**: in addition to [section 13](#13-backup--recovery), use **EBS snapshots**: **Amazon Data Lifecycle Manager** (EC2 → Elastic Block Store → Lifecycle Manager → Create lifecycle policy) can snapshot the volume daily and keep, say, 7–14 snapshots. Or use **AWS Backup**.
- **Monitoring**: CloudWatch shows CPU, network and status checks by default. RAM and disk usage need the **CloudWatch agent** (optional) or the scripts in [12](#12-monitoring--maintenance).

---

## 4. Hostinger VPS Setup

Hostinger VPS plans are self-managed KVM servers with full root access, managed in **hPanel**. This section covers only the Hostinger-specific parts; the Ubuntu configuration is in [section 6](#6-common-linux-server-configuration).

### 4.1 Same as AWS vs different from AWS

| Step | Same as AWS? | Hostinger specifics |
|---|---|---|
| Choose Ubuntu LTS | Same idea | Chosen as an OS template in hPanel |
| Instance size | Different | Fixed plans (KVM 1/2/4/8) instead of instance types |
| Static IP | **Different** | The VPS IP is static and included; there is no Elastic IP step |
| SSH key | Similar | Added in hPanel (Settings → SSH keys) or at setup |
| First login user | **Different** | `root` (password and/or SSH key), not `ubuntu` |
| Provider firewall | Different tool, same purpose | hPanel managed VPS firewall instead of a Security Group |
| Ubuntu configuration, deployment, Nginx, SSL, scripts | **Identical** | Sections 6–13 |
| Backups | Different | Weekly automatic backups included, snapshots, optional daily backups |
| Monitoring | Different | hPanel resource usage graphs instead of CloudWatch |
| Billing | Different | Fixed monthly/annual plan; promotional first term, higher renewal price |

### 4.2 Choose and buy a VPS plan

**Where: <https://www.hostinger.com/vps-hosting>**

Hostinger's current KVM line-up (check the page for current specs and prices: prices shown there are usually promotional first-term prices, renewals cost more):

| Plan | vCPU | RAM | NVMe disk | Monthly bandwidth | Good for |
|---|---|---|---|---|---|
| KVM 1 | 1 | 4 GB | 50 GB | 4 TB | Testing, small single app |
| KVM 2 | 2 | 8 GB | 100 GB | 8 TB | Small–medium production (recommended start) |
| KVM 4 | 4 | 16 GB | 200 GB | 16 TB | Busy APIs, file processing, DB on the same server |
| KVM 8 | 8 | 32 GB | 400 GB | 32 TB | Heavy processing |

When buying:

1. Choose the plan and the subscription length.
2. **Server location**: closest to your users (e.g. India, Europe, US…).
3. Complete the payment. The VPS appears in **hPanel → VPS**.

### 4.3 Set up the VPS (operating system, root password, SSH key)

**Where: hPanel → VPS → (your server) → Setup / Manage**

On a new VPS, hPanel walks you through setup. If the VPS already exists, use **OS & Panel → Operating System** to change it (warning: **reinstalling erases all data on the VPS**).

1. **Operating system**: choose **Plain OS → Ubuntu** with the newest **LTS** version offered (26.04 LTS or 24.04 LTS). Don't choose a control panel template (CyberPanel, cPanel…) for this setup: those manage Nginx/Apache themselves and conflict with the configuration in this manual.
2. **Root password**: set a long random password (store it in your password manager). You need it for the browser terminal and emergencies.
3. **SSH key**: paste the public key from [2.4](#24-create-your-ssh-key-pair-once-on-your-computer) (`ssh-ed25519 AAAA…`). You can add more keys later in **Settings → SSH keys**.
4. Finish the setup and wait until the VPS status is **Running**.

### 4.4 Find the public IP address

**Where: hPanel → VPS → Manage → Overview**

The **IPv4 address** is shown under **VPS information** / **SSH information**, together with the SSH username (`root`) and a ready-to-copy SSH command. The IP is static: it doesn't change when you reboot.

Also on this page: **Web console / Browser terminal** (a terminal in the browser, useful if SSH is blocked), and quick tiles for **SSH key**, **Firewall rules**, **Snapshot & backups**.

### 4.5 Connect with SSH

**Where: your computer**

```bash
# macOS / Linux / Windows PowerShell
ssh -i ~/.ssh/server_ed25519 root@<SERVER_IP>
```

PuTTY: convert `server_ed25519` with PuTTYgen (**Conversions → Import key** → **Save private key** as `.ppk`), then connect to `root@<SERVER_IP>` as in [3.1.10](#3110-connect-to-the-instance) Option C.

If you didn't add a key, log in with the root password once, then add your key:

```bash
# Where: your computer (macOS/Linux) — copies your public key to the server
ssh-copy-id -i ~/.ssh/server_ed25519.pub root@<SERVER_IP>
```

Windows has no `ssh-copy-id`; add the key in **hPanel → Settings → SSH keys** instead, or paste it into `/root/.ssh/authorized_keys` via the browser terminal.

Then continue with [section 6](#6-common-linux-server-configuration): create the `deploy` user, harden SSH (root login is disabled at the end), and set up UFW.

### 4.6 Firewall: hPanel managed firewall and UFW

Hostinger offers a **managed VPS firewall** in hPanel that filters traffic **before** it reaches the server, in addition to UFW inside Ubuntu. When a firewall configuration is active, **all incoming traffic that no rule accepts is dropped**, so always add the SSH rule first.

**Where: hPanel → VPS → Manage → Security → Firewall** (also reachable from the **Firewall rules** tile on Overview)

1. **Create firewall configuration** (or **Add firewall**) → name `application-web` → **Create**.
2. **Edit** the configuration and add rules:

| Action | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| Accept | TCP | 22 | Custom: `<YOUR_IP>` (or "Any" until your IP is fixed) | SSH |
| Accept | TCP | 80 | Any | HTTP / Let's Encrypt |
| Accept | TCP | 443 | Any | HTTPS |
| Accept | ICMP | — | Monitoring IP (optional) | Ping monitoring |

3. **Activate** the configuration for your VPS. Changes can take a few minutes.
4. Test from a **new** terminal: `ssh deploy@<SERVER_IP>` (or `root@` before section 6) and `curl -I http://<SERVER_IP>`.

Locked out? **hPanel → VPS → Manage → Settings → Main settings → reset firewall** (and/or use the **Browser terminal** to fix UFW). Ports 3000, 5000, 8080 and database ports stay closed, exactly as on AWS.

### 4.7 DNS records

If the domain is managed at Hostinger: **hPanel → Domains → (domain) → DNS / Nameservers → DNS records**. Otherwise use your registrar/Cloudflare. Create the same records as on AWS ([3.2.5](#325-point-dns-to-the-elastic-ip)), with the VPS IP:

| Type | Name | Points to | TTL |
|---|---|---|---|
| `A` | `@` | `<SERVER_IP>` | 300 |
| `A` / `CNAME` | `www` | `<SERVER_IP>` / `example.com` | 300 |

Remove old `A`/`AAAA` records for `@` and `www` that point elsewhere (for example a previous shared-hosting IP), otherwise visitors are sent to two different servers. Optional: set a **PTR (reverse DNS)** record in **Settings → IP address** (needed only if the server sends email).

### 4.8 Install the software and deploy

Identical to AWS: [section 6](#6-common-linux-server-configuration) (Nginx, Node.js, PM2, Git, Python, UFW, Fail2ban…), [section 9](#9-application-deployment) (deployment), [section 10](#10-domain--ssl-configuration) (SSL). Hostinger-specific notes:

- First login is `root`: in 6.3 copy the key from `/root/.ssh/authorized_keys`.
- Hostinger's OS template may have a firewall or other packages preinstalled. Run `sudo ufw status` and `ss -tulpn` after the first login to see what is running.

### 4.9 Backups

**Where: hPanel → VPS → Manage → Backups & Monitoring → Snapshots & Backups**

- **Automatic backups**: the VPS is backed up **weekly by default**. You can upgrade to **daily backups** on the same page (paid).
- **Snapshot**: a manual copy of the whole VPS at one moment. Create one **before every risky change** (OS upgrade, big deployment). Hostinger keeps a limited number of snapshots (historically one at a time); a new snapshot replaces the old one.
- **Restore**: choose a backup or snapshot → **Restore**. **Restoring overwrites the current VPS and is irreversible**; download files you want to keep first (SFTP).
- Backups and snapshots can't be downloaded directly. Use [section 13](#13-backup--recovery) for application-level backups that you copy off the server.

### 4.10 Monitoring

- **hPanel → VPS → Manage → Overview → Resource usage**: CPU, memory, disk, incoming/outgoing traffic, bandwidth.
- **Backups & Monitoring → Server usage**: CPU and RAM history (24 hours, week, month, six months).
- **Backups & Monitoring → Latest actions**: what was done to the server and its status.
- **Security**: malware scanner (Monarx) and Anti-DDoS events.

Add the server-side scripts and uptime checks from [section 12](#12-monitoring--maintenance): hPanel graphs don't alert you when the application itself is down.

---

## 5. DigitalOcean Setup

A DigitalOcean server is called a **Droplet**. This section covers the DigitalOcean-specific parts; the Ubuntu configuration is in [section 6](#6-common-linux-server-configuration).

### 5.1 Same as AWS vs different from AWS

| Step | Same as AWS? | DigitalOcean specifics |
|---|---|---|
| Choose Ubuntu LTS | Same | Droplet image "Ubuntu 26.04 (LTS) x64" or 24.04 |
| Size | Different names | Basic (Regular / Premium Intel / Premium AMD), General Purpose, CPU-Optimized, Memory-Optimized |
| Static IP | Different | The Droplet's own public IP stays the same while the Droplet exists. A **Reserved IP** is optional (for moving the address between Droplets) |
| First login user | **Different** | `root` with your SSH key |
| Provider firewall | Different tool | **Cloud Firewall** (Networking → Firewalls) |
| Organizing resources | Different | **Projects** group Droplets, IPs, domains |
| Ubuntu configuration, deployment, Nginx, SSL, scripts | **Identical** | Sections 6–13 |
| Backups | Different | Weekly or daily Droplet backups (paid add-on), manual snapshots |
| Monitoring | Different | Free metrics agent, graphs, alert policies, uptime checks |
| Billing | Different | Usage-based with a monthly cap per Droplet (see the pricing page) |

### 5.2 Create the account and a Project

**Where: <https://cloud.digitalocean.com/>**

1. Sign up, verify the email and add a payment method.
2. Turn on **two-factor authentication**: avatar (top right) → **My Account** → **Security** → **Two-factor authentication**.
3. **Projects**: left sidebar → **New Project** → name `application-prod` → purpose (e.g. "Web Application") → environment **Production** → **Create Project**. Every resource you create next should go into this project.

### 5.3 Add your SSH key

**Where: DO Control Panel → Settings → Security → SSH Keys → Add SSH Key** (you can also do this during Droplet creation)

Paste the public key from [2.4](#24-create-your-ssh-key-pair-once-on-your-computer), give it a name (`admin-laptop`) → **Add SSH Key**.

### 5.4 Create the Droplet

**Where: DO Control Panel → Create (top right) → Droplets**

1. **Choose Region**: closest to your users (e.g. Bangalore `BLR1`, Frankfurt `FRA1`, New York `NYC3`…). The **datacenter** matters: Reserved IPs, VPCs and volumes only work inside one datacenter.
2. **Choose an image → OS → Ubuntu** → version **26.04 (LTS) x64** (or 24.04 LTS).
3. **Choose Size**:

| Use | Droplet type | Example size |
|---|---|---|
| Testing | Basic → Regular | 1 vCPU / 2 GB |
| Small production | Basic → Premium Intel or AMD | 2 vCPU / 4 GB |
| Medium production | Basic Premium 4 vCPU / 8 GB, or General Purpose 2 vCPU / 8 GB | |
| CPU-heavy processing | CPU-Optimized | 4 vCPU / 8 GB |

   Basic Droplets share CPU; General Purpose and CPU-Optimized give dedicated vCPUs (steadier performance). Prices: <https://www.digitalocean.com/pricing/droplets>.
4. **Additional storage**: optional **Volume** (block storage) for uploads or database data that should survive rebuilding the Droplet.
5. **Backups**: tick **Enable automated backup plan** now if you want them (5.9).
6. **Choose Authentication Method → SSH Key** → select your key. Avoid password authentication.
7. **Advanced options**: tick **Enable IPv6** (optional); **Add improved metrics monitoring and alerting (free)** → **yes** (installs the metrics agent).
8. **Finalize Details**: 1 Droplet; **Hostname** `application-prod-1`; **Tags** `application`, `prod` (tags let firewalls apply automatically); **Project** `application-prod`.
9. **Create Droplet**. After about a minute it shows its **IPv4** address.

### 5.5 Connect with SSH

**Where: your computer**

```bash
ssh -i ~/.ssh/server_ed25519 root@<SERVER_IP>
```

PuTTY works as in [3.1.10](#3110-connect-to-the-instance) Option C (user `root`). If SSH isn't reachable, use **Droplet → Access → Launch Droplet Console** (browser) or **Recovery Console**.

Then continue with [section 6](#6-common-linux-server-configuration). In 6.3 copy the key from `/root/.ssh/authorized_keys`.

### 5.6 Cloud Firewall

DigitalOcean **Cloud Firewalls** filter traffic before it reaches the Droplet and are free. They are separate from UFW: keep both.

**Where: DO Control Panel → Networking → Firewalls → Create Firewall** (or **Create → Cloud Firewall**)

1. **Name**: `application-web-fw`.
2. **Inbound Rules** (a new firewall starts with an SSH rule from all addresses; restrict it):

| Type | Protocol | Port | Sources |
|---|---|---|---|
| SSH | TCP | 22 | `<YOUR_IP>` (remove "All IPv4/All IPv6") |
| HTTP | TCP | 80 | All IPv4, All IPv6 |
| HTTPS | TCP | 443 | All IPv4, All IPv6 |
| ICMP | ICMP | — | Monitoring IP (optional) |

3. **Outbound Rules**: keep the defaults (all TCP, all UDP, ICMP to all addresses). Important: **if no outbound rules are configured, no outbound traffic is permitted**, which breaks apt, Git, Let's Encrypt and the metrics agent (it needs outbound 80/443).
4. **Apply to Droplets**: type the tag `application` (every Droplet with the tag gets the firewall) or the Droplet name.
5. **Create Firewall**.

A Droplet can be protected by several Cloud Firewalls; their rules are combined.

### 5.7 Reserved IP (optional)

A **Reserved IP** is a static public IP you can assign to a Droplet and **re-assign instantly to another Droplet in the same datacenter**: useful for zero-downtime server replacement or failover.

**Where: DO Control Panel → Networking → Reserved IPs**

1. Choose the Droplet in **Search for a Droplet** → **Assign Reserved IP** (or reserve an unassigned IP in a datacenter).
2. Point DNS to the Reserved IP instead of the Droplet's own IP.
3. To move it: **More → Reassign** → choose another Droplet in the same datacenter.

Things to know:

- Assigning a Reserved IP **doesn't replace or change** the Droplet's own public IP; both work for incoming traffic.
- Reserved IPs are region-specific and can only be assigned to Droplets **in the same datacenter**.
- One Reserved IP per Droplet; Reserved IPs don't support PTR (reverse DNS) records.
- Outgoing connections from the Droplet use its own public IP by default (relevant if a partner allow-lists your IP).
- Pricing: <https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/>.

#### AWS Elastic IP vs DigitalOcean Reserved IP

| | AWS Elastic IP | DigitalOcean Reserved IP |
|---|---|---|
| Scope | One AWS **Region** | One DigitalOcean **datacenter** |
| Effect on the server's own IP | **Replaces** the auto-assigned public IP | **Adds** an address; the Droplet's own IP stays |
| Needed for a stable IP? | **Yes**: auto-assigned IPs change on stop/start | No: a Droplet keeps its IP while it exists; Reserved IP is for moving the address |
| Outbound traffic source | The Elastic IP | The Droplet's own public IP (unless configured otherwise) |
| Move to another server | Re-associate (any instance in the Region) | Reassign (any Droplet in the same datacenter) |
| Reverse DNS (PTR) | Possible on request | Not supported |
| Billing | Every public IPv4 is charged hourly, in use or idle (VPC pricing page) | See DigitalOcean's Reserved IP pricing page |

### 5.8 Networking and DNS

- **VPC**: Droplets in the same datacenter get a private network interface. Use the **private IP** for traffic between your own Droplets (e.g. app server → database server) and keep database ports closed to the public.
- **DNS**: either keep DNS at your registrar/Cloudflare and create the `A` records from [3.2.5](#325-point-dns-to-the-elastic-ip) with the Droplet IP (or Reserved IP), **or** use DigitalOcean DNS: **Networking → Domains → Add Domain**, then change the domain's nameservers at the registrar to `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com`, and add the `A` records there.

### 5.9 Backups and snapshots

- **Backups** (paid add-on): **Droplet → Backups → Enable backups**. Choose **weekly** or **daily** and the backup window. DigitalOcean keeps weekly backups for four weeks and daily backups for seven days, stored in the same datacenter as the Droplet.
- **Snapshots** (manual, billed per GB): **Droplet → Snapshots → Take live snapshot**. Take one before risky changes. Snapshots are kept until you delete them.
- **Volumes** are not included in Droplet backups; use volume snapshots.
- Off-site copies: [section 13](#13-backup--recovery).

### 5.10 Monitoring and alerts

- **Droplet → Graphs**: CPU, memory, disk, bandwidth (memory and disk need the metrics agent; it was installed by ticking the option in 5.4, or install it with the script in DigitalOcean's docs: <https://docs.digitalocean.com/products/monitoring/how-to/install-metrics-agent/>).
- **Monitoring → Create Alert Policy**: e.g. CPU > 80 % for 5 min, memory > 90 %, disk > 85 % → email/Slack.
- **Monitoring → Uptime → Create Uptime Check**: checks `https://example.com/health` from several regions and alerts when it fails or the certificate is about to expire.

---

## 6. Common Linux Server Configuration

**Identical on AWS EC2, Hostinger VPS and DigitalOcean.** Do these steps in order on a fresh Ubuntu LTS server. Total time: about 30–45 minutes.

### 6.1 Before you start

- **First login user**: AWS → `ubuntu`; Hostinger and DigitalOcean → `root`. Commands below use `sudo`; as `root`, `sudo` simply works too.
- **Keep one SSH session open** while you change SSH or firewall settings, and test changes from a **second** session. If something breaks, you can still fix it from the first one.
- Copy commands one block at a time and read the expected output before continuing.

### 6.2 Update Ubuntu packages

**Where: server · As: root / sudo**

```bash
sudo apt update                      # refresh the package lists
sudo apt -y full-upgrade             # install all updates (may update the kernel)
sudo apt -y install ca-certificates curl gnupg lsb-release unzip htop git \
     rsync jq ncdu sysstat vnstat logrotate
sudo apt -y autoremove               # remove packages no longer needed
```

If the kernel was updated, reboot (you'll be disconnected; reconnect after ~1 minute):

```bash
[ -f /var/run/reboot-required ] && echo "Reboot needed" && sudo reboot
```

Check the version:

```bash
lsb_release -ds
# Expected: Ubuntu 26.04 LTS   (or Ubuntu 24.04.x LTS)
```

### 6.3 Create the admin user and the application user

Two users, two jobs:

| User | Purpose | sudo | SSH login |
|---|---|---|---|
| `deploy` | People log in with it to administer the server | Yes | Yes (SSH key only) |
| `app` | Owns the application files and runs the processes (PM2) | **No** | No (reach it with `sudo -iu app`) |

If the application is ever compromised, the attacker gets only the `app` user's rights, not root.

**Where: server · As: root / sudo**

```bash
# 1. Admin user (asks for a password: used for sudo, not for SSH)
sudo adduser deploy
sudo usermod -aG sudo deploy

# 2. Give 'deploy' the same SSH key you are using now
sudo mkdir -p /home/deploy/.ssh
# AWS:                 source is /home/ubuntu/.ssh/authorized_keys
# Hostinger / DO:      source is /root/.ssh/authorized_keys
sudo cp /home/ubuntu/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys 2>/dev/null \
  || sudo cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# 3. Application user: no password, no sudo, home directory for PM2 (~/.pm2)
sudo adduser --disabled-password --gecos "Application runtime user" app
```

Expected: `adduser` prints `Adding user 'deploy' ...`, `Creating home directory '/home/deploy' ...`; `id deploy` shows `groups=...,27(sudo)`.

### 6.4 Hostname and time zone

**Where: server · As: sudo**

```bash
sudo hostnamectl set-hostname application-prod-1
# Many teams keep servers on UTC so logs from all servers line up; set your local zone if you prefer:
sudo timedatectl set-timezone Asia/Kolkata        # or: UTC
timedatectl
```

Expected output (part):

```text
                Time zone: Asia/Kolkata (IST, +0530)
System clock synchronized: yes
              NTP service: active
```

If `System clock synchronized` says `no`: `sudo timedatectl set-ntp true`.

### 6.5 Log in as `deploy` and test sudo

**Where: your computer (new terminal) · As: deploy**

```bash
ssh -i ~/.ssh/server_ed25519 deploy@<SERVER_IP>      # AWS: use the .pem key from 3.1.6
sudo whoami
# Expected: root
```

From now on, work as `deploy`. Optional `~/.ssh/config` entry on your computer so you can type `ssh app-prod`:

```text
Host app-prod
    HostName <SERVER_IP>
    User deploy
    IdentityFile ~/.ssh/server_ed25519
    IdentitiesOnly yes
```

### 6.6 Secure SSH

Do this **only after** 6.5 works (key login as `deploy`). The full configuration file is in [8.5](#85-ssh-configuration). Short version:

**Where: server · As: deploy (sudo)**

```bash
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf > /dev/null <<'EOF'
# See section 8.5 for explanations
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
EOF

sudo sshd -t && echo "Config OK"        # syntax check: must print "Config OK"
sudo systemctl restart ssh
sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|allowusers)'
```

Expected:

```text
Config OK
permitrootlogin no
passwordauthentication no
allowusers deploy
```

Now, **without closing the current session**, open a new terminal and run `ssh deploy@<SERVER_IP>`. It must work. Also check that `ssh root@<SERVER_IP>` is refused (`Permission denied (publickey)`).

> Why the file is called `00-…`: in OpenSSH the **first** value found for a setting wins, and files in `sshd_config.d/` are read in alphabetical order. Some cloud images ship `50-cloud-init.conf` with `PasswordAuthentication yes`; `00-hardening.conf` is read first, so your values win.

### 6.7 Configure the UFW firewall

UFW ("uncomplicated firewall") is the host firewall. Default: block everything incoming, allow everything outgoing, then open only SSH, HTTP and HTTPS. The full script is in [8.4](#84-ufw-firewall-configuration).

**Where: server · As: deploy (sudo)**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH: only from your IP (repeat for each office/VPN IP) ...
sudo ufw allow from <YOUR_IP> to any port 22 proto tcp comment 'SSH admin'
# ... or, if your IP changes often, allow from anywhere but rate-limited (6 attempts / 30 s):
# sudo ufw limit 22/tcp comment 'SSH rate-limited'

sudo ufw allow 80/tcp  comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

sudo ufw enable          # answers "Command may disrupt existing ssh connections. Proceed? (y|n)" -> y
sudo ufw status verbose
```

Expected:

```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    198.51.100.25     # SSH admin
80/tcp                     ALLOW IN    Anywhere          # HTTP
443/tcp                    ALLOW IN    Anywhere          # HTTPS
80/tcp (v6)                ALLOW IN    Anywhere (v6)     # HTTP
443/tcp (v6)               ALLOW IN    Anywhere (v6)     # HTTPS
```

**Never** open 3000, 5000, 8080, 3306, 5432 or 6379 here. Applications are reached through Nginx.

> The provider firewall (Security Group / hPanel firewall / Cloud Firewall) must allow the same ports, otherwise traffic stops before it reaches UFW.

### 6.8 Install Fail2ban (brute-force protection)

Fail2ban watches log files and temporarily blocks IP addresses that repeatedly fail to log in.

**Where: server · As: deploy (sudo)**

```bash
sudo apt -y install fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
# /etc/fail2ban/jail.local — local overrides (never edit jail.conf)
[DEFAULT]
# Never ban yourself: add your office/VPN IPs (space-separated)
ignoreip  = 127.0.0.1/8 ::1 <YOUR_IP>
bantime   = 1h
findtime  = 10m
maxretry  = 5
# Repeat offenders are banned longer (1h, 2h, 4h ... up to 1 week)
bantime.increment = true
bantime.maxtime   = 1w
banaction = ufw

[sshd]
enabled  = true
port     = ssh
maxretry = 4
# read SSH logins from the systemd journal
backend  = systemd

# Bots scanning for admin pages / exploits in Nginx logs
[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/*error.log

# Only if you protect a page with Nginx basic auth
[nginx-http-auth]
enabled  = false
port     = http,https
logpath  = /var/log/nginx/*error.log
EOF

sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

Expected:

```text
Status
|- Number of jail:      2
`- Jail list:   nginx-botsearch, sshd
```

Useful: `sudo fail2ban-client set sshd unbanip <IP>` unbans an address.

### 6.9 Automatic security updates

Ubuntu includes `unattended-upgrades`, which installs **security** updates automatically every day.

**Where: server · As: deploy (sudo)**

```bash
sudo apt -y install unattended-upgrades apt-listchanges
sudo dpkg-reconfigure --priority=low unattended-upgrades     # choose "Yes"
cat /etc/apt/apt.conf.d/20auto-upgrades
```

Expected:

```text
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

Optional: reboot automatically at night when an update requires it (otherwise reboot manually during a maintenance window):

```bash
sudo tee /etc/apt/apt.conf.d/52unattended-upgrades-local > /dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
Unattended-Upgrade::Mail "admin@example.com";
Unattended-Upgrade::MailReport "on-change";
EOF
```

(Mail reports need a mail transfer agent; skip that line if the server can't send email.)

### 6.10 Add swap (servers with 4 GB RAM or less)

Swap is disk space used when RAM is full. It prevents the kernel from killing processes during short memory peaks (for example `npm run build`).

**Where: server · As: deploy (sudo)**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf   # use swap only when needed
sudo sysctl --system > /dev/null
free -h
```

Expected: a `Swap:` line with `2.0Gi` total.

### 6.11 Install Nginx

**Where: server · As: deploy (sudo)**

```bash
sudo apt -y install nginx
sudo systemctl enable --now nginx
# Hide the Nginx version number in headers and error pages
echo 'server_tokens off;' | sudo tee /etc/nginx/conf.d/00-server-tokens.conf
sudo nginx -t && sudo systemctl reload nginx
curl -I http://localhost
```

Expected:

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
HTTP/1.1 200 OK
Server: nginx
```

Opening `http://<SERVER_IP>` in a browser shows "Welcome to nginx!". The site configuration comes in [8.1](#81-nginx-configuration).

### 6.12 Install Node.js and npm

Use an **LTS** version of Node.js. Node.js 26 entered **Active LTS** on 28 October 2026 (supported until April 2029); Node.js 24 is in Maintenance LTS until April 2028. Check the current status at <https://nodejs.org/en/about/previous-releases>.

**Where: server · As: deploy (sudo)**

```bash
NODE_MAJOR=26          # use 24 if your application isn't tested on 26 yet
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh          # optional: read what the script does (q to quit)
sudo bash /tmp/nodesource_setup.sh     # adds the NodeSource apt repository
sudo apt -y install nodejs             # includes npm
node -v && npm -v
```

Expected: `v26.x.x` and an npm version such as `11.x.x`.

Alternative without a third-party apt repository: install **nvm** for the `app` user (`https://github.com/nvm-sh/nvm`). Then use the full path of that Node binary in PM2.

### 6.13 Install PM2

PM2 keeps Node.js (and other) processes running, restarts them when they crash, runs several copies (cluster mode) and starts them again after a reboot.

**Where: server · As: deploy (sudo)**

```bash
sudo npm install -g pm2@latest
pm2 -v

# Start PM2 for the 'app' user at boot (creates the systemd service pm2-app)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u app --hp /home/app
systemctl status pm2-app --no-pager
```

Expected: `[PM2] Init System found: systemd` … `[PM2] [v] Command successfully executed.` The service shows `loaded` (it becomes `active` once you start and save apps in 9.6).

### 6.14 Install Git and give the server read access to the repository

**Where: server · As: deploy (sudo), then app**

```bash
sudo apt -y install git
git --version

# A deploy key belongs to the 'app' user and gives read-only access to ONE repository
sudo -iu app ssh-keygen -t ed25519 -C "deploy-key application-prod-1" -f /home/app/.ssh/id_ed25519 -N ""
sudo -iu app cat /home/app/.ssh/id_ed25519.pub
```

Add the printed public key to the repository as a **deploy key**:

- **GitHub**: repository → **Settings → Deploy keys → Add deploy key** → paste → leave **Allow write access** unticked → **Add key**.
- **GitLab**: project → **Settings → Repository → Deploy keys**.
- **Bitbucket**: repository → **Repository settings → Access keys**.

Test:

```bash
sudo -iu app ssh -o StrictHostKeyChecking=accept-new -T git@github.com
# Expected: Hi ORG/REPO! You've successfully authenticated, but GitHub does not provide shell access.
```

The deploy key has no passphrase (the server must use it unattended); it is read-only and limited to one repository, and only `app` can read it (`/home/app/.ssh` is 700).

### 6.15 Install Python

Needed for a Python API (FastAPI, Flask, Django) and for some build tools.

**Where: server · As: deploy (sudo)**

```bash
sudo apt -y install python3 python3-venv python3-pip python3-dev build-essential
python3 --version
```

Always install Python packages **inside a virtual environment** owned by `app` (9.5). Ubuntu protects the system Python: `sudo pip install …` fails with `error: externally-managed-environment`, and that is intended.

### 6.16 Install MySQL or PostgreSQL (only if required)

Skip this if the application uses a managed database (Amazon RDS, DigitalOcean Managed Databases) or no database. Install **one** of them. Both listen on `127.0.0.1` only by default; keep it that way. Configuration files: [8.11](#811-database-configuration).

**PostgreSQL**

**Where: server · As: deploy (sudo)**

```bash
sudo apt -y install postgresql
sudo systemctl enable --now postgresql
openssl rand -base64 24          # generate a password, store it in your password manager
sudo -u postgres createuser --pwprompt appdb_user        # paste the password twice
sudo -u postgres createdb --owner=appdb_user appdb
psql "postgresql://appdb_user@127.0.0.1:5432/appdb" -c "select version();"   # asks for the password
```

**MySQL**

```bash
sudo apt -y install mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation          # answer: VALIDATE PASSWORD (y), remove anonymous users (y),
                                        # disallow root login remotely (y), remove test DB (y), reload (y)
openssl rand -base64 24                 # password for the application user
sudo mysql <<'SQL'
CREATE DATABASE appdb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'appdb_user'@'localhost' IDENTIFIED BY 'PASTE_GENERATED_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON appdb.* TO 'appdb_user'@'localhost';
FLUSH PRIVILEGES;
SQL
```

> Type the password directly in the terminal; don't save it in shell scripts. Remove it from the shell history afterwards if you pasted it into a command: `history -d $(history 1 | awk '{print $1}')` or edit `~/.bash_history`.

### 6.17 Check the base installation

**Where: server · As: deploy**

```bash
systemctl is-active nginx fail2ban ssh pm2-app 2>/dev/null
sudo ufw status | head -3
node -v; npm -v; pm2 -v; python3 --version; git --version
ss -tulpn | grep LISTEN
```

`ss` should show only `:22`, `:80` (Nginx) and, if installed, `127.0.0.1:5432` or `127.0.0.1:3306`. Anything listening on `0.0.0.0` other than 22/80/443 deserves a look.

---

## 7. Server Directory Structure

### 7.1 Layout

```text
/var/www/                                   root:root          755
├── application/                            app:www-data      2750   main application root
│   ├── backend/                            app:app            750   Node.js backend (Git checkout)
│   ├── frontend/                           app:www-data      2750   frontend source (Git checkout)
│   │   └── dist/                           app:www-data      2750   built static files — the ONLY folder Nginx serves as web root
│   ├── uploads/                            app:www-data      2750   files uploaded by users (served, never executed)
│   ├── logs -> /var/log/application        symlink                  shortcut for developers
│   └── backups/                            root:root          700   local backup archives (not web-accessible)
├── api/                                    app:app            750   Python API service (Git checkout + .venv)
├── websites/                               deploy:www-data   2750   simple static websites, one folder each
│   └── example.org/public/                 deploy:www-data   2750
└── letsencrypt/                            root:root          755   ACME webroot for certificate renewal (empty)

/etc/
├── nginx/                                  root:root          755
│   ├── nginx.conf                                                   main file (Ubuntu default, normally unchanged)
│   ├── conf.d/00-server-tokens.conf                                 hide version
│   ├── snippets/ssl-params.conf                                     TLS settings          (8.1)
│   ├── snippets/security-headers.conf                               security headers      (8.1)
│   ├── snippets/proxy-params.conf                                   reverse-proxy headers (8.1)
│   ├── sites-available/application.conf                             the site              (8.1)
│   └── sites-enabled/application.conf -> ../sites-available/application.conf
├── ssl/                                    root:root          755   commercial / custom certificates only
│   └── private/                            root:root          700   their private keys (600)
├── letsencrypt/                            root:root                managed by certbot — don't edit by hand
└── application/                            root:app           750   secrets and runtime configuration
    ├── application.env                     root:app           640   environment variables (8.3)
    ├── ecosystem.config.js                 root:app           640   PM2 process file      (8.2)
    ├── backup.env                          root:root          600   backup settings for backup.sh (8.8)
    └── monitor.env                         root:root          600   alert settings for monitor.sh (8.9)

/opt/
└── scripts/                                root:root          755   operations scripts
    ├── deploy.sh                           root:root          755   run as app            (8.7)
    ├── backup.sh                           root:root          750   run as root by cron   (8.8)
    ├── monitor.sh                          root:root          750   run as root by cron   (8.9)
    └── ufw-setup.sh                        root:root          750   run as root           (8.4)

/var/log/
├── nginx/                                  (Ubuntu default)         application.access.log, application.error.log
└── application/                            app:adm           2750   backend.*.log, api.*.log, deploy.log
                                                                     (backup.sh and monitor.sh log to the systemd journal)
```

### 7.2 Purpose of each directory

| Directory | Purpose | Notes |
|---|---|---|
| `/var/www/application` | Everything that belongs to the main application | Group `www-data` + setgid (`2…`) so Nginx can enter it and new sub-folders inherit the group |
| `backend/` | Node.js server code, `node_modules`, build output | Not readable by Nginx. Contains no secrets: they are in `/etc/application/` |
| `frontend/` | Frontend source; `npm run build` creates `dist/` | Nginx's `root` points to `frontend/dist`, never to `frontend/` itself (that would expose source files and `package.json`) |
| `uploads/` | User files | Served by Nginx with scripts blocked (8.1). Back it up (8.8). On multi-server setups, move it to object storage (S3 / Spaces) |
| `logs` | Symlink to `/var/log/application` | Logs stay in the system log location (rotated by logrotate, 8.10) |
| `backups/` | Local backup archives | `700 root`. Copy backups **off the server** too (13) |
| `/var/www/api` | A separately deployed API (here: the Python API on port 5000) | Own Git repository and virtual environment `.venv` |
| `/var/www/websites` | Additional static sites (landing pages) | One folder per site with a `public/` web root; own Nginx server block each |
| `/var/www/letsencrypt` | Webroot for Let's Encrypt HTTP challenges | Empty; certbot writes temporary files during renewal |
| `/etc/nginx` | Web server configuration | Edit in `sites-available/`, enable with a symlink in `sites-enabled/` |
| `/etc/ssl` | Certificates **not** from Let's Encrypt | Private keys in `private/`, mode `600` |
| `/etc/application` | Secrets (`application.env`) and runtime configuration | **Outside every web root.** Readable by `app` (group), writable only by root |
| `/opt/scripts` | Deploy, backup, monitoring scripts | Root-owned so the application user can run but not change them |
| `/var/log/application` | Application and script logs | Group `adm` lets admins read logs without sudo if they are in `adm` |

### 7.3 Create the structure

**Where: server · As: deploy (sudo)**

```bash
# Application tree
sudo mkdir -p /var/www/application/{backend,frontend,uploads,backups} /var/www/api \
              /var/www/websites /var/www/letsencrypt /etc/application /opt/scripts /var/log/application

sudo chown app:www-data /var/www/application && sudo chmod 2750 /var/www/application
sudo chown app:app      /var/www/application/backend /var/www/api
sudo chmod 750          /var/www/application/backend /var/www/api
sudo chown app:www-data /var/www/application/frontend /var/www/application/uploads
sudo chmod 2750         /var/www/application/frontend /var/www/application/uploads
sudo chown root:root    /var/www/application/backups && sudo chmod 700 /var/www/application/backups
sudo ln -sfn /var/log/application /var/www/application/logs

sudo chown deploy:www-data /var/www/websites && sudo chmod 2750 /var/www/websites
sudo chown root:root /var/www/letsencrypt && sudo chmod 755 /var/www/letsencrypt

# Configuration and secrets
sudo chown root:app /etc/application && sudo chmod 750 /etc/application
sudo mkdir -p /etc/ssl/private && sudo chmod 700 /etc/ssl/private

# Scripts and logs
sudo chown root:root /opt/scripts && sudo chmod 755 /opt/scripts
sudo chown app:adm /var/log/application && sudo chmod 2750 /var/log/application

# Let admins read logs without sudo (optional)
sudo usermod -aG adm deploy

ls -la /var/www/application
```

Expected (part):

```text
drwxr-s---  6 app  www-data 4096 ... .
drwxr-x---  2 app  app      4096 ... backend
drwx------  2 root root     4096 ... backups
drwxr-s---  2 app  www-data 4096 ... frontend
lrwxrwxrwx  1 root root       20 ... logs -> /var/log/application
drwxr-s---  2 app  www-data 4096 ... uploads
```

### 7.4 Permission rules to keep

1. **Nginx (`www-data`) may read only** `frontend/dist`, `uploads` and `websites/*/public`. It may never write anywhere under `/var/www`.
2. **The `app` user may write only** its own code folders, `uploads/` and `/var/log/application`. It can read `/etc/application` but not change it.
3. **No secrets under `/var/www`.** `.env` files, private keys, database dumps and backups never go into a folder Nginx serves. The Nginx config additionally blocks hidden files (`.env`, `.git`).
4. Files `640`, folders `750`/`2750`. Never use `777`: if something "only works with 777", the owner or group is wrong.
5. Fix permissions after copying files by hand: `sudo chown -R app:www-data /var/www/application/frontend/dist && sudo find /var/www/application/frontend/dist -type d -exec chmod 2750 {} + -o -type f -exec chmod 640 {} +`.

---

## 8. Configuration Files

Each file has: **path**, **owner/permissions**, the **complete content**, and **how to enable** it. Replace the placeholders (2.3) before enabling.

### 8.1 Nginx configuration

Four files: the site, and three reusable snippets.

#### 8.1.1 `/etc/nginx/snippets/ssl-params.conf`

Owner `root:root`, mode `644`.

```nginx
# /etc/nginx/snippets/ssl-params.conf
# Modern TLS settings (TLS 1.2 + 1.3), based on Mozilla's "intermediate" profile.
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_ecdh_curve X25519:prime256v1:secp384r1;

ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;   # about 40,000 sessions
ssl_session_tickets off;

# Let's Encrypt certificates no longer carry an OCSP address, so OCSP stapling is not configured.
```

#### 8.1.2 `/etc/nginx/snippets/security-headers.conf`

Owner `root:root`, mode `644`.

```nginx
# /etc/nginx/snippets/security-headers.conf
# Include in every server block that serves content, AND again in any location that uses its own
# add_header (Nginx drops inherited add_header directives in that case).
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;

# HSTS: tells browsers to use HTTPS only. Enable ONLY after HTTPS works for the domain and every
# sub-domain you include; browsers remember it for max-age seconds.
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Content-Security-Policy depends on your frontend (scripts, fonts, analytics). Start in report-only
# mode, check the browser console, then switch to the enforcing header.
# add_header Content-Security-Policy-Report-Only "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'; base-uri 'self'" always;
```

#### 8.1.3 `/etc/nginx/snippets/proxy-params.conf`

Owner `root:root`, mode `644`.

```nginx
# /etc/nginx/snippets/proxy-params.conf
# Headers for requests forwarded to the Node.js / Python applications.
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header Connection        "";      # needed for upstream keepalive
```

Tell the application it is behind a proxy, so it sees the real client IP and `https`: Express `app.set('trust proxy', 'loopback')`; Uvicorn `--proxy-headers --forwarded-allow-ips 127.0.0.1` (already in 8.2).

#### 8.1.4 `/etc/nginx/sites-available/application.conf`

Owner `root:root`, mode `644`. This is the final configuration **with HTTPS**. Before the certificate exists, use the bootstrap file in 8.1.5.

```nginx
# /etc/nginx/sites-available/application.conf
# Site: example.com  (www.example.com redirects to example.com)
#   /            static frontend from /var/www/application/frontend/dist, else Node.js backend
#   /api/        Python API      -> 127.0.0.1:5000   (the /api prefix is removed)
#   /socket.io/  WebSockets      -> 127.0.0.1:3000
#   /uploads/    user files      -> /var/www/application/uploads (never executed)

upstream app_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream app_api {
    server 127.0.0.1:5000;
    keepalive 16;
}

# Per-IP limits (zones are defined once per Nginx instance; rename if you add more sites)
limit_req_zone  $binary_remote_addr zone=app_api_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=app_conn_limit:10m;

# ---------------------------------------------------------------- HTTP (port 80)
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    # Let's Encrypt HTTP-01 challenges (certificate issue and renewal)
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }

    # Everything else: permanent redirect to HTTPS on the main domain
    location / {
        return 301 https://example.com$request_uri;
    }
}

# ---------------------------------------------------------------- HTTPS: www -> main domain
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;

    return 301 https://example.com$request_uri;
}

# ---------------------------------------------------------------- HTTPS: the application
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;
    include /etc/nginx/snippets/security-headers.conf;

    access_log /var/log/nginx/application.access.log;
    error_log  /var/log/nginx/application.error.log warn;

    # Request limits
    client_max_body_size 50m;          # largest upload; keep in line with the application's limit
    client_body_timeout  60s;
    limit_conn app_conn_limit 50;      # simultaneous connections per IP

    # Timeouts towards the applications (locations below may override)
    proxy_connect_timeout 10s;
    proxy_send_timeout    60s;
    proxy_read_timeout    60s;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml image/svg+xml;

    root  /var/www/application/frontend/dist;
    index index.html;

    # Health check for monitoring (not logged)
    location = /health {
        proxy_pass http://app_backend/health;
        include /etc/nginx/snippets/proxy-params.conf;
        access_log off;
    }

    # Python API: https://example.com/api/users -> http://127.0.0.1:5000/users
    location ^~ /api/ {
        limit_req zone=app_api_limit burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://app_api/;
        include /etc/nginx/snippets/proxy-params.conf;
        proxy_read_timeout 120s;
    }

    # WebSockets (e.g. Socket.IO) to the Node.js backend
    location ^~ /socket.io/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 3600s;
    }

    # User uploads: plain files only — scripts and HTML are refused
    location ^~ /uploads/ {
        alias /var/www/application/uploads/;
        autoindex off;
        expires 7d;
        location ~* \.(?:php\d?|phtml|pl|py|cgi|sh|asp|aspx|jsp|html?|shtml|svg|js|mjs)$ {
            deny all;
        }
    }

    # Build output with content hashes in the file names (Vite: /assets/; Create React App: use /static/)
    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        include /etc/nginx/snippets/security-headers.conf;
        access_log off;
    }

    # Other static files (favicon, images without hashes): cache for one day; if the file
    # isn't in dist, the backend may generate it
    location ~* \.(?:css|js|mjs|map|woff2?|ttf|otf|eot|ico|png|jpe?g|gif|webp|avif|svg)$ {
        try_files $uri @backend;
        add_header Cache-Control "public, max-age=86400" always;
        include /etc/nginx/snippets/security-headers.conf;
        access_log off;
    }

    # Everything else: a static file if it exists, otherwise the Node.js backend.
    # Single-page app without server rendering? Use:  try_files $uri $uri/ /index.html;
    location / {
        try_files $uri $uri/ @backend;
    }

    location @backend {
        proxy_pass http://app_backend;
        include /etc/nginx/snippets/proxy-params.conf;
    }

    # Never serve hidden files (.env, .git, .htpasswd) — except .well-known
    location ~ /\.(?!well-known/) {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

> On Nginx 1.25.1 and newer, `listen … http2` prints a deprecation **warning** (not an error). You can replace it with `listen 443 ssl;` plus a separate line `http2 on;`. Ubuntu 24.04's Nginx needs the `listen … http2` form.

#### 8.1.5 Bootstrap file (HTTP only, used once before the first certificate)

```nginx
# /etc/nginx/sites-available/application.conf  — TEMPORARY, until the certificate exists (10.3)
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }

    location / {
        default_type text/plain;
        return 200 "Server setup in progress\n";
    }
}
```

#### 8.1.6 Enable the site

**Where: server · As: deploy (sudo)**

```bash
sudo nano /etc/nginx/sites-available/application.conf        # paste 8.1.5 first, 8.1.4 after 10.3
sudo ln -sfn /etc/nginx/sites-available/application.conf /etc/nginx/sites-enabled/application.conf
sudo rm -f /etc/nginx/sites-enabled/default                   # remove the "Welcome to nginx" site
sudo nginx -t                                                  # ALWAYS test before reloading
sudo systemctl reload nginx
```

Expected: `syntax is ok` / `test is successful`. If `nginx -t` fails, Nginx keeps running with the old configuration; fix the reported line first.

### 8.2 PM2 `ecosystem.config.js`

**Path:** `/etc/application/ecosystem.config.js` · **Owner/mode:** `root:app 640` (the `app` user reads it; only admins change it)

```javascript
// /etc/application/ecosystem.config.js
// PM2 process file for the 'app' user.
//   Start or reload : sudo -iu app pm2 startOrReload /etc/application/ecosystem.config.js --update-env
//   Status          : sudo -iu app pm2 status
//   Logs            : sudo -iu app pm2 logs --lines 100
//   Keep after boot : sudo -iu app pm2 save
// Secrets are NOT written here: they come from /etc/application/application.env.

module.exports = {
  apps: [
    {
      // ---------------------------------------------------- Node.js backend (port 3000)
      name: 'app-backend',
      cwd: '/var/www/application/backend',
      script: 'dist/server.js',               // your entry file, e.g. 'server.js' or 'build/index.js'
      node_args: '--env-file=/etc/application/application.env',   // Node.js 20.6+ reads the .env file
      exec_mode: 'cluster',                   // several processes share port 3000
      instances: 2,                           // 'max' = one per CPU core; leave RAM for the rest
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',                    // listen only locally: Nginx is the public entry
        PORT: '3000',
      },
      max_memory_restart: '512M',             // restart a process that grows beyond this
      kill_timeout: 5000,                     // ms to finish requests on reload/stop
      listen_timeout: 10000,
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10,
      exp_backoff_restart_delay: 200,         // wait longer between repeated crashes
      out_file: '/var/log/application/backend.out.log',
      error_file: '/var/log/application/backend.err.log',
      merge_logs: true,
      time: true,                             // timestamp every log line
    },
    {
      // ---------------------------------------------------- Python API (port 5000)
      name: 'app-api',
      cwd: '/var/www/api',
      script: '/var/www/api/.venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 5000 --workers 2 --proxy-headers --forwarded-allow-ips 127.0.0.1 --env-file /etc/application/application.env',
      interpreter: 'none',                    // run the binary directly (not through node)
      exec_mode: 'fork',
      instances: 1,                           // Uvicorn manages its own workers
      env: {
        PYTHONUNBUFFERED: '1',
      },
      max_memory_restart: '768M',
      kill_timeout: 8000,
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10,
      out_file: '/var/log/application/api.out.log',
      error_file: '/var/log/application/api.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

Notes:

- `--env-file` in `node_args` needs Node.js 20.6 or newer. If the variables are missing in the app (check with `sudo -iu app pm2 env 0` or a log line), load the file in code instead: `process.loadEnvFile('/etc/application/application.env')` (Node.js 20.12+/21.7+) at the top of the entry file, or the `dotenv` package with an absolute path.
- `--env-file` for Uvicorn needs the `python-dotenv` package in the virtual environment (`pip install python-dotenv`). Flask: `gunicorn -w 2 -b 127.0.0.1:5000 app:app`; Django: `gunicorn -w 3 -b 127.0.0.1:5000 project.wsgi`.
- Variables set in `env:` take priority over the same names in the `.env` file.
- Another app on port 8080? Add a third block with `PORT: '8080'` and an Nginx `location`/`server` for it. Don't open 8080 in any firewall.

**Install:**

```bash
sudo nano /etc/application/ecosystem.config.js
sudo chown root:app /etc/application/ecosystem.config.js && sudo chmod 640 /etc/application/ecosystem.config.js
```

### 8.3 Environment variables (`.env.example`)

Two files:

| File | Where | Content |
|---|---|---|
| `.env.example` | **In the Git repository** | Every variable name with a placeholder value and a comment. No real values |
| `application.env` | **Only on the server**: `/etc/application/application.env`, `root:app 640` | The real values. Never in Git, never under `/var/www` |

```bash
# .env.example — copy to /etc/application/application.env on the server and fill in real values.
# Never commit real values. Generate secrets with:  openssl rand -hex 32

# ---------- Application
NODE_ENV=production
APP_NAME=application
APP_URL=https://example.com
# Node.js backend (Nginx forwards to it)
HOST=127.0.0.1
PORT=3000
# Python API
API_HOST=127.0.0.1
API_PORT=5000
LOG_LEVEL=info

# ---------- Security
# Session / JWT signing secret: 64 hex characters
APP_SECRET=CHANGE_ME_openssl_rand_hex_32
JWT_SECRET=CHANGE_ME_openssl_rand_hex_32
JWT_EXPIRES_IN=1h
# Comma-separated origins allowed to call the API from a browser
CORS_ORIGINS=https://example.com,https://www.example.com
# Trust only the local Nginx for X-Forwarded-* headers
TRUST_PROXY=loopback

# ---------- Database (choose one; the database listens on 127.0.0.1 only)
DATABASE_URL=postgresql://appdb_user:CHANGE_ME@127.0.0.1:5432/appdb
# DATABASE_URL=mysql://appdb_user:CHANGE_ME@127.0.0.1:3306/appdb
DB_POOL_MIN=2
DB_POOL_MAX=10

# ---------- Optional cache
# REDIS_URL=redis://127.0.0.1:6379/0

# ---------- Files
UPLOAD_DIR=/var/www/application/uploads
MAX_UPLOAD_MB=50

# ---------- Email (transactional provider)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=CHANGE_ME
SMTP_PASSWORD=CHANGE_ME
MAIL_FROM="Application <no-reply@example.com>"

# ---------- Third-party APIs
# EXAMPLE_API_KEY=CHANGE_ME
```

**Install on the server:**

**Where: server · As: deploy (sudo)**

```bash
sudo nano /etc/application/application.env           # paste .env.example, replace every CHANGE_ME
sudo chown root:app /etc/application/application.env
sudo chmod 640 /etc/application/application.env
sudo -iu app test -r /etc/application/application.env && echo "app can read it"
```

After changing it, reload with `sudo -iu app pm2 reload /etc/application/ecosystem.config.js --update-env`.

### 8.4 UFW firewall configuration

**Path:** `/opt/scripts/ufw-setup.sh` · **Owner/mode:** `root:root 750` · Run whenever you need to rebuild the firewall rules from scratch.

```bash
#!/usr/bin/env bash
# /opt/scripts/ufw-setup.sh — (re)build the host firewall: deny incoming, allow 22 (admins), 80, 443.
# Usage:  sudo ADMIN_IPS="198.51.100.25 203.0.113.7" /opt/scripts/ufw-setup.sh
#         sudo /opt/scripts/ufw-setup.sh          # no admin IPs: SSH open to all but rate-limited
set -euo pipefail

ADMIN_IPS="${ADMIN_IPS:-}"
CURRENT_IP="$(echo "${SSH_CLIENT:-}" | awk '{print $1}')"

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo." >&2; exit 1; fi

# Safety: don't lock out the person running the script
if [ -n "$ADMIN_IPS" ] && [ -n "$CURRENT_IP" ] && ! grep -qw -- "$CURRENT_IP" <<<"$ADMIN_IPS"; then
  echo "Your current IP ($CURRENT_IP) is not in ADMIN_IPS. Add it or you may lose SSH access." >&2
  exit 1
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed

if [ -n "$ADMIN_IPS" ]; then
  for ip in $ADMIN_IPS; do
    ufw allow from "$ip" to any port 22 proto tcp comment "SSH admin $ip"
  done
else
  ufw limit 22/tcp comment 'SSH rate-limited'
fi

ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Application ports (3000, 5000, 8080) and databases (3306, 5432, 6379) stay closed on purpose.

ufw logging low
ufw --force enable
ufw status verbose
```

**Install and run:**

```bash
sudo nano /opt/scripts/ufw-setup.sh && sudo chmod 750 /opt/scripts/ufw-setup.sh
sudo ADMIN_IPS="<YOUR_IP>" /opt/scripts/ufw-setup.sh
```

UFW stores its rules in `/etc/ufw/user.rules` and `/etc/ufw/user6.rules` (don't edit them by hand). Ping (ICMP echo) is allowed by UFW's default `/etc/ufw/before.rules`; the provider firewall decides whether ping reaches the server.

### 8.5 SSH configuration

#### Server: `/etc/ssh/sshd_config.d/00-hardening.conf`

Owner `root:root`, mode `644`. Applied in [6.6](#66-secure-ssh).

```text
# /etc/ssh/sshd_config.d/00-hardening.conf
# Read BEFORE other files in this folder: in OpenSSH the first value found wins.

# --- Who may log in, and how
PermitRootLogin no                 # admins log in as 'deploy' and use sudo
PasswordAuthentication no          # SSH keys only — disable ONLY after key login works
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers deploy                  # space-separated; add other admin users here

# --- Limit guessing and idle sessions
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
ClientAliveInterval 300            # check idle clients every 5 min ...
ClientAliveCountMax 2              # ... and disconnect after 2 missed answers

# --- Features not needed on a web server
X11Forwarding no
PermitUserEnvironment no
# AllowTcpForwarding no            # uncomment to forbid SSH tunnels (also blocks VS Code Remote / DB tunnels)
# AllowAgentForwarding no
```

Apply and verify:

```bash
sudo sshd -t && sudo systemctl restart ssh
sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|allowusers|maxauthtries)'
```

**Changing the SSH port** (optional, mainly reduces log noise): open the new port in the provider firewall and UFW **first**, add `Port 2222` to the file, then on Ubuntu 24.04+ (where SSH starts through `ssh.socket`) run `sudo systemctl daemon-reload && sudo systemctl restart ssh.socket`, and test `ssh -p 2222 deploy@<SERVER_IP>` before removing port 22.

#### Your computer: `~/.ssh/config`

```text
# ~/.ssh/config  (mode 600)
Host app-prod
    HostName <SERVER_IP>
    User deploy
    IdentityFile ~/.ssh/server_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 60

Host app-prod-tunnel
    HostName <SERVER_IP>
    User deploy
    IdentityFile ~/.ssh/server_ed25519
    LocalForward 5433 127.0.0.1:5432     # reach PostgreSQL safely at localhost:5433
```

### 8.6 SSL configuration (Let's Encrypt)

Let's Encrypt certificates are free, valid for 90 days and renewed automatically by certbot. Full procedure: [10.3](#103-get-the-ssl-certificate).

#### Install certbot (snap, the method recommended by the certbot project)

```bash
sudo apt -y remove certbot          # remove an apt-installed certbot if present
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/bin/certbot
certbot --version
```

#### Issue the certificate (webroot method; works with the configs in 8.1)

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  -d example.com -d www.example.com \
  --email admin@example.com --agree-tos --no-eff-email
```

Files created (referenced by 8.1.4):

| File | Content |
|---|---|
| `/etc/letsencrypt/live/example.com/fullchain.pem` | Certificate + intermediate chain → `ssl_certificate` |
| `/etc/letsencrypt/live/example.com/privkey.pem` | Private key → `ssl_certificate_key` (root only) |
| `/etc/letsencrypt/renewal/example.com.conf` | How certbot renews (method, webroot path); managed by certbot |

#### Reload Nginx after every renewal: `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`

Owner `root:root`, mode `755`.

```bash
#!/bin/sh
# Runs after each successful renewal so Nginx serves the new certificate.
nginx -t -q && systemctl reload nginx
```

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'EOF'
#!/bin/sh
nginx -t -q && systemctl reload nginx
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

#### Automatic renewal

The snap installs a systemd timer that tries renewal twice a day and renews certificates 30 days before expiry:

```bash
systemctl list-timers | grep -i certbot       # Expected: snap.certbot.renew.timer ... (next run time)
sudo certbot renew --dry-run                  # Expected: "Congratulations, all simulated renewals succeeded"
```

#### Alternative: a commercial certificate

Put the files in `/etc/ssl/` and point Nginx to them:

```bash
sudo install -m 644 example.com.fullchain.crt /etc/ssl/example.com.fullchain.crt   # certificate + intermediates
sudo install -m 600 example.com.key /etc/ssl/private/example.com.key               # private key
# In 8.1.4 use:
#   ssl_certificate     /etc/ssl/example.com.fullchain.crt;
#   ssl_certificate_key /etc/ssl/private/example.com.key;
```

Renew it manually before it expires (put a calendar reminder; monitor.sh in 8.9 also warns 14 days before expiry).

### 8.7 Deployment script (`deploy.sh`)

**Path:** `/opt/scripts/deploy.sh` · **Owner/mode:** `root:root 755` · **Runs as:** `app` (never as root)

What it does: locks against parallel runs → remembers the current commit of each component → fetches the requested branch/tag → installs dependencies and builds → reloads PM2 (zero-downtime in cluster mode) → checks the health endpoints → **rolls back automatically** if any step fails.

```bash
#!/usr/bin/env bash
# /opt/scripts/deploy.sh — update code, build, reload PM2, health-check, roll back on failure.
# Usage (on the server, as your admin user):
#   sudo -iu app /opt/scripts/deploy.sh                    # deploy branch 'main'
#   sudo -iu app /opt/scripts/deploy.sh v1.4.0             # deploy a tag (or another branch)
#   sudo -iu app RUN_MIGRATIONS=1 /opt/scripts/deploy.sh   # also run 'npm run migrate' in the backend
# Every component (backend, frontend, api) that is a Git checkout is deployed with the same ref.
set -Eeuo pipefail
umask 027                                   # new files 640, folders 750 (group www-data via setgid)

REF="${1:-main}"
BACKEND_DIR=/var/www/application/backend
FRONTEND_DIR=/var/www/application/frontend
API_DIR=/var/www/api
ECOSYSTEM=/etc/application/ecosystem.config.js
LOG=/var/log/application/deploy.log
LOCK="$HOME/.deploy.lock"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"

if [ "$(id -un)" != "app" ]; then echo "Run as the app user: sudo -iu app $0 $*" >&2; exit 1; fi

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }

COMPONENTS=()
HEALTH_URLS=()
[ -d "$BACKEND_DIR/.git" ]  && COMPONENTS+=("$BACKEND_DIR")  && HEALTH_URLS+=("http://127.0.0.1:3000/health")
[ -d "$FRONTEND_DIR/.git" ] && COMPONENTS+=("$FRONTEND_DIR")
[ -d "$API_DIR/.git" ]      && COMPONENTS+=("$API_DIR")      && HEALTH_URLS+=("http://127.0.0.1:5000/health")
[ "${#COMPONENTS[@]}" -gt 0 ] || { log "No Git checkouts found. See section 9.2."; exit 1; }

declare -A PREV

update_code() {   # $1 = directory, $2 = branch, tag or commit
  local target
  git -C "$1" fetch --prune --tags origin || return 1
  target=$(git -C "$1" rev-parse --verify --quiet "origin/$2^{commit}" \
        || git -C "$1" rev-parse --verify --quiet "$2^{commit}") || { log "Unknown ref '$2' in $1"; return 1; }
  git -C "$1" checkout --force --detach "$target" || return 1
  log "  $1 -> $(git -C "$1" log -1 --format='%h %s (%an)')"
}

build_component() {   # $1 = directory
  case "$1" in
    "$BACKEND_DIR")
      cd "$1"                                    || return 1
      npm ci --no-audit --no-fund                || return 1
      npm run build --if-present                 || return 1
      if [ "$RUN_MIGRATIONS" = "1" ]; then npm run migrate --if-present || return 1; fi
      npm prune --omit=dev                       || return 1 ;;
    "$FRONTEND_DIR")
      cd "$1"                                    || return 1
      npm ci --no-audit --no-fund                || return 1
      npm run build                              || return 1   # writes frontend/dist (Nginx web root)
      [ -f dist/index.html ] || { log "dist/index.html missing after the build"; return 1; } ;;
    "$API_DIR")
      cd "$1"                                    || return 1
      [ -x .venv/bin/python ] || python3 -m venv .venv || return 1
      .venv/bin/pip install --quiet -r requirements.txt || return 1 ;;
  esac
}

reload_apps() {
  # '9>&-' closes the lock file for PM2, so a PM2 daemon started here can't keep holding the lock
  pm2 startOrReload "$ECOSYSTEM" --update-env 9>&- || return 1
  pm2 save                                     9>&- || return 1
}

check_health() {
  local url
  for url in "${HEALTH_URLS[@]}"; do
    for _ in $(seq 1 15); do
      if curl -fsS -m 5 -o /dev/null "$url"; then log "  health OK: $url"; continue 2; fi
      sleep 2
    done
    log "  health FAILED: $url"; return 1
  done
}

rollback() {
  log "Rolling back to the previous version"
  local d
  for d in "${COMPONENTS[@]}"; do
    git -C "$d" checkout --force --detach "${PREV[$d]}" || log "  checkout failed in $d"
    build_component "$d"                              || log "  rebuild failed in $d"
  done
  reload_apps || log "  PM2 reload failed during rollback"
  check_health || log "  previous version is not healthy either: investigate now (section 15)"
}

fail() { log "ERROR: $*"; rollback; log "=== Deploy of '$REF' FAILED (rolled back)"; exit 1; }

main() {
  trap 'log "Unexpected error on line $LINENO"' ERR
  exec 9>"$LOCK"
  flock -n 9 || { log "Another deployment is running."; exit 1; }

  log "=== Deploy of '$REF' started (by ${SUDO_USER:-app})"
  for d in "${COMPONENTS[@]}"; do PREV[$d]=$(git -C "$d" rev-parse HEAD); done

  for d in "${COMPONENTS[@]}"; do update_code "$d" "$REF" || fail "Git update failed in $d"; done
  for d in "${COMPONENTS[@]}"; do log "Building $d"; build_component "$d" || fail "Build failed in $d"; done
  log "Reloading applications"
  reload_apps  || fail "PM2 reload failed"
  check_health || fail "Health check failed"

  log "=== Deploy of '$REF' finished successfully"
}

main 2>&1 | tee -a "$LOG"                    # show the output and keep a copy in deploy.log
```

**Install:**

**Where: server · As: deploy (sudo)**

```bash
sudo nano /opt/scripts/deploy.sh
sudo chown root:root /opt/scripts/deploy.sh && sudo chmod 755 /opt/scripts/deploy.sh
sudo -iu app /opt/scripts/deploy.sh          # first run after section 9
```

Expected (end of output):

```text
2026-11-17 10:42:03    health OK: http://127.0.0.1:3000/health
2026-11-17 10:42:04    health OK: http://127.0.0.1:5000/health
2026-11-17 10:42:04  === Deploy of 'main' finished successfully
```

Notes:

- The application must answer `GET /health` with HTTP 200 on ports 3000 and 5000 (a simple route that returns `{"status":"ok"}`). Change the URLs in the script if yours differ.
- The server never has local code changes: `checkout --force` discards them. Fix things in Git, not on the server.
- **Database migrations can't be rolled back by this script.** Write migrations that are backward compatible (add columns first, remove them in a later release), and take a backup before migrating: `sudo /opt/scripts/backup.sh`.
- The frontend is rebuilt in place, so for a few seconds during `npm run build` some static files may be missing. If that matters, build in CI and upload the finished `dist/` (9.2, option B).

### 8.8 Backup script (`backup.sh`)

Backs up the **database**, **uploads** and **server configuration** into a dated folder, optionally **encrypts** each file with [age](https://github.com/FiloSottile/age) (the server holds only the public key, so a stolen server can't decrypt old backups), copies the folder **off the server** with [rclone](https://rclone.org/docs/), and deletes old copies.

#### 8.8.1 Settings: `/etc/application/backup.env`

Owner `root:root`, mode `600`.

```bash
# /etc/application/backup.env — read by /opt/scripts/backup.sh
DB_ENGINE=postgres                 # postgres | mysql | none
DB_NAME=appdb
KEEP_DAYS=7                        # local copies in /var/www/application/backups
# age PUBLIC key (starts with age1...). The matching private key stays OFFLINE (password manager / safe).
AGE_RECIPIENT=
# rclone remote and path for the off-site copy, e.g. offsite:example-backups/application-prod (empty = local only)
RCLONE_REMOTE=
OFFSITE_KEEP_DAYS=30
# Optional overrides (defaults are in the script):
# UPLOADS_DIR=/var/www/application/uploads          # empty = don't back up uploads
# CONFIG_PATHS="/etc/application /etc/nginx /etc/letsencrypt ..."   # space-separated
```

#### 8.8.2 The script: `/opt/scripts/backup.sh`

Owner `root:root`, mode `750`. Runs as **root**.

```bash
#!/usr/bin/env bash
# /opt/scripts/backup.sh — back up database, uploads and server configuration.
# Usage:  sudo /opt/scripts/backup.sh          (cron runs it daily, see 8.9.4)
# Restore: section 13.6
set -Eeuo pipefail
umask 077                                    # backup files readable by root only

ENV_FILE=/etc/application/backup.env
# shellcheck source=/dev/null
[ -r "$ENV_FILE" ] && . "$ENV_FILE"
: "${BACKUP_DIR:=/var/www/application/backups}"
: "${DB_ENGINE:=none}"
: "${DB_NAME:=appdb}"
: "${KEEP_DAYS:=7}"
: "${UPLOADS_DIR=/var/www/application/uploads}"      # empty value = no uploads backup
: "${CONFIG_PATHS:=/etc/application /etc/nginx /etc/letsencrypt /etc/ssh/sshd_config.d /etc/fail2ban/jail.local /etc/ufw /etc/cron.d/application /etc/logrotate.d/application /opt/scripts /home/app/.pm2/dump.pm2}"
: "${AGE_RECIPIENT:=}"
: "${RCLONE_REMOTE:=}"
: "${OFFSITE_KEEP_DAYS:=30}"
STAMP_FILE=/var/lib/application-backup/last-success

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }
exec 9>/run/application-backup.lock
flock -n 9 || { echo "A backup is already running."; exit 1; }

log() { echo "$(date '+%F %T') $*"; }
trap 'log "ERROR on line $LINENO: backup NOT completed"' ERR

STAMP=$(date +%Y-%m-%d_%H%M)
HOST=$(hostname -s)
WORK="$BACKUP_DIR/$STAMP"
mkdir -p "$WORK"
log "Backup $STAMP started -> $WORK"

# Warn when the disk is getting full (backups need space too)
USED=$(df -P "$BACKUP_DIR" | awk 'NR==2 {gsub("%",""); print $5}')
[ "$USED" -lt 90 ] || log "WARNING: disk for $BACKUP_DIR is ${USED}% full"

# 1. Database (consistent dump while the application keeps running)
case "$DB_ENGINE" in
  postgres)
    # The postgres user runs the dump; root's shell writes the file (intended)
    # shellcheck disable=SC2024
    sudo -u postgres pg_dump --format=custom --compress=6 "$DB_NAME" > "$WORK/db-$DB_NAME.dump"
    # shellcheck disable=SC2024
    sudo -u postgres pg_dumpall --globals-only > "$WORK/db-globals.sql"     # roles and their settings
    ;;
  mysql)
    mysqldump --single-transaction --quick --routines --triggers --events "$DB_NAME" | gzip -6 > "$WORK/db-$DB_NAME.sql.gz"
    ;;
  none) log "DB_ENGINE=none: no database dump" ;;
  *)    log "Unknown DB_ENGINE '$DB_ENGINE'"; exit 1 ;;
esac

# 2. User uploads (skipped when UPLOADS_DIR is empty)
if [ -n "$UPLOADS_DIR" ] && [ -d "$UPLOADS_DIR" ]; then
  tar -C "$(dirname "$UPLOADS_DIR")" -czf "$WORK/uploads.tar.gz" "$(basename "$UPLOADS_DIR")"
fi

# 3. Server configuration (contains secrets and private keys: root-only, encrypted below)
CFG=()
for p in $CONFIG_PATHS; do [ -e "$p" ] && CFG+=("${p#/}"); done
tar -C / -czf "$WORK/config.tar.gz" "${CFG[@]}"

# 4. Encrypt (optional but strongly recommended for off-site copies) and checksum
if [ -n "$AGE_RECIPIENT" ]; then
  for f in "$WORK"/*; do age -r "$AGE_RECIPIENT" -o "$f.age" "$f" && rm -f "$f"; done
fi
( cd "$WORK" && sha256sum -- * > SHA256SUMS )
log "Created $(du -sh "$WORK" | cut -f1): $(cd "$WORK" && ls | tr '\n' ' ')"

# 5. Off-site copy
if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$WORK" "$RCLONE_REMOTE/$HOST/$STAMP"
  rclone delete "$RCLONE_REMOTE/$HOST" --min-age "${OFFSITE_KEEP_DAYS}d"
  rclone rmdirs "$RCLONE_REMOTE/$HOST" --leave-root
  log "Off-site copy: $RCLONE_REMOTE/$HOST/$STAMP"
else
  log "WARNING: RCLONE_REMOTE is empty: the backup exists only on this server"
fi

# 6. Local retention
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +

mkdir -p "$(dirname "$STAMP_FILE")" && date -Is > "$STAMP_FILE"     # read by monitor.sh
log "Backup $STAMP finished"
```

#### 8.8.3 Install and test

**Where: server · As: deploy (sudo)** (key generation: **your computer**)

```bash
# Tools
sudo apt -y install age rclone

# Settings and script
sudo nano /etc/application/backup.env && sudo chown root:root /etc/application/backup.env && sudo chmod 600 /etc/application/backup.env
sudo nano /opt/scripts/backup.sh      && sudo chmod 750 /opt/scripts/backup.sh
```

Create the encryption key pair **on your computer**, not on the server (install `age` there: `brew install age`, `sudo apt install age`, or a release from the age GitHub page):

```bash
age-keygen -o application-backup-key.txt
# Output: Public key: age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs...   (example)
```

Put the **public** key (`age1…`) into `AGE_RECIPIENT` in `backup.env`. Store `application-backup-key.txt` (the private key) in your password manager or another safe place **outside** the server. Without it, encrypted backups can't be restored.

Off-site storage (optional, recommended): create a bucket at your storage provider (Amazon S3, DigitalOcean Spaces, Backblaze B2, …) with an access key limited to that bucket, then on the server:

```bash
sudo rclone config        # n (new remote) → name: offsite → storage type (e.g. "s3") → provider → keys → region/endpoint
sudo rclone lsd offsite:  # Expected: lists your bucket(s)
```

rclone stores the keys in `/root/.config/rclone/rclone.conf` (root only). Set `RCLONE_REMOTE=offsite:<bucket>/application-prod` in `backup.env`.

Run a first backup and check it:

```bash
sudo /opt/scripts/backup.sh
sudo ls -la /var/www/application/backups/*/
sudo sh -c 'cd /var/www/application/backups/$(ls /var/www/application/backups | tail -1) && sha256sum -c SHA256SUMS'
```

Expected: lines ending in `OK` for every file, and `Backup … finished` in the script output. Schedule it in [8.9.4](#894-schedule-backup-and-monitoring-with-cron).

### 8.9 Monitoring script (`monitor.sh`)

Checks disk, memory, load, services, PM2 processes, health endpoints, certificate expiry and backup age every 5 minutes. It sends **one alert when a check starts failing**, a reminder every hour while it keeps failing, and **one message when it recovers**, to a chat webhook (Slack, Discord, Mattermost, Google Chat).

#### 8.9.1 Settings: `/etc/application/monitor.env`

Owner `root:root`, mode `600` (the webhook URL is a secret: anyone with it can post to your channel).

```bash
# /etc/application/monitor.env — read by /opt/scripts/monitor.sh
ALERT_WEBHOOK_URL=                 # incoming-webhook URL from Slack / Discord / Mattermost / Google Chat
ALERT_FORMAT=slack                 # slack (also Mattermost, Google Chat) | discord
SITE_URL=https://example.com/health
LOCAL_HEALTH_URLS="http://127.0.0.1:3000/health http://127.0.0.1:5000/health"
SERVICES="nginx pm2-app fail2ban"  # add postgresql or mysql if installed
DISK_MAX_PCT=85
MEM_MIN_AVAIL_PCT=10
LOAD_MAX_PER_CPU=2
CERT_FILE=/etc/letsencrypt/live/example.com/fullchain.pem
CERT_MIN_DAYS=14
BACKUP_MAX_AGE_HOURS=26            # 0 = don't check backups
REMIND_MINUTES=60
```

#### 8.9.2 The script: `/opt/scripts/monitor.sh`

Owner `root:root`, mode `750`. Runs as **root**.

```bash
#!/usr/bin/env bash
# /opt/scripts/monitor.sh — health checks with change-based alerts.
# Usage:  sudo /opt/scripts/monitor.sh               (cron: every 5 minutes, see 8.9.4)
#         sudo /opt/scripts/monitor.sh --test-alert  (send a test message)
set -uo pipefail                              # no 'set -e': one failing check must not stop the others

ENV_FILE=/etc/application/monitor.env
# shellcheck source=/dev/null
[ -r "$ENV_FILE" ] && . "$ENV_FILE"
: "${ALERT_WEBHOOK_URL:=}"
: "${ALERT_FORMAT:=slack}"
: "${SITE_URL:=}"
: "${LOCAL_HEALTH_URLS:=}"
: "${SERVICES:=nginx pm2-app fail2ban}"
: "${PM2_USER:=app}"
: "${DISK_MAX_PCT:=85}"
: "${MEM_MIN_AVAIL_PCT:=10}"
: "${LOAD_MAX_PER_CPU:=2}"
: "${CERT_FILE:=}"
: "${CERT_MIN_DAYS:=14}"
: "${BACKUP_MAX_AGE_HOURS:=26}"
: "${BACKUP_STAMP:=/var/lib/application-backup/last-success}"
: "${REMIND_MINUTES:=60}"

STATE_DIR=/var/lib/app-monitor
mkdir -p "$STATE_DIR"
HOST=$(hostname -s)
FAILED=0

send_alert() {
  local msg="[$HOST] $1" key=text payload
  echo "$(date '+%F %T') ALERT $msg"
  [ -n "$ALERT_WEBHOOK_URL" ] || return 0
  [ "$ALERT_FORMAT" = "discord" ] && key=content
  payload=$(python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: sys.argv[2]}))' "$key" "$msg")
  curl -fsS -m 10 -H 'Content-Type: application/json' -d "$payload" "$ALERT_WEBHOOK_URL" > /dev/null \
    || echo "$(date '+%F %T') could not deliver the alert to the webhook"
}

# report NAME ok|fail MESSAGE  -> alerts only on changes (plus reminders)
report() {
  local name=$1 status=$2 msg=$3 state="$STATE_DIR/$1.failed"
  printf '%-5s %-14s %s\n' "$status" "$name" "$msg"
  if [ "$status" = "fail" ]; then
    FAILED=$((FAILED + 1))
    if [ ! -f "$state" ]; then
      send_alert "PROBLEM $name: $msg"; echo "$msg" > "$state"
    elif [ -n "$(find "$state" -mmin +"$REMIND_MINUTES")" ]; then
      send_alert "STILL FAILING $name: $msg"; touch "$state"
    fi
  elif [ -f "$state" ]; then
    send_alert "RECOVERED $name: $msg"; rm -f "$state"
  fi
}

if [ "${1:-}" = "--test-alert" ]; then send_alert "Test alert from monitor.sh"; exit 0; fi

# --- Disk space and inodes (real file systems only)
FULL=$(df -P -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null \
       | awk -v max="$DISK_MAX_PCT" 'NR>1 {u=$5; sub("%","",u); if (u+0 >= max) printf "%s %s%% ", $6, u}')
INODES=$(df -Pi -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null \
       | awk -v max="$DISK_MAX_PCT" 'NR>1 && $5 != "-" {u=$5; sub("%","",u); if (u+0 >= max) printf "%s inodes %s%% ", $6, u}')
ROOT_USE=$(df -P / | awk 'NR==2 {print $5}')
if [ -z "$FULL$INODES" ]; then report disk ok "/ at $ROOT_USE"; else report disk fail "$FULL$INODES"; fi

# --- Memory
AVAIL=$(awk '/^MemTotal/ {t=$2} /^MemAvailable/ {a=$2} END {printf "%d", a*100/t}' /proc/meminfo)
if [ "$AVAIL" -ge "$MEM_MIN_AVAIL_PCT" ]; then report memory ok "${AVAIL}% available"
else report memory fail "only ${AVAIL}% RAM available"; fi

# --- CPU load (5-minute average compared with the number of CPUs)
read -r _ LOAD5 _ < /proc/loadavg
CPUS=$(nproc)
if awk -v l="$LOAD5" -v c="$CPUS" -v f="$LOAD_MAX_PER_CPU" 'BEGIN {exit !(l <= c*f)}'; then
  report load ok "5-min load $LOAD5 on $CPUS CPU(s)"
else report load fail "5-min load $LOAD5 on $CPUS CPU(s)"; fi

# --- System services
for svc in $SERVICES; do
  ST=$(systemctl is-active "$svc" 2>/dev/null)
  if [ "$ST" = "active" ]; then report "svc-$svc" ok "active"
  else report "svc-$svc" fail "service $svc is ${ST:-unknown}"; fi
done

# --- PM2 processes (all must be 'online')
if command -v pm2 > /dev/null; then
  BAD=$(sudo -u "$PM2_USER" -H pm2 jlist 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read(); start = raw.find("[")
try:
    procs = json.loads(raw[start:]) if start >= 0 else None
except ValueError:
    procs = None
if procs is None:
    print("pm2 list unreadable")
else:
    bad = ["%s=%s" % (p["name"], p["pm2_env"]["status"]) for p in procs if p["pm2_env"]["status"] != "online"]
    print("no processes" if not procs else " ".join(bad))')
  if [ -z "$BAD" ]; then report pm2 ok "all processes online"; else report pm2 fail "$BAD"; fi
fi

# --- Application health endpoints (directly, bypassing Nginx)
for url in $LOCAL_HEALTH_URLS; do
  name="local-${url##*:}"; name="${name%%/*}"
  if curl -fs -m 5 -o /dev/null "$url"; then report "$name" ok "$url"
  else report "$name" fail "$url not answering"; fi
done

# --- Public URL through DNS, Nginx and TLS (an external uptime monitor is still needed, see 12.11)
if [ -n "$SITE_URL" ]; then
  CODE=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$SITE_URL" 2>/dev/null || true)
  if [ "$CODE" = "200" ]; then report site ok "$SITE_URL 200"
  else report site fail "$SITE_URL returned ${CODE:-no answer}"; fi
fi

# --- TLS certificate expiry
if [ -n "$CERT_FILE" ] && [ -r "$CERT_FILE" ]; then
  END=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
  if openssl x509 -checkend $((CERT_MIN_DAYS * 86400)) -noout -in "$CERT_FILE" > /dev/null; then
    report cert ok "valid until $END"
  else report cert fail "expires $END (less than $CERT_MIN_DAYS days): check 'certbot renew'"; fi
fi

# --- Backup age
if [ "$BACKUP_MAX_AGE_HOURS" -gt 0 ]; then
  if [ -f "$BACKUP_STAMP" ] && [ -z "$(find "$BACKUP_STAMP" -mmin +$((BACKUP_MAX_AGE_HOURS * 60)))" ]; then
    report backup ok "last success $(cat "$BACKUP_STAMP")"
  else report backup fail "no successful backup in the last $BACKUP_MAX_AGE_HOURS hours"; fi
fi

echo "$(date '+%F %T') checks finished, $FAILED failing"
exit 0
```

#### 8.9.3 Install and test

**Where: server · As: deploy (sudo)**

```bash
sudo nano /etc/application/monitor.env && sudo chown root:root /etc/application/monitor.env && sudo chmod 600 /etc/application/monitor.env
sudo nano /opt/scripts/monitor.sh      && sudo chmod 750 /opt/scripts/monitor.sh
sudo /opt/scripts/monitor.sh
sudo /opt/scripts/monitor.sh --test-alert       # a message should appear in your chat channel
```

Expected (example):

```text
ok    disk           / at 23%
ok    memory         61% available
ok    load           5-min load 0.18 on 2 CPU(s)
ok    svc-nginx      active
ok    svc-pm2-app    active
ok    svc-fail2ban   active
ok    pm2            all processes online
ok    local-3000     http://127.0.0.1:3000/health
ok    local-5000     http://127.0.0.1:5000/health
ok    site           https://example.com/health 200
ok    cert           valid until Feb 15 09:12:44 2027 GMT
ok    backup         last success 2026-11-17T02:30:41+05:30
2026-11-17 10:55:02 checks finished, 0 failing
```

Webhook URLs: Slack → *Apps → Incoming Webhooks*; Discord → *Channel settings → Integrations → Webhooks*; Mattermost → *Integrations → Incoming Webhooks*.

#### 8.9.4 Schedule backup and monitoring with cron

**Path:** `/etc/cron.d/application` · **Owner/mode:** `root:root 644` (files in `/etc/cron.d` must not contain dots in their names)

```bash
# /etc/cron.d/application — scheduled jobs for the application server
# Format: minute hour day-of-month month day-of-week USER command
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Daily backup at 02:30 (server time zone, see 6.4)
30 2 * * *    root  /opt/scripts/backup.sh  2>&1 | logger -t app-backup

# Health checks every 5 minutes
*/5 * * * *   root  /opt/scripts/monitor.sh 2>&1 | logger -t app-monitor
```

```bash
sudo nano /etc/cron.d/application && sudo chmod 644 /etc/cron.d/application
# Output of both scripts goes to the systemd journal:
journalctl -t app-backup  --since today
journalctl -t app-monitor -n 30
```

Keep backups (02:30) away from the automatic reboot window of unattended-upgrades (03:30, [6.9](#69-automatic-security-updates)).

### 8.10 Log rotation (`logrotate`)

Ubuntu already rotates Nginx logs (`/etc/logrotate.d/nginx`) and system logs. Add a rule for the application logs.

**Path:** `/etc/logrotate.d/application` · **Owner/mode:** `root:root 644`

```text
# /etc/logrotate.d/application — PM2 and deploy logs in /var/log/application
/var/log/application/*.log {
    su app adm
    daily
    rotate 14
    maxsize 100M
    missingok
    notifempty
    compress
    delaycompress
    dateext
    dateformat -%Y%m%d-%s
    copytruncate
}
```

| Directive | Meaning |
|---|---|
| `su app adm` | Rotate as the owner of the folder (logrotate refuses folders writable by non-root users without it) |
| `daily` / `rotate 14` | One file per day, keep 14 days |
| `maxsize 100M` | Rotate earlier if a file grows past 100 MB (checked when logrotate runs) |
| `compress` / `delaycompress` | gzip old files; keep yesterday's uncompressed for easy reading |
| `copytruncate` | Copy then empty the file, so PM2 keeps writing without a reload (a few lines written during the copy can be lost) |

Don't also install the `pm2-logrotate` module: use one rotation method only.

```bash
sudo nano /etc/logrotate.d/application
sudo logrotate --debug /etc/logrotate.d/application      # dry run: shows what would happen
sudo logrotate --force /etc/logrotate.d/application      # rotate now once to test
ls -la /var/log/application/
```

**Limit the systemd journal** (stores cron, backup and monitor output): `/etc/systemd/journald.conf.d/size.conf`

```ini
# /etc/systemd/journald.conf.d/size.conf
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
```

```bash
sudo mkdir -p /etc/systemd/journald.conf.d && sudo nano /etc/systemd/journald.conf.d/size.conf
sudo systemctl restart systemd-journald && journalctl --disk-usage
```

### 8.11 Database configuration

Only needed if you installed a database in [6.16](#616-install-mysql-or-postgresql-only-if-required). The goal: the database **listens on localhost only**, uses strong password hashing, and the application user can reach only its own database. The application gets its connection string from `DATABASE_URL` in `/etc/application/application.env` (8.3).

#### 8.11.1 PostgreSQL

Find the version folder first: `ls /etc/postgresql/` (e.g. `16` on Ubuntu 24.04). Ubuntu's `postgresql.conf` reads every file in `conf.d/`, so put your settings in a separate file.

**Path:** `/etc/postgresql/<VERSION>/main/conf.d/application.conf` · **Owner/mode:** `postgres:postgres 644`

```ini
# /etc/postgresql/<VERSION>/main/conf.d/application.conf
# --- Network: local connections only (never '*' on a public server)
listen_addresses = 'localhost'
port = 5432
max_connections = 100
password_encryption = scram-sha-256

# --- Memory: example for a 4 GB server that also runs the application. Adjust to your RAM.
shared_buffers = 512MB            # about 15-25 % of RAM
effective_cache_size = 1536MB     # planner hint (about 40-50 % of RAM); allocates nothing
work_mem = 8MB                    # per sort/hash step per connection: keep it modest
maintenance_work_mem = 128MB

# --- Logging
log_min_duration_statement = 1000 # log queries slower than 1 second
log_lock_waits = on
```

**Path:** `/etc/postgresql/<VERSION>/main/pg_hba.conf` · **Owner/mode:** `postgres:postgres 640` (who may connect, from where, how)

```text
# /etc/postgresql/<VERSION>/main/pg_hba.conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Administrators: 'sudo -u postgres psql' (Linux user must match the database user)
local   all             postgres                                peer
local   all             all                                     peer

# The application: only its own database, only from this server, password required
host    appdb           appdb_user      127.0.0.1/32            scram-sha-256
host    appdb           appdb_user      ::1/128                 scram-sha-256

# Replication (Ubuntu default, local only)
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
```

Apply and verify:

```bash
sudo nano /etc/postgresql/<VERSION>/main/conf.d/application.conf
sudo nano /etc/postgresql/<VERSION>/main/pg_hba.conf
sudo systemctl restart postgresql            # listen_addresses needs a restart; pg_hba changes need only a reload
sudo -u postgres psql -c "SHOW listen_addresses;" -c "SHOW password_encryption;"
ss -ltnp | grep 5432                          # Expected: 127.0.0.1:5432 and [::1]:5432 only
```

**Database on a separate server** (private network): set `listen_addresses = 'localhost,<DB_PRIVATE_IP>'`, add `host appdb appdb_user <APP_PRIVATE_IP>/32 scram-sha-256`, and allow port 5432 **only from the application server's private IP** in both firewalls.

#### 8.11.2 MySQL

Ubuntu's `/etc/mysql/my.cnf` reads all files in `/etc/mysql/mysql.conf.d/` in alphabetical order; a file starting with `zz-` is read last, so its values win.

**Path:** `/etc/mysql/mysql.conf.d/zz-application.cnf` · **Owner/mode:** `root:root 644`

```ini
# /etc/mysql/mysql.conf.d/zz-application.cnf
[mysqld]
# --- Network: local connections only
bind-address            = 127.0.0.1
mysqlx-bind-address     = 127.0.0.1
# mysqlx                = OFF        # uncomment if nothing uses the X Protocol (port 33060)
max_connections         = 100

# --- Memory: example for a 4 GB server that also runs the application. Adjust to your RAM.
innodb_buffer_pool_size = 1G

# --- Character set and safety
character-set-server    = utf8mb4
collation-server        = utf8mb4_0900_ai_ci
local_infile            = 0

# --- Slow query log
slow_query_log          = 1
slow_query_log_file     = /var/log/mysql/mysql-slow.log
long_query_time         = 1
```

Apply and verify:

```bash
sudo nano /etc/mysql/mysql.conf.d/zz-application.cnf
sudo systemctl restart mysql
sudo mysql -e "SHOW VARIABLES WHERE Variable_name IN ('bind_address','mysqlx_bind_address','local_infile');"
ss -ltnp | grep -E ':3306|:33060'            # Expected: 127.0.0.1 only
```

The application user was created as `'appdb_user'@'localhost'` (6.16), and connects with `DATABASE_URL=mysql://appdb_user:…@127.0.0.1:3306/appdb`. If you see `Access denied for user 'appdb_user'@'127.0.0.1'`, see [15.6](#156-database-problems).

#### 8.11.3 Redis (only if used)

`/etc/redis/redis.conf` (Ubuntu package `redis-server`): keep `bind 127.0.0.1 -::1` and `protected-mode yes` (both are defaults), and set a password with `requirepass` if more than one application shares the server. Restart with `sudo systemctl restart redis-server`, then `ss -ltnp | grep 6379` must show only `127.0.0.1`/`::1`.

---

## 9. Application Deployment

This section is identical on AWS, Hostinger and DigitalOcean. It assumes sections 6, 7 and 8 are done.

### 9.1 Overview

```text
 Your computer / CI                         Server (as 'app')                          Internet
 ───────────────────                        ─────────────────                          ────────
 git push  ──►  Git repository  ──►  git fetch in /var/www/...  ──►  npm ci / build  ──►  PM2 (127.0.0.1:3000, :5000)
                                                                                         ▲
                                       Nginx :443  ◄────────────  https://example.com ───┘
```

| Step | Where | As | Section |
|---|---|---|---|
| Get the code onto the server | Server (or your computer for uploads) | app | 9.2 |
| Create the environment file | Server | deploy (sudo) | 9.3 |
| Install dependencies and build | Server | app | 9.4, 9.5 |
| Start the processes with PM2 | Server | app | 9.6 |
| Configure Nginx | Server | deploy (sudo) | 9.7 |
| DNS and SSL | DNS provider + server | — / deploy (sudo) | 10 |
| Verify | Server + your computer | deploy | 9.8 |
| Later updates | Server | app | 9.9 |

### 9.2 Get the code onto the server

#### Option A: Git clone (recommended)

Uses the deploy key from [6.14](#614-install-git-and-give-the-server-read-access-to-the-repository).

**Where: server · As: app** (start with `sudo -iu app`)

```bash
sudo -iu app                                     # become 'app' (prompt changes to app@...)
git clone git@github.com:ORG/REPO-backend.git  /var/www/application/backend
git clone git@github.com:ORG/REPO-frontend.git /var/www/application/frontend
git clone git@github.com:ORG/REPO-api.git      /var/www/api
exit                                             # back to 'deploy'
```

Expected: `Cloning into '/var/www/application/backend'...` followed by `Receiving objects: 100% ... done.` Clone only the components you have.

**Several repositories:** GitHub accepts a deploy key in **one** repository only. Create one key per repository and give each a host alias:

```bash
sudo -iu app ssh-keygen -t ed25519 -f /home/app/.ssh/deploy_frontend -N "" -C "deploy-key frontend application-prod-1"
sudo -iu app ssh-keygen -t ed25519 -f /home/app/.ssh/deploy_api      -N "" -C "deploy-key api application-prod-1"
```

`/home/app/.ssh/config` (owner `app`, mode `600`):

```text
# /home/app/.ssh/config — one deploy key per repository
Host github-backend
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host github-frontend
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_frontend
    IdentitiesOnly yes

Host github-api
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_api
    IdentitiesOnly yes
```

Then clone with the alias: `git clone github-frontend:ORG/REPO-frontend.git /var/www/application/frontend`.

**One repository with backend and frontend folders (monorepo):** clone it into both `backend/` and `frontend/`, then adjust `cwd`/`script` in the PM2 file (e.g. `script: 'server/dist/server.js'`) and the `cd` lines in `build_component` of `deploy.sh`.

#### Option B: Upload built files (no Git on the server)

Build on your computer or in CI, then upload only the result. Never upload `node_modules`, `.git` or `.env` files.

**Where: your computer**

```bash
# macOS / Linux / Windows PowerShell (OpenSSH includes scp; rsync: macOS/Linux/WSL)
rsync -avz --delete ./dist/ deploy@<SERVER_IP>:/tmp/frontend-dist/
# without rsync:
scp -r ./dist deploy@<SERVER_IP>:/tmp/frontend-dist
```

**Where: server · As: deploy (sudo)**

```bash
sudo rsync -a --delete /tmp/frontend-dist/ /var/www/application/frontend/dist/
sudo chown -R app:www-data /var/www/application/frontend/dist
sudo find /var/www/application/frontend/dist -type d -exec chmod 2750 {} + -o -type f -exec chmod 640 {} +
rm -rf /tmp/frontend-dist
```

Graphical alternatives on Windows: WinSCP or FileZilla in **SFTP** mode with your private key (never plain FTP).

#### Option C: Automatic deployment from CI/CD

Let the CI system (GitHub Actions, GitLab CI, …) log in with its **own** SSH key that is allowed to run **only** the deploy script. On the server, add the CI public key to `/home/deploy/.ssh/authorized_keys` with a forced command:

```text
command="sudo -u app -H /opt/scripts/deploy.sh main",restrict ssh-ed25519 AAAA...CI-PUBLIC-KEY... ci-deploy
```

and allow that one command without a password (`sudo visudo -f /etc/sudoers.d/deploy-ci`):

```text
# /etc/sudoers.d/deploy-ci  (mode 440) — lets 'deploy' run only the deploy script as 'app'
deploy ALL=(app) NOPASSWD: /opt/scripts/deploy.sh
```

The CI job then runs `ssh deploy@<SERVER_IP>`; whatever it sends, the server runs only the deploy script. Store the CI private key in the CI system's encrypted secrets, never in the repository. If you restricted SSH by IP, CI runners need a fixed IP (self-hosted runner or VPN), or use AWS Systems Manager / a bastion host.

### 9.3 Configure environment variables

Create `/etc/application/application.env` from the repository's `.env.example`, exactly as in [8.3](#83-environment-variables-envexample):

**Where: server · As: deploy (sudo)**

```bash
sudo cp /var/www/application/backend/.env.example /etc/application/application.env   # if the repo has one
sudo nano /etc/application/application.env       # replace every CHANGE_ME; generate secrets with: openssl rand -hex 32
sudo chown root:app /etc/application/application.env && sudo chmod 640 /etc/application/application.env
```

Rules:

- **Never** create `.env` files inside `frontend/dist`, `uploads` or any other folder Nginx serves.
- **Frontend build variables are public.** Values such as `VITE_*`, `NEXT_PUBLIC_*` or `REACT_APP_*` end up in the JavaScript that every visitor downloads. Put only public values there (API URL, public analytics ID), never secrets or service-account keys. If the build needs them, keep them in `/var/www/application/frontend/.env.production` (outside `dist`).
- After changing the file: `sudo -iu app pm2 reload /etc/application/ecosystem.config.js --update-env`.

### 9.4 Install dependencies and build (Node.js)

The first time, do it by hand to see every message. Later, `deploy.sh` does the same.

**Where: server · As: app**

```bash
sudo -iu app

# Backend
cd /var/www/application/backend
npm ci                      # exact versions from package-lock.json (commit the lock file!)
npm run build --if-present  # e.g. TypeScript -> dist/
npm prune --omit=dev        # remove development-only packages

# Quick test (stop with Ctrl+C), then in a second SSH session: curl -s http://127.0.0.1:3000/health
node --env-file=/etc/application/application.env dist/server.js

# Frontend
cd /var/www/application/frontend
npm ci
npm run build
ls -la dist/index.html      # must exist

exit
```

Expected: `added 412 packages, and audited 413 packages in 18s` (numbers differ), then the build tool's summary (for Vite: `✓ built in 6.2s`). If `npm ci` fails with *"package-lock.json is out of sync"*, run `npm install` on your computer, commit the updated lock file and deploy again.

### 9.5 Python API setup

**Where: server · As: app**

```bash
sudo -iu app
cd /var/www/api
python3 -m venv .venv                         # private Python environment in /var/www/api/.venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install uvicorn python-dotenv   # only if they are not in requirements.txt (FastAPI)

# Quick test (stop with Ctrl+C), then: curl -s http://127.0.0.1:5000/health
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 5000 --env-file /etc/application/application.env
exit
```

Expected: `Uvicorn running on http://127.0.0.1:5000 (Press CTRL+C to quit)`. For Flask/Django use Gunicorn (`.venv/bin/pip install gunicorn`) and change the `app-api` block in [8.2](#82-pm2-ecosystemconfigjs) accordingly.

### 9.6 Start the applications with PM2

**Where: server · As: deploy (sudo), then app**

```bash
sudo nano /etc/application/ecosystem.config.js                  # content from 8.2
sudo chown root:app /etc/application/ecosystem.config.js && sudo chmod 640 /etc/application/ecosystem.config.js

sudo -iu app pm2 start /etc/application/ecosystem.config.js
sudo -iu app pm2 status
sudo -iu app pm2 save                                            # remember the list for reboots
```

Expected `pm2 status` (columns shortened):

```text
┌────┬──────────────┬─────────┬──────┬────────┬───┬────────┬──────┬──────────┐
│ id │ name         │ mode    │ pid  │ uptime │ ↺ │ status │ cpu  │ mem      │
├────┼──────────────┼─────────┼──────┼────────┼───┼────────┼──────┼──────────┤
│ 0  │ app-backend  │ cluster │ 2211 │ 12s    │ 0 │ online │ 0%   │ 78.4mb   │
│ 1  │ app-backend  │ cluster │ 2218 │ 12s    │ 0 │ online │ 0%   │ 77.9mb   │
│ 2  │ app-api      │ fork    │ 2230 │ 11s    │ 0 │ online │ 0%   │ 61.2mb   │
└────┴──────────────┴─────────┴──────┴────────┴───┴────────┴──────┴──────────┘
```

If the restart counter `↺` keeps growing or the status is `errored`, read the logs: `sudo -iu app pm2 logs --lines 100` ([15.4](#154-application-and-pm2-problems)).

**Test a reboot now**, before going live: `sudo reboot`, wait a minute, reconnect, `sudo -iu app pm2 status` → all `online`.

Everyday PM2 commands (run as `app`, e.g. `sudo -iu app pm2 status`):

| Command | What it does |
|---|---|
| `pm2 status` | List processes, state, restarts, CPU, memory |
| `pm2 logs` / `pm2 logs app-api --lines 200` | Follow logs / show the last 200 lines of one app |
| `pm2 reload app-backend` | Zero-downtime restart (cluster mode: one process at a time) |
| `pm2 restart app-api` | Stop and start (short interruption) |
| `pm2 describe app-backend` | Paths, environment, restart history |
| `pm2 monit` | Live CPU/memory dashboard in the terminal |
| `pm2 startOrReload /etc/application/ecosystem.config.js --update-env` | Apply ecosystem or environment changes |
| `pm2 save` | Save the current list (restored at boot by `pm2-app`) |

### 9.7 Configure Nginx

**Where: server · As: deploy (sudo)**

1. Create the three snippets from [8.1.1–8.1.3](#81-nginx-configuration).
2. Install the **bootstrap** site from [8.1.5](#815-bootstrap-file-http-only-used-once-before-the-first-certificate) and enable it ([8.1.6](#816-enable-the-site)).
3. Check it from the server: `curl -s -H 'Host: example.com' http://127.0.0.1/` → `Server setup in progress`.
4. Continue with [section 10](#10-domain--ssl-configuration) (DNS and certificate); there you replace the bootstrap file with the full HTTPS configuration from 8.1.4.

### 9.8 Verify the deployment

After section 10 is done:

**Where: server · As: deploy**

```bash
sudo -iu app pm2 status                                   # all 'online'
curl -s http://127.0.0.1:3000/health; echo                # {"status":"ok"} from Node.js
curl -s http://127.0.0.1:5000/health; echo                # {"status":"ok"} from the Python API
curl -sI https://example.com | head -3                    # HTTP/2 200
curl -s  https://example.com/api/health; echo             # the API through Nginx
curl -sI http://example.com | grep -iE '^(HTTP|location)' # 301 -> https://example.com/
ss -tulpn | grep LISTEN                                   # 3000/5000 only on 127.0.0.1
sudo tail -n 20 /var/log/nginx/application.error.log      # no new errors
```

**Where: your computer** — the application ports must **not** be reachable from outside:

```bash
nc -zv -w 5 <SERVER_IP> 3000     # Expected: timed out / refused
nc -zv -w 5 <SERVER_IP> 443      # Expected: succeeded
```

(On Windows PowerShell: `Test-NetConnection <SERVER_IP> -Port 3000` → `TcpTestSucceeded : False`.)

Then open `https://example.com` in a browser, check the padlock, and look at the browser console (F12) for errors such as mixed content.

### 9.9 Updating the application

**Where: server · As: deploy** (the script itself runs as `app`)

```bash
sudo -iu app /opt/scripts/deploy.sh                 # latest 'main'
sudo -iu app /opt/scripts/deploy.sh v1.5.0          # a release tag
sudo -iu app /opt/scripts/deploy.sh v1.4.0          # go back to the previous release
tail -n 50 /var/log/application/deploy.log          # what happened
```

Good practice: tag every release in Git (`git tag v1.5.0 && git push --tags`), deploy tags to production, and write down which tag is live. A failed deployment rolls back automatically ([8.7](#87-deployment-script-deploysh)).

**Zero-downtime reloads** need two things in the application: it runs in PM2 **cluster mode** (8.2), and it finishes open requests when it receives `SIGINT` (close the HTTP server, then exit) within `kill_timeout`. Fork-mode apps such as the Python API restart with a short interruption.

---

## 10. Domain & SSL Configuration

### 10.1 DNS records

**Where: the DNS provider of your domain** (registrar, Cloudflare, AWS Route 53, Hostinger hPanel → Domains → DNS / Nameservers, DigitalOcean → Networking → Domains). Platform details: [3.2.5](#325-point-dns-to-the-elastic-ip), [4.7](#47-dns-records), [5.8](#58-networking-and-dns).

| Type | Name / Host | Value | TTL | Notes |
|---|---|---|---|---|
| `A` | `@` (the domain itself) | `<SERVER_IP>` | 300 during setup, later 3600 | Elastic IP on AWS, Reserved IP or Droplet IP on DigitalOcean |
| `A` | `www` | `<SERVER_IP>` | same | Or `CNAME www → example.com` |
| `AAAA` | `@`, `www` | the server's IPv6 address | same | **Only** if IPv6 is enabled on the server and allowed in the provider firewall. A wrong AAAA record breaks the site and certificate issuance for IPv6 users |
| `CAA` | `@` | `0 issue "letsencrypt.org"` | 3600 | Optional: only Let's Encrypt may issue certificates for the domain |

Delete old `A`/`AAAA` records for `@` and `www` that point elsewhere (for example a parking page from the registrar).

**Cloudflare users:** set the records to **DNS only** (grey cloud) until the certificate works. If you later enable the proxy (orange cloud), use SSL mode **Full (strict)**. **Flexible** causes redirect loops with this configuration.

### 10.2 Check DNS propagation

**Where: your computer or the server**

```bash
dig +short example.com A               # Expected: 203.0.113.10 (your server IP)
dig +short www.example.com A
dig @1.1.1.1 +short example.com A      # ask Cloudflare's resolver
dig @8.8.8.8 +short example.com A      # ask Google's resolver
dig +short example.com AAAA            # should be empty unless you configured IPv6
```

Windows PowerShell: `Resolve-DnsName example.com -Type A` or `nslookup example.com 1.1.1.1`.

New records usually appear within minutes; changed records take up to the old TTL to update; a **nameserver change** can take up to 24–48 hours. Don't request the certificate until all resolvers return your server IP.

### 10.3 Get the SSL certificate

Certbot was installed in [8.6](#86-ssl-configuration-lets-encrypt). The HTTP-01 challenge needs **port 80** reachable from the internet.

**Where: server · As: deploy (sudo)**

1. **Pre-checks**

   ```bash
   sudo ufw status | grep -E '80|443'                      # 80/tcp and 443/tcp ALLOW
   sudo nginx -t && systemctl is-active nginx              # bootstrap config (8.1.5) active
   sudo mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
   echo ok | sudo tee /var/www/letsencrypt/.well-known/acme-challenge/test > /dev/null
   curl -s http://example.com/.well-known/acme-challenge/test   # Expected: ok
   sudo rm /var/www/letsencrypt/.well-known/acme-challenge/test
   ```

   Also confirm the provider firewall allows port 80 from `0.0.0.0/0` and `::/0` (AWS Security Group, Hostinger firewall, DigitalOcean Cloud Firewall).

2. **Test run** against the Let's Encrypt staging system (doesn't count towards rate limits):

   ```bash
   sudo certbot certonly --webroot -w /var/www/letsencrypt -d example.com -d www.example.com --dry-run
   ```

   Expected: `The dry run was successful.`

3. **Real certificate**

   ```bash
   sudo certbot certonly --webroot -w /var/www/letsencrypt \
     -d example.com -d www.example.com \
     --email admin@example.com --agree-tos --no-eff-email
   ```

   Expected:

   ```text
   Successfully received certificate.
   Certificate is saved at: /etc/letsencrypt/live/example.com/fullchain.pem
   Key is saved at:         /etc/letsencrypt/live/example.com/privkey.pem
   This certificate expires on 2027-02-15.
   These files will be updated when the certificate renews.
   Certbot has set up a scheduled task to automatically renew this certificate in the background.
   ```

4. **Reload hook** for renewals: create `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` as in 8.6.

5. **Switch Nginx to HTTPS**: replace `/etc/nginx/sites-available/application.conf` with the full file from [8.1.4](#814-etcnginxsites-availableapplicationconf), then:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

**Simpler alternative:** `sudo certbot --nginx -d example.com -d www.example.com` obtains the certificate **and edits your Nginx files** automatically. It's fine for simple sites; this manual uses `certonly --webroot` so that the Nginx configuration stays exactly as documented in section 8.

### 10.4 Test HTTPS

```bash
curl -sI https://example.com | head -3                                   # HTTP/2 200
curl -sI http://example.com | grep -iE '^(HTTP|location)'                # HTTP/1.1 301 ... location: https://example.com/
curl -sI https://www.example.com | grep -iE '^(HTTP|location)'           # 301 -> https://example.com/
curl -sI https://example.com | grep -iE 'x-frame|x-content|referrer'     # security headers present
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates                          # subject CN=example.com, issuer Let's Encrypt
```

For a complete external check, run the free **SSL Labs Server Test** (<https://www.ssllabs.com/ssltest/>) and aim for an **A** rating; it also lists protocol and cipher problems.

### 10.5 Enable HSTS (after HTTPS has worked for some days)

HSTS tells browsers to use only HTTPS for your domain. Mistakes are cached by browsers for the whole `max-age`, so enable it in steps:

1. Uncomment the `Strict-Transport-Security` line in `/etc/nginx/snippets/security-headers.conf` with a short value first: `max-age=300`.
2. `sudo nginx -t && sudo systemctl reload nginx`, test the site and all sub-domains.
3. Raise to `max-age=31536000` (one year). Keep `includeSubDomains` only if **every** sub-domain has HTTPS.
4. HSTS **preload** (hstspreload.org) is very hard to undo. Only for domains that will stay HTTPS-only forever.

### 10.6 Certificate renewal

- Let's Encrypt certificates are currently valid for **90 days**. Let's Encrypt has announced shorter lifetimes: **64 days from 10 February 2027** and **45 days from 16 February 2028** for new certificates. Automatic renewal handles this; manual renewal does not scale.
- Certbot's timer (`snap.certbot.renew.timer`) runs twice a day and renews when a certificate is close to expiry. The deploy hook reloads Nginx.
- **Let's Encrypt no longer sends expiry warning emails** (the service ended in June 2025). Rely on your own checks: `monitor.sh` warns 14 days before expiry (8.9), and an external uptime monitor with certificate checks (12.11) catches problems even when the server itself is down.
- Test renewal after any Nginx, firewall or DNS change:

  ```bash
  sudo certbot renew --dry-run
  sudo certbot certificates          # lists certificates, domains and expiry dates
  ```

### 10.7 Add another domain or sub-domain

Example: `api.example.com` for the API.

1. DNS: `A api → <SERVER_IP>`; wait until `dig +short api.example.com` returns the IP.
2. Nginx: create `/etc/nginx/sites-available/api.conf` with a port-80 server block for `api.example.com` (ACME location + redirect, as in 8.1.4), enable it, `sudo nginx -t && sudo systemctl reload nginx`.
3. Certificate: `sudo certbot certonly --webroot -w /var/www/letsencrypt -d api.example.com`
   (or add it to the existing certificate: `sudo certbot certonly --webroot -w /var/www/letsencrypt --cert-name example.com -d example.com -d www.example.com -d api.example.com --expand`).
4. Add the HTTPS server block for `api.example.com` pointing to `/etc/letsencrypt/live/api.example.com/…` (or `example.com/…` when expanded), with `location / { proxy_pass http://app_api; include /etc/nginx/snippets/proxy-params.conf; }`. Test and reload.

---

## 11. Security Hardening

No configuration makes a server "100 % secure". The goal is **layers**: an attacker must get past several independent controls, and you notice when something goes wrong. Most of the steps below were already done in sections 3–10; this section collects them, adds the remaining ones and ends with a checklist.

### 11.1 Security layers

| Layer | Control | Where configured |
|---|---|---|
| Provider account | MFA, least-privilege users, billing alerts | 11.2 |
| Network edge | Provider firewall: only 22 (restricted), 80, 443 | 3.3 / 4.6 / 5.6 |
| Host firewall | UFW with the same rules | 6.7, 8.4 |
| Login | SSH keys only, no root login, Fail2ban | 6.6, 6.8, 8.5 |
| Operating system | Automatic security updates, few installed services | 6.9 |
| Web server | TLS 1.2/1.3, security headers, request limits, hidden files blocked | 8.1 |
| Application | Non-root user, listens on 127.0.0.1, secrets outside web roots | 6.3, 8.2, 8.3 |
| Data | Database on localhost only, encrypted off-site backups | 8.11, 8.8 |
| Detection | Logs, monitoring and alerts | 12 |

### 11.2 Provider account security

- **AWS**: enable MFA on the **root user** and stop using it for daily work; create IAM users/roles with only the permissions needed (or IAM Identity Center); never create access keys for the root user; enable **AWS Budgets** alerts; consider CloudTrail (account activity log).
- **Hostinger**: enable two-factor authentication on the hPanel account; limit who has access to the account.
- **DigitalOcean**: enable two-factor authentication (5.2); use **Teams** with roles instead of sharing one login; scope API tokens and give them an expiry date.
- Everyone with console access can reset SSH keys and passwords and open firewall ports, so console access is as sensitive as root access on the server.

### 11.3 SSH access

Done in [6.6](#66-secure-ssh) and [8.5](#85-ssh-configuration). Keep it that way:

- One personal key per person (no shared keys); protect private keys with a passphrase.
- When someone leaves: remove their line from `~/.ssh/authorized_keys` of `deploy` (and from the provider console's SSH keys), and their IP from the firewalls.
- Review keys regularly: `sudo cat /home/deploy/.ssh/authorized_keys`, `sudo find /home /root -name authorized_keys -exec ls -l {} \;`.
- Optional extra factor: SSH certificates or hardware keys (`ssh-keygen -t ed25519-sk` with a FIDO2 key).

### 11.4 Firewalls: verify what is open

Check **both** firewalls after every change.

**Where: server**

```bash
sudo ufw status numbered          # host firewall rules
ss -tulpn | grep LISTEN           # what is actually listening
```

**Where: your computer** — scan **your own** server only:

```bash
nmap -Pn --top-ports 1000 <SERVER_IP>
```

Expected: `22/tcp open` (only from allowed IPs; otherwise `filtered`), `80/tcp open`, `443/tcp open`, everything else `filtered` or `closed`. Any other open port must be explained or closed.

### 11.5 Fail2ban

```bash
sudo fail2ban-client status                   # active jails
sudo fail2ban-client status sshd              # banned IPs for SSH
sudo fail2ban-client set sshd unbanip 198.51.100.25   # unban an address (e.g. your own)
sudo zgrep -h 'Ban ' /var/log/fail2ban.log* | tail -20
```

Add your office/VPN IPs to `ignoreip` in `/etc/fail2ban/jail.local` (6.8) so you never ban yourself.

### 11.6 Operating system updates

- Security updates install automatically (6.9). Check that it works: `sudo unattended-upgrade --dry-run --debug 2>&1 | tail -5` and `cat /var/log/unattended-upgrades/unattended-upgrades.log | tail -20`.
- Other updates monthly: `sudo apt update && apt list --upgradable && sudo apt full-upgrade`.
- Reboot needed? `[ -f /var/run/reboot-required ] && cat /var/run/reboot-required.pkgs`. The automatic reboot at 03:30 (6.9) handles kernel updates.
- Remove what you don't use: `sudo apt purge <package>`; `systemctl list-units --type=service --state=running` should list only services you can explain.
- **Ubuntu Pro** (Livepatch kernel patching, extended security maintenance) is available; check the terms for your use at <https://ubuntu.com/pro>.

### 11.7 Web server and TLS

Already configured in [8.1](#81-nginx-configuration):

- TLS 1.2 and 1.3 only, modern ciphers (re-check with <https://ssl-config.mozilla.org/> once a year).
- `server_tokens off` (no version numbers), security headers, HSTS after testing (10.5).
- Hidden files (`.env`, `.git`) and scripts in `uploads/` are refused; directory listing is off.
- Per-IP request and connection limits (`limit_req`, `limit_conn`) and `client_max_body_size`.
- The default site is removed, so requests for unknown host names don't reach the application. Optionally add a catch-all that closes the connection:

  ```nginx
  # /etc/nginx/sites-available/000-default-deny.conf  (enable with a symlink like 8.1.6)
  server {
      listen 80 default_server;
      listen [::]:80 default_server;
      server_name _;
      return 444;            # close the connection without a response
  }
  ```

### 11.8 Database access

- **Never open 3306 (MySQL), 5432 (PostgreSQL), 6379 (Redis) or 27017 (MongoDB) to the internet.** They listen on `127.0.0.1` (8.11) and no firewall rule allows them.
- Administer the database through an **SSH tunnel** (8.5: `LocalForward 5433 127.0.0.1:5432`, then connect your database tool to `localhost:5433`).
- The application uses its own database user with rights on **its own database only**; no `SUPERUSER` / `ALL PRIVILEGES ON *.*`.
- Strong, generated passwords (`openssl rand -base64 24`) stored only in `/etc/application/application.env` and your password manager.
- **Managed databases** (Amazon RDS, DigitalOcean Managed Databases): put them in the same private network (VPC) and allow connections only from the application server (RDS security group / DigitalOcean "Trusted sources"); require TLS.
- Database dumps are backups: encrypted (8.8), never placed in a web directory.

### 11.9 Application security

- Runs as `app` (no sudo, no login password), listens on `127.0.0.1` only.
- Keep dependencies patched: `npm audit --omit=dev` (Node.js), `.venv/bin/pip install pip-audit && .venv/bin/pip-audit` (Python). Enable Dependabot or Renovate in the repository.
- Validate all input on the server; use parameterised database queries / an ORM; never build SQL from strings.
- Sessions and cookies: `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict`); short-lived tokens.
- CORS: allow only your own origins (`CORS_ORIGINS` in 8.3), never `*` together with credentials.
- Rate-limit login and expensive endpoints (Nginx `limit_req` plus application-level limits).
- Uploads: check size and type, store with generated names, never execute them (8.1.4), serve with `X-Content-Type-Options: nosniff`.
- Error pages in production must not show stack traces (`NODE_ENV=production`, `DEBUG=False` in Django).

### 11.10 Secrets management

- Secrets live in `/etc/application/*.env` (`root:app 640` / `root:root 600`), **never** in Git, in frontend code, in mobile app / desktop app packages, in Docker images, in logs or in chat messages.
- Service-account credentials (for example a Firebase Admin / Google service-account JSON file) stay on the server: `/etc/application/` with mode `640`, referenced by path from the environment file. The client apps call your server; they never contain the key.
- Scan repositories for leaked secrets (for example with `gitleaks` or GitHub secret scanning). If a secret was ever committed, **rotate it**: removing it from the latest commit is not enough.
- Rotate secrets when people leave and at least yearly; document where each secret is used.
- Optional for AWS: AWS Systems Manager Parameter Store or Secrets Manager with an instance role instead of files.

### 11.11 File permissions and integrity

```bash
# World-writable files and folders (should be none outside /tmp, /var/tmp, /dev/shm)
sudo find / -xdev -type f -perm -0002 -not -path '/proc/*' 2>/dev/null | head
sudo find / -xdev -type d -perm -0002 -not -path '/proc/*' -not -path '/tmp*' -not -path '/var/tmp*' 2>/dev/null | head
# Secrets readable only by root/app
ls -la /etc/application/
# Files owned by nobody (left over after deleting users)
sudo find / -xdev \( -nouser -o -nogroup \) 2>/dev/null | head
# Verify installed package files against their checksums (install once: sudo apt install debsums)
sudo debsums -s 2>/dev/null | head
```

### 11.12 Audit and logs

```bash
last -n 20                                   # recent logins
sudo lastb -n 20                             # recent failed logins
journalctl -u ssh --since "24 hours ago" | grep -E 'Accepted|Failed' | tail -20
sudo grep -h 'sudo:' /var/log/auth.log | grep COMMAND | tail -20   # commands run with sudo

# Automated security audit with suggestions (read-only)
sudo apt -y install lynis
sudo lynis audit system --quick
```

Lynis prints warnings and suggestions plus a "Hardening index"; treat it as a to-do list, not a score to maximise blindly.

### 11.13 Security checklist

| # | Check | How to verify | ✔ |
|---|---|---|---|
| 1 | MFA on all provider accounts | Provider security settings | ☐ |
| 2 | Provider firewall: only 22 (restricted), 80, 443 | Console | ☐ |
| 3 | UFW active with the same rules | `sudo ufw status verbose` | ☐ |
| 4 | Root login and password login disabled | `sudo sshd -T \| grep -Ei 'permitrootlogin\|passwordauthentication'` → `no` | ☐ |
| 5 | Fail2ban running | `sudo fail2ban-client status sshd` | ☐ |
| 6 | Automatic security updates on | `cat /etc/apt/apt.conf.d/20auto-upgrades` | ☐ |
| 7 | Applications listen on 127.0.0.1 only | `ss -tulpn` | ☐ |
| 8 | Database / Redis not reachable from outside | `ss -tulpn`, `nmap` from outside | ☐ |
| 9 | No secrets in Git or web roots | `gitleaks`, `ls -la` of web roots | ☐ |
| 10 | `.env`, `.git` return 403/404 | `curl -sI https://example.com/.env` | ☐ |
| 11 | HTTPS valid, HTTP redirects to HTTPS | 10.4, SSL Labs | ☐ |
| 12 | Security headers present | `curl -sI https://example.com` | ☐ |
| 13 | Dependencies audited | `npm audit --omit=dev`, `pip-audit` | ☐ |
| 14 | Encrypted off-site backups, restore tested | 13.5 | ☐ |
| 15 | Monitoring and alerts working | `monitor.sh --test-alert`, external uptime monitor | ☐ |
| 16 | Old users, keys and firewall rules removed | 11.3, 3.3.4 | ☐ |

---

## 12. Monitoring & Maintenance

### 12.1 What to monitor

| What | Command (server) | Healthy | Alert when |
|---|---|---|---|
| CPU load | `uptime` | 5-min load below the number of CPUs | Above 2 × CPUs for 10+ min |
| Memory | `free -h` | "available" > 15 % | < 10 % available, or OOM kills |
| Disk space | `df -h` | < 75 % used | ≥ 85 % |
| Disk inodes | `df -i` | < 75 % | ≥ 85 % |
| Network / bandwidth | `vnstat`, `ss -s` | Within plan limits | Unusual spikes, close to plan limit |
| Uptime / reboots | `uptime -p`, `last reboot` | Expected reboots only | Unexpected reboot |
| App processes | `pm2 status` | All `online`, restarts stable | `errored`/`stopped`, restarts climbing |
| Web server | `systemctl status nginx` | active, few 5xx | Inactive, many 502/504 |
| API / website | `curl https://example.com/health` | 200 fast | Non-200 or slow |
| Certificate | `certbot certificates` | > 30 days left | < 14 days |
| Backups | `journalctl -t app-backup` | Daily success | Missing or failed |

`monitor.sh` (8.9) checks most of these automatically every 5 minutes.

### 12.2 CPU

```bash
nproc                         # number of CPUs
uptime                        # load averages for 1, 5, 15 minutes
top                           # press P (sort by CPU), M (by memory), q (quit)
sudo apt -y install htop sysstat
htop                          # friendlier view
mpstat 5 3                    # CPU usage every 5 s, 3 times (sysstat); high %iowait = slow disk
pidstat 5 1                   # per-process CPU
```

**AWS burstable instances (t3/t4g):** sustained high CPU uses up CPU credits; then the instance slows down (or costs extra in *unlimited* mode). Watch **CPUCreditBalance** in CloudWatch, or move to a non-burstable type.

### 12.3 Memory

```bash
free -h                       # look at the "available" column, not "free"
ps aux --sort=-%mem | head -8 # biggest processes
sudo journalctl -k | grep -iE 'out of memory|oom-kill' | tail   # processes killed for lack of RAM
swapon --show                 # swap (6.10)
```

If the OOM killer appears: lower PM2 `instances` or `max_memory_restart`, reduce database memory settings (8.11), fix memory leaks, or resize the server.

### 12.4 Disk

```bash
df -h                                            # space per file system
df -i                                            # inodes (many small files)
sudo du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -10    # biggest top-level folders
sudo du -sh /var/log /var/www/application/backups /var/lib/docker 2>/dev/null
journalctl --disk-usage
sudo apt -y install ncdu && sudo ncdu -x /       # interactive explorer
```

Quick clean-up: `sudo journalctl --vacuum-size=300M`, `sudo apt autoremove --purge && sudo apt clean`, delete old local backups, check log rotation (8.10). Resize the disk when it is consistently above 75 %: EBS volume (AWS: modify volume, then `sudo growpart` + `sudo resize2fs`), Hostinger plan upgrade, DigitalOcean resize or Volume.

### 12.5 Network and bandwidth

```bash
ss -s                                 # connection summary
ss -tn state established | wc -l      # open TCP connections
sudo apt -y install vnstat            # keeps traffic statistics (starts collecting after install)
vnstat -d                             # daily traffic
vnstat -m                             # monthly traffic: compare with your plan's bandwidth
sudo apt -y install nload && nload    # live bandwidth per interface
```

Data transfer is billed or limited differently on each platform (section 14): AWS charges outbound traffic beyond the free allowance; Hostinger plans include a monthly bandwidth amount; DigitalOcean Droplets include a transfer allowance with overage pricing. Check the pricing pages linked in section 14.

### 12.6 Uptime and reboots

```bash
uptime -p                     # up 12 days, 3 hours
last reboot | head -5         # reboot history
journalctl --list-boots | tail -5
```

### 12.7 Application and PM2

```bash
sudo -iu app pm2 status
sudo -iu app pm2 logs --lines 50
sudo -iu app pm2 describe app-backend | grep -E 'status|restarts|uptime|script path'
sudo -iu app pm2 monit
tail -f /var/log/application/backend.err.log
```

A restart counter (`↺`) that grows without deployments means the application crashes; read `*.err.log`.

### 12.8 Nginx

```bash
systemctl status nginx --no-pager
sudo nginx -t
sudo tail -f /var/log/nginx/application.access.log
sudo tail -n 50 /var/log/nginx/application.error.log
# Status codes in today's log (5xx = server errors, 502/504 = application down or slow)
sudo awk '{print $9}' /var/log/nginx/application.access.log | sort | uniq -c | sort -rn | head
# Top client IPs (spot abusers)
sudo awk '{print $1}' /var/log/nginx/application.access.log | sort | uniq -c | sort -rn | head
```

### 12.9 API checks and ping

```bash
# Response code and timing of an API endpoint
curl -o /dev/null -s -w 'HTTP %{http_code}  total %{time_total}s  connect %{time_connect}s  TLS %{time_appconnect}s\n' https://example.com/api/health
```

**Ping (ICMP)** shows whether the server is reachable on the network, not whether the website works. Providers handle it differently: an AWS Security Group blocks ping unless you add an ICMP rule (3.3.2); on DigitalOcean the Cloud Firewall needs an inbound ICMP rule; UFW allows ping by default. If ping is blocked, use HTTP checks instead, which test what users actually need.

```bash
ping -c 4 <SERVER_IP>               # from your computer
mtr -rwc 20 <SERVER_IP>             # route and packet loss (sudo apt install mtr-tiny / brew install mtr)
```

### 12.10 Automated checks on the server

`monitor.sh` (8.9) with cron (8.9.4) alerts on disk, memory, load, services, PM2, health endpoints, the public URL, certificate expiry and backup age. Review its output: `journalctl -t app-monitor --since today`.

It runs **on** the server, so it can't report that the server itself is down. That is what the external monitor in 12.11 is for.

### 12.11 Low-cost monitoring setup

A practical combination for small teams, from no extra cost upwards:

| Layer | Tool | What it gives you |
|---|---|---|
| 1. Provider graphs and alerts | AWS CloudWatch (basic metrics + alarms), DigitalOcean Monitoring (free agent, alert policies, uptime checks), Hostinger hPanel usage graphs | CPU, network, disk/RAM (DO agent, CloudWatch agent); notifications |
| 2. On-server checks | `monitor.sh` + chat webhook (8.9) | Application-aware checks and alerts |
| 3. External uptime monitor | **Uptime Kuma** (self-hosted, open source) on a **different** small server or your office machine, or a hosted uptime service (many offer free plans; check their pricing pages) | Alerts when the site is unreachable or the certificate is about to expire, even if the server is completely down |
| 4. Detailed live metrics (optional) | **Netdata** (open source agent) | Per-second CPU, memory, disk, network, Nginx, database charts |

**Uptime Kuma** (on a separate machine with Docker):

```bash
docker run -d --restart=unless-stopped -p 127.0.0.1:3001:3001 \
  -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:2
```

Open it through an SSH tunnel (`ssh -L 3001:127.0.0.1:3001 user@monitor-host`, then `http://localhost:3001`) or behind Nginx with HTTPS and a login. Add monitors: **HTTP(s)** for `https://example.com/health` (interval 60 s, certificate expiry notification on), **HTTP(s) – Keyword** for `https://example.com/api/health` with keyword `ok`, and optionally **Ping**. Configure notifications (email, Slack, Telegram, Discord, …).

**Netdata** (on the application server, optional; uses some CPU and RAM):

```bash
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel --disable-telemetry
```

Netdata's dashboard listens on port **19999**. Don't open that port: keep it closed in both firewalls and bind it to localhost in `/etc/netdata/netdata.conf`:

```ini
[web]
    bind to = 127.0.0.1
```

Then `sudo systemctl restart netdata` and view it with `ssh -L 19999:127.0.0.1:19999 app-prod` → `http://localhost:19999`. Netdata Cloud (optional) offers remote access and alerts; check its plans before relying on it.

### 12.12 Maintenance schedule

| When | Task |
|---|---|
| **Daily (automatic)** | Security updates, backups, monitoring, certificate renewal checks, log rotation |
| **Daily (2 minutes)** | Glance at alerts and `journalctl -t app-backup --since yesterday` |
| **Weekly** | `pm2 status`, disk usage trend, Nginx 5xx count, Fail2ban bans, `npm audit` results from CI |
| **Monthly** | `sudo apt full-upgrade` + planned reboot; review firewall rules and SSH keys; check provider bill and bandwidth; test restore of one backup (13.5) |
| **Quarterly** | Full restore test on a temporary server; review users and secrets; Lynis audit; update Node.js/Python minor versions; check certificate and TLS configuration with SSL Labs |
| **Yearly** | Rotate secrets; review instance size and costs; plan OS release upgrade (new LTS) and Node.js major upgrade |

### 12.13 Major upgrades

- **Ubuntu release upgrade** (e.g. 24.04 → 26.04): take a provider snapshot first; test on a copy; then `sudo apt update && sudo apt full-upgrade && sudo do-release-upgrade`. Ubuntu offers the upgrade to a new LTS only after its first point release. Often it is cleaner to build a **new server** with this manual, deploy, test, and switch the Elastic IP / Reserved IP / DNS.
- **Node.js major version**: test the application on the new version in CI first; change `NODE_MAJOR` and re-run the NodeSource setup (6.12), `sudo apt install nodejs`, then `sudo npm install -g pm2@latest && sudo -iu app pm2 update`, and redeploy (`npm ci` rebuilds native modules).
- **PM2 update**: `sudo npm install -g pm2@latest && sudo -iu app pm2 update`.

---

## 13. Backup & Recovery

### 13.1 What to back up

| Data | Where | How | In Git? |
|---|---|---|---|
| Application code | Git repository | Git hosting (with its own backups) | Yes |
| Database | PostgreSQL / MySQL | `backup.sh` dump (8.8) | No |
| User uploads | `/var/www/application/uploads` | `backup.sh` tar archive | No |
| Secrets and runtime config | `/etc/application` | `backup.sh` config archive (encrypted) | No |
| Nginx, SSL, SSH, Fail2ban, UFW, cron, logrotate | `/etc/...` | `backup.sh` config archive | Ideally also documented in a private "infrastructure" repository (without secrets) |
| PM2 process list | `/home/app/.pm2/dump.pm2` | `backup.sh` config archive | Ecosystem file is in `/etc/application` |
| Whole server | Disk | Provider snapshots/backups (13.3) | — |

### 13.2 The 3-2-1 rule

Keep **3** copies of important data, on **2** different kinds of storage, with **1** copy **off-site** (a different provider or account). For this setup:

1. The live data on the server.
2. Provider backups/snapshots (same provider, quick full-server restore).
3. Encrypted `backup.sh` archives in object storage at **another provider or account** (protects against account loss, provider incidents and ransomware on the server). Enable versioning or object lock on that bucket if available, and give the server's storage key **write-only/limited** permissions where the provider supports it.

### 13.3 Provider backups and snapshots

| Platform | Feature | Notes |
|---|---|---|
| AWS | EBS snapshots via **Data Lifecycle Manager** or **AWS Backup** (3.5) | Incremental, stored in S3 in the same Region; billed per GB-month; can be copied to another Region |
| Hostinger | Weekly automatic backups (daily as paid option), manual snapshot (4.9) | Restoring overwrites the whole VPS; backups can't be downloaded |
| DigitalOcean | Weekly or daily Droplet backups (paid), snapshots (5.9) | Restore or create a new Droplet from a backup/snapshot |

Provider backups are taken while the server runs, so a database restored from them is *crash-consistent* (like after a power cut). PostgreSQL and MySQL recover from that, but application-level dumps (13.4) are the reliable source for the database.

### 13.4 Application backups

Configured in [8.8](#88-backup-script-backupsh) and scheduled daily at 02:30 in [8.9.4](#894-schedule-backup-and-monitoring-with-cron). Check:

```bash
journalctl -t app-backup --since "2 days ago" | grep -E 'finished|ERROR|WARNING'
sudo ls -la /var/www/application/backups/
sudo rclone ls offsite:<bucket>/application-prod/$(hostname -s) | tail      # off-site copies
```

Take an extra backup **before** risky work (migrations, upgrades): `sudo /opt/scripts/backup.sh`.

### 13.5 Verify backups

A backup that was never restored is a hope, not a backup.

**Monthly quick check** (server, as deploy with sudo):

```bash
LATEST=$(sudo ls -1 /var/www/application/backups | tail -1)
sudo sh -c "cd /var/www/application/backups/$LATEST && sha256sum -c SHA256SUMS"
```

**Quarterly restore test**: create a small temporary server (or a local VM), restore the newest **off-site** backup with 13.6, start the application, check that recent data is present, then delete the temporary server. Write down how long it took: that is your real recovery time.

### 13.6 Restore procedures

Copy the backup folder to the target server first (from local backups, or `sudo rclone copy offsite:<bucket>/application-prod/<host>/<STAMP> /root/restore/`). If the files end in `.age`, decrypt them **on a trusted machine or temporarily on the target server** with the private key from your password manager:

```bash
# Where: inside the backup folder, on the machine that holds the private key (remove the key afterwards)
sha256sum -c SHA256SUMS          # checks the files as they were created (the .age files when encrypted)
for f in *.age; do age -d -i application-backup-key.txt -o "${f%.age}" "$f"; done
```

**Stop the application** during database and upload restores:

```bash
sudo -iu app pm2 stop all
```

**PostgreSQL**

```bash
# (Only on a new server) restore roles first
sudo -u postgres psql -f db-globals.sql          # "already exists" errors for existing roles are fine
# Recreate the database and restore the dump
sudo -u postgres dropdb --if-exists appdb
sudo -u postgres createdb --owner=appdb_user appdb
sudo -u postgres pg_restore --dbname=appdb --no-owner --role=appdb_user --jobs=2 db-appdb.dump
sudo -u postgres psql -d appdb -c '\dt'          # tables are back
```

Copy the dump to a folder the `postgres` user can read (e.g. `/tmp`) if you get "Permission denied".

**MySQL**

```bash
sudo mysql -e "DROP DATABASE IF EXISTS appdb; CREATE DATABASE appdb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gunzip < db-appdb.sql.gz | sudo mysql appdb
sudo mysql -e "SHOW TABLES" appdb
```

(On a new server, create `appdb_user` and its grants again as in 6.16.)

**Uploads**

```bash
sudo tar -xzf uploads.tar.gz -C /var/www/application/        # recreates uploads/
sudo chown -R app:www-data /var/www/application/uploads
sudo find /var/www/application/uploads -type d -exec chmod 2750 {} + -o -type f -exec chmod 640 {} +
```

**Configuration** (look before you overwrite):

```bash
mkdir -p /tmp/cfg && sudo tar -xzf config.tar.gz -C /tmp/cfg && sudo ls -R /tmp/cfg | head -50
# Restore what you need, e.g. the environment file and Nginx site:
sudo cp -a /tmp/cfg/etc/application/. /etc/application/
sudo cp -a /tmp/cfg/etc/nginx/sites-available/application.conf /etc/nginx/sites-available/
sudo cp -a /tmp/cfg/etc/letsencrypt /etc/          # keeps the existing certificates (or issue new ones, 10.3)
sudo rm -rf /tmp/cfg
sudo nginx -t && sudo systemctl reload nginx
```

**Start again and verify**

```bash
sudo -iu app pm2 start /etc/application/ecosystem.config.js && sudo -iu app pm2 save
curl -s http://127.0.0.1:3000/health && curl -sI https://example.com | head -1
```

### 13.7 Full server recovery (disaster recovery)

When the server is lost or compromised:

1. **Compromised?** Don't repair it: isolate it (provider firewall: deny all inbound except your IP), take a snapshot for later analysis, and build a new one. Rotate **all** secrets (database passwords, API keys, deploy keys, webhook URLs) because the attacker may have copied them.
2. **Quick path (provider backup/snapshot):** AWS: create a volume/AMI from the snapshot and launch a new instance; Hostinger: restore a backup or snapshot in hPanel; DigitalOcean: restore the Droplet from a backup/snapshot or create a new Droplet from it. Then check the data age and continue with step 6.
3. **Clean path:** create a new server with section 3, 4 or 5.
4. Run section 6 (base configuration) and section 7 (directories).
5. Restore configuration and data (13.6), deploy the code (section 9 / `deploy.sh`).
6. **Move the address:** AWS: re-associate the **Elastic IP** to the new instance; DigitalOcean: **reassign the Reserved IP**; otherwise (Hostinger or no reserved IP) update the DNS `A` records (10.1) and wait for the TTL.
7. Certificates: restored with `/etc/letsencrypt`, or issue new ones (10.3).
8. Verify (9.8), watch monitoring closely for a day, and write a short incident report (what happened, timeline, what to improve).

Define and write down two numbers with your team:

- **RPO** (Recovery Point Objective): how much data you may lose. With daily backups the worst case is about 24 hours; more frequent database dumps or a managed database with point-in-time recovery reduce it.
- **RTO** (Recovery Time Objective): how long the service may be down. Measure it in the quarterly restore test.

---

## 14. Platform Comparison

Prices change often and depend on region, term and promotions, so this manual lists **no prices**. Use the official pages:

- AWS: <https://aws.amazon.com/ec2/pricing/on-demand/> (instances), <https://aws.amazon.com/ebs/pricing/> (disks and snapshots), <https://aws.amazon.com/vpc/pricing/> (public IPv4 / Elastic IP), <https://calculator.aws/> (estimate a full setup)
- Hostinger: <https://www.hostinger.com/vps-hosting>
- DigitalOcean: <https://www.digitalocean.com/pricing/droplets> and <https://www.digitalocean.com/pricing>

### 14.1 Feature comparison

| | **AWS EC2** | **Hostinger VPS** | **DigitalOcean Droplet** |
|---|---|---|---|
| Ease of use | Steepest learning curve: many services, IAM, Regions, VPCs | Simplest: guided hPanel, fixed plans | Simple, developer-friendly control panel |
| Pricing model | Usage-based (compute, disks, public IPv4, outbound data billed separately); savings plans / reserved instances for commitments | Prepaid plan for a term; promotional first term, higher renewal price | Usage-based with a monthly cap per Droplet; add-ons (backups, Reserved IPs, volumes) extra |
| Cost predictability | Lowest without budgets/alerts (many separate line items) | Highest (one plan price) | High (capped Droplet price plus add-ons) |
| Server choice | Very wide: burstable (t3/t4g), general purpose (m7i…), compute (c7i…), memory, GPU, ARM (Graviton) | Fixed KVM plans (4.2) | Basic (shared CPU), General Purpose / CPU- / Memory-Optimized (dedicated CPU), GPU |
| Static public IP | **Elastic IP** needed (auto-assigned IP changes on stop/start); every public IPv4 is billed | Included, stays with the VPS | Droplet IP stays while the Droplet exists; optional **Reserved IP** for moving it |
| Provider firewall | Security Groups (stateful, per instance/ENI) | hPanel VPS firewall | Cloud Firewalls (no additional cost) |
| Backups | EBS snapshots, Data Lifecycle Manager, AWS Backup (billed per GB) | Weekly automatic backups included, snapshot, paid daily backups | Paid weekly/daily backups, snapshots per GB |
| Monitoring | CloudWatch metrics and alarms (RAM/disk need the CloudWatch agent) | Usage graphs in hPanel | Free metrics agent, alert policies, uptime checks |
| Data transfer | Outbound traffic billed per GB after a free allowance | Monthly bandwidth included per plan (4.2) | Transfer allowance included per Droplet; overage billed per GB |
| Scaling | Vertical (change type) and horizontal (Auto Scaling, load balancers), managed databases, containers, serverless, multi-Region | Vertical (upgrade plan) | Vertical (resize), load balancers, managed databases, Kubernetes, App Platform |
| Security & compliance features | IAM, CloudTrail, KMS, Systems Manager, wide compliance programmes | Account 2FA, managed firewall, malware scanner (Monarx), DDoS protection | Teams/roles, 2FA, VPC, Cloud Firewalls, managed database trusted sources |
| Recovery access when SSH fails | EC2 Serial Console, Session Manager, volume rescue | Emergency mode (rescue system) | Recovery Console, recovery ISO |
| Support | Basic support included; technical support via paid plans | Customer support via chat included | Ticket support included; paid plans for faster response |

### 14.2 Recommendations

| Situation | Suggested platform | Why |
|---|---|---|
| **Development / testing** | DigitalOcean Basic Droplet or Hostinger KVM 1 | Quick to create and delete, predictable cost. Use AWS if production will run on AWS, so you learn the same tools |
| **Small business production** (one server, steady traffic) | Hostinger KVM 2, or DigitalOcean (with backups enabled) | Simple management, predictable monthly cost, included static IP |
| **Growing startup** (more servers, managed database, load balancer) | DigitalOcean or AWS | Managed services and private networking without running everything yourself |
| **Enterprise / regulated workloads** | AWS | Fine-grained IAM, audit trails, compliance programmes, many Regions, deep managed-service catalogue |
| **CPU-heavy file processing** | AWS compute-optimised (c7i/c7g), DigitalOcean CPU-Optimized, or Hostinger KVM 4/8 | Dedicated or larger CPU; avoid burstable types for sustained load |
| **High outbound traffic on a budget** | Hostinger or DigitalOcean | Bandwidth included in the plan; on AWS, outbound data can dominate the bill |

Whatever you choose, sections 6–13 stay identical, so moving later means: build a new server with this manual, restore the backup (13.6), switch DNS.

---

## 15. Troubleshooting

### 15.1 How to find the problem

Work from the outside in and check one layer at a time:

```text
DNS ──► provider firewall ──► UFW ──► Nginx ──► PM2 / application ──► database
dig      console rules        ufw      nginx -t   pm2 status / logs       systemctl status
```

| Log | Location / command |
|---|---|
| Nginx access / errors | `/var/log/nginx/application.access.log`, `/var/log/nginx/application.error.log` |
| Application (PM2) | `/var/log/application/*.log`, `sudo -iu app pm2 logs` |
| Deployments | `/var/log/application/deploy.log` |
| Backups / monitoring | `journalctl -t app-backup`, `journalctl -t app-monitor` |
| SSH logins | `journalctl -u ssh`, `/var/log/auth.log` |
| Fail2ban | `/var/log/fail2ban.log` |
| Firewall blocks | `/var/log/ufw.log` |
| Kernel (OOM, disk errors) | `sudo journalctl -k` |
| Any service | `journalctl -u <service> -n 100 --no-pager` |
| PostgreSQL / MySQL | `/var/log/postgresql/`, `/var/log/mysql/error.log` |
| Certbot | `/var/log/letsencrypt/letsencrypt.log` |

### 15.2 SSH problems

**`Permission denied (publickey)`**
- Wrong user: AWS first login is `ubuntu`; Hostinger/DigitalOcean is `root`; after section 6 it's `deploy`.
- Wrong key: `ssh -i ~/.ssh/server_ed25519 deploy@<SERVER_IP>`; debug with `ssh -v …` (look for "Offering public key" / "Server accepts key").
- Key not in `/home/deploy/.ssh/authorized_keys`, or wrong permissions on the server: `sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys && sudo chown -R deploy:deploy /home/deploy/.ssh`.
- `AllowUsers` in `00-hardening.conf` doesn't list the user.

**`Connection timed out`**
- Provider firewall doesn't allow port 22 from your current IP (your IP may have changed: check <https://checkip.amazonaws.com>), or UFW blocks it, or the server is stopped. AWS: also check that the instance has a public IP / Elastic IP.

**`Connection refused`**
- SSH isn't running or listens on another port. Use the provider console (15.9): `sudo systemctl status ssh`, `sudo sshd -t`.

**`WARNING: UNPROTECTED PRIVATE KEY FILE!`** (your computer)
- macOS/Linux: `chmod 400 ~/.ssh/application-prod-key.pem`. Windows: fix permissions with `icacls` as in 3.1.10.

**`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`**
- Normal after rebuilding a server or moving an IP to a new server. Remove the old entry: `ssh-keygen -R <SERVER_IP>` (and `ssh-keygen -R example.com`). If you did **not** change anything, stop and investigate.

**`Too many authentication failures`**
- Your SSH agent offers too many keys. Use `IdentitiesOnly yes` in `~/.ssh/config` (8.5) or `ssh -o IdentitiesOnly=yes -i <key> …`.

**Banned by Fail2ban** (works from another network but not yours)
- From the console or another IP: `sudo fail2ban-client set sshd unbanip <YOUR_IP>`; add your IP to `ignoreip`.

### 15.3 Nginx and HTTP errors

**`nginx -t` fails**
- The message names file and line, e.g. `unknown directive "proxy_pas"` or `"server" directive is not allowed here`. Fix that line; Nginx keeps running with the old config until a successful reload.
- `cannot load certificate "/etc/letsencrypt/live/example.com/fullchain.pem"`: the certificate doesn't exist yet. Use the bootstrap file (8.1.5) until 10.3 is done.
- `could not build server_names_hash`: add `server_names_hash_bucket_size 64;` in the `http {}` block of `/etc/nginx/nginx.conf`.

**`502 Bad Gateway`**
- The application isn't running or listens on another port. `sudo -iu app pm2 status`, `curl -v http://127.0.0.1:3000/health`, `ss -ltnp | grep -E '3000|5000'`, and the Nginx error log (`connect() failed (111: Connection refused) while connecting to upstream`).

**`504 Gateway Timeout`**
- The application answers too slowly. Find the slow endpoint in the app logs; raise `proxy_read_timeout` only for routes that really need it (long reports, uploads); move long work to background jobs.

**`413 Request Entity Too Large`**
- Upload bigger than `client_max_body_size` (8.1.4). Raise it there **and** in the application's own limit, then reload Nginx.

**`403 Forbidden` for static files**
- Nginx can't read the folder. Check the whole path: `namei -l /var/www/application/frontend/dist/index.html` — every folder needs `x` for `www-data` (owner/group), files need `r`. Fix with 7.4 rule 5. Also check that `index.html` exists in `dist`.

**`404` when reloading a page of a single-page app**
- Use `try_files $uri $uri/ /index.html;` in `location /` (comment in 8.1.4).

**Still the "Welcome to nginx!" page**
- `sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx`; check `server_name` and DNS.

**Nginx won't start: `bind() to 0.0.0.0:80 failed (98: Address already in use)`**
- Another web server (often Apache) uses the port: `sudo ss -ltnp | grep ':80 '`; `sudo systemctl disable --now apache2`.

**`ERR_TOO_MANY_REDIRECTS`**
- Usually Cloudflare in **Flexible** SSL mode: switch to **Full (strict)** (10.1).

### 15.4 Application and PM2 problems

**App not running after a reboot**
- `systemctl status pm2-app`. If missing, run the startup command again (6.13), start the apps, then `sudo -iu app pm2 save`.

**Status `errored` or restart counter keeps increasing**
- `sudo -iu app pm2 logs app-backend --lines 100 --err`. Typical: missing environment variable, syntax error after deploy, wrong `script` path, missing build (`dist/` not created), database unreachable.

**`Error: listen EADDRINUSE: address already in use 127.0.0.1:3000`**
- Something else uses the port: `sudo ss -ltnp 'sport = :3000'`. Often a process started by hand (9.4 test) or under another user's PM2 (`sudo pm2 list` as root). Stop it, then `sudo -iu app pm2 restart app-backend`.

**Environment variable changes have no effect**
- Reload with `--update-env`: `sudo -iu app pm2 reload /etc/application/ecosystem.config.js --update-env`. Frontend variables (`VITE_*` etc.) need a **rebuild**.

**`EACCES: permission denied` when writing files**
- The app writes somewhere it doesn't own. Uploads go to `/var/www/application/uploads` (owner `app`); logs to `/var/log/application`. Don't fix with `chmod 777`.

**`npm ci` fails**
- *lock file out of sync*: update `package-lock.json` on your computer and commit it. *node-gyp/native build errors*: `sudo apt install build-essential python3` (6.15). *Wrong Node.js version*: check `"engines"` in `package.json` vs `node -v`.

**Python: `error: externally-managed-environment`**
- You ran `pip` outside the virtual environment. Use `/var/www/api/.venv/bin/pip` (9.5).

**Python: `ModuleNotFoundError`**
- Package missing from `requirements.txt` or PM2 not using the venv: `script` must point to `/var/www/api/.venv/bin/uvicorn` (8.2).

### 15.5 SSL / Certbot problems

**`DNS problem: NXDOMAIN looking up A for example.com`**
- The DNS record doesn't exist (yet). Check with `dig +short example.com @1.1.1.1` (10.2) and wait.

**`Timeout during connect (likely firewall problem)`**
- Port 80 is blocked: provider firewall or UFW. Open 80 for `0.0.0.0/0` and `::/0`. If an `AAAA` record exists, IPv6 must work too, or remove the record.

**`Invalid response from http://example.com/.well-known/acme-challenge/...: 404`**
- The webroot path doesn't match the Nginx `location` (must be `/var/www/letsencrypt` in both), or the domain points to another server. Repeat the test file check in 10.3.

**`too many certificates already issued` / rate limit**
- You hit Let's Encrypt rate limits by repeating failed attempts. Wait as stated in the message, and test with `--dry-run` first (<https://letsencrypt.org/docs/rate-limits/>).

**Renewal fails / certificate expired**
- `sudo certbot renew --dry-run` shows the reason (often a changed Nginx config without the ACME location, or a closed port 80). Check the timer: `systemctl list-timers | grep certbot`. After fixing: `sudo certbot renew && sudo systemctl reload nginx`.

**Browser shows "Not secure" although the certificate is valid**
- Mixed content: the page loads `http://` images/scripts. Fix the URLs in the application (use relative or `https://` URLs).

### 15.6 Database problems

**`ECONNREFUSED 127.0.0.1:5432` / `:3306`**
- Database not running: `systemctl status postgresql` / `systemctl status mysql`; logs in 15.1.

**PostgreSQL: `password authentication failed for user "appdb_user"`**
- Wrong password in `DATABASE_URL`, or special characters not URL-encoded (`@` → `%40`, `:` → `%3A`, `/` → `%2F`). Reset: `sudo -u postgres psql -c "\password appdb_user"`.

**PostgreSQL: `no pg_hba.conf entry for host …`**
- The connection doesn't match a `pg_hba.conf` line (database, user or address). Compare with 8.11.1 and `sudo systemctl reload postgresql`.

**MySQL: `Access denied for user 'appdb_user'@'127.0.0.1'`**
- MySQL treats `localhost` (socket) and `127.0.0.1` (TCP) as different hosts in some setups. Either connect through the socket (`socket=/var/run/mysqld/mysqld.sock` in the app's settings) or create the same user for `127.0.0.1`:
  `sudo mysql -e "CREATE USER 'appdb_user'@'127.0.0.1' IDENTIFIED BY '<SAME_PASSWORD>'; GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON appdb.* TO 'appdb_user'@'127.0.0.1';"` (type the password in the terminal, don't save it in scripts).

**`too many connections`**
- Lower the application's pool size (`DB_POOL_MAX` × number of PM2 instances must stay below `max_connections`), or raise `max_connections` moderately.

### 15.7 System resources

**Disk full (`No space left on device`)**
- Find the cause: `df -h`, `sudo du -xh --max-depth=1 / | sort -h | tail`. Usual suspects: logs (`journalctl --disk-usage`, `/var/log`), local backups, old Docker images, `node_modules` caches. Clean up (12.4), then fix the cause (log rotation, retention). If the disk is so full that you can't log in, use the provider console (15.9).

**Processes killed / server freezes (out of memory)**
- `sudo journalctl -k | grep -i oom`. Add swap (6.10), reduce PM2 instances, set `max_memory_restart`, tune database memory (8.11) or resize.

**High CPU**
- `top` / `htop` → which process. Node.js at 100 % for long periods: a busy loop or heavy work in the request path. On AWS `t3`/`t4g`, check CPU credits (12.2). Bots: check top IPs in the Nginx log (12.8) and tighten `limit_req`.

**`Could not get lock /var/lib/dpkg/lock-frontend`**
- Automatic updates are running (often right after boot). Wait a few minutes: `ps aux | grep -E 'apt|unattended'`. Don't delete lock files.

**Wrong time in logs**
- `timedatectl` → set the zone (6.4); `timedatectl show-timesync` / `chronyc tracking` for time sync.

### 15.8 DNS problems

- **Site works by IP but not by name**: `dig +short example.com` returns another IP or nothing → fix records (10.1), wait for TTL.
- **Works for some users, not others**: propagation still running, or a wrong `AAAA` record (IPv6 users fail). `dig +short example.com AAAA`.
- **Changed nameservers, nothing happens**: nameserver changes take up to 24–48 h; check `dig NS example.com +short`.
- **Your computer still sees the old IP**: flush the local DNS cache (Windows: `ipconfig /flushdns`; macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`).

### 15.9 Locked out (firewall or SSH mistake)

First check the **provider firewall** in the console (your IP may have changed) — that fixes most cases. If the problem is **inside** the server (UFW, `sshd` configuration), use the provider's out-of-band console. Log in there as `deploy` with the **sudo password** set in 6.3 (keep it in your password manager for exactly this case).

Fix commands once you have a console:

```bash
sudo ufw allow from <YOUR_IP> to any port 22 proto tcp   # or temporarily: sudo ufw disable
sudo mv /etc/ssh/sshd_config.d/00-hardening.conf /root/00-hardening.conf.broken   # if the SSH config is the problem
sudo sshd -t && sudo systemctl restart ssh
```

| Platform | Out-of-band access | Notes |
|---|---|---|
| **AWS** | **EC2 Serial Console**: EC2 → Instances → select → Actions → Monitor and troubleshoot → EC2 Serial Console → Connect | Nitro-based instances; turn on account access once under EC2 → Settings → EC2 Serial Console. Needs a Linux user with a password (`deploy`). **EC2 Instance Connect** uses port 22, so it doesn't help when UFW blocks SSH. Alternatives: Session Manager (if the SSM agent and an instance role were set up), or stop the instance, attach its volume to a helper instance and edit `/etc/ufw/ufw.conf` (`ENABLED=no`) |
| **Hostinger** | First try the **Browser terminal** on the VPS Overview page and the firewall reset (4.6). If that fails: hPanel → VPS → **Manage** → **Settings** → **Emergency mode** | Emergency mode boots a rescue system with your disk mounted (see the Emergency mode guide). Edit e.g. `<mount>/etc/ufw/ufw.conf` → `ENABLED=no` or the SSH file, then turn Emergency mode off. Also review the hPanel firewall rules |
| **DigitalOcean** | Droplet → **Access** → **Launch Recovery Console** | Works even when networking/SSH is broken. If you don't know any password: Access → **Reset Root Password** (enables root password login on the console). For disk-level repair: Settings → Recovery → Boot from Recovery ISO. The browser **Droplet Console** needs working SSH, so use the Recovery Console |

---

## 16. Final Deployment Checklist

Tick every item before going live. Keep a copy of the completed list with the server documentation.

**Provider and network**
- [ ] Provider account secured with MFA; billing/budget alerts set (11.2)
- [ ] Server created in the right region/datacenter with Ubuntu LTS (3 / 4 / 5)
- [ ] Static IP in place: Elastic IP (AWS), VPS IP (Hostinger), Droplet or Reserved IP (DigitalOcean)
- [ ] Provider firewall: 22 from admin IPs only, 80 and 443 from everywhere, nothing else (3.3 / 4.6 / 5.6)
- [ ] Provider backups/snapshots enabled (3.5 / 4.9 / 5.9)

**Operating system and access**
- [ ] Packages updated; automatic security updates on (6.2, 6.9)
- [ ] Admin user `deploy` (sudo) and application user `app` (no sudo) created (6.3)
- [ ] SSH: keys only, root login off, `AllowUsers` set; tested from a second terminal (6.6)
- [ ] UFW enabled with 22/80/443 only (6.7); Fail2ban active (6.8)
- [ ] Hostname and time zone set (6.4); swap on small servers (6.10)
- [ ] Sudo password of `deploy` stored in the password manager (for console access, 15.9)

**Application**
- [ ] Node.js LTS, PM2 (with `pm2-app` boot service), Python venv, database installed as needed (6.12–6.16)
- [ ] Directory structure and permissions as in section 7
- [ ] `/etc/application/application.env` filled in, mode `640`, no secrets in Git or web roots (8.3, 9.3)
- [ ] Applications listen on `127.0.0.1` only; PM2 list saved; reboot test passed (9.6)
- [ ] `/health` endpoints answer 200 on 3000 and 5000 (9.8)
- [ ] Database bound to localhost, application user limited to its database (8.11)
- [ ] `deploy.sh` installed and a deployment + automatic rollback tested (8.7, 9.9)

**Domain, Nginx and SSL**
- [ ] DNS `A` records (and `AAAA` only if IPv6 is set up) point to the server (10.1, 10.2)
- [ ] Let's Encrypt certificate issued; `certbot renew --dry-run` succeeds; reload hook installed (10.3, 10.6)
- [ ] Full Nginx site active: HTTP→HTTPS redirect, www→main domain, security headers, `.env`/`.git` blocked (8.1, 10.4)
- [ ] SSL Labs test passed; HSTS planned after a stable period (10.4, 10.5)
- [ ] Ports 3000/5000/8080/3306/5432/6379 not reachable from outside (`nmap` / `nc`, 11.4)

**Monitoring and backups**
- [ ] `monitor.sh` installed, test alert received, cron active (8.9)
- [ ] External uptime monitor checks `https://example.com/health` and certificate expiry (12.11)
- [ ] `backup.sh` runs daily; backups encrypted; off-site copy works (8.8, 13.4)
- [ ] Backup private key stored safely **off** the server
- [ ] A restore was tested at least once (13.5, 13.6)
- [ ] Log rotation for application logs and journald size limit set (8.10)

**Documentation and team**
- [ ] Server details recorded (provider, region, IP, instance type, OS version, DNS provider) without secrets
- [ ] Who has console, SSH and DNS access is documented; departing members are removed
- [ ] Recovery steps (13.7), RPO and RTO agreed and written down
- [ ] Maintenance schedule (12.12) assigned to named people

---

## Appendix A: Official documentation links

**AWS**
- AWS Management Console: <https://console.aws.amazon.com/>
- Amazon EC2 User Guide: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/>
- Elastic IP addresses: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html>
- Security groups: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html>
- EC2 Serial Console: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-serial-console.html>
- Pricing: <https://aws.amazon.com/ec2/pricing/on-demand/> · <https://aws.amazon.com/ebs/pricing/> · <https://aws.amazon.com/vpc/pricing/> · <https://calculator.aws/> · Free Tier: <https://aws.amazon.com/free/>

**Hostinger**
- VPS plans: <https://www.hostinger.com/vps-hosting>
- Back up or restore a VPS: <https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-server/>
- Emergency mode: <https://www.hostinger.com/support/5726577-how-to-use-emergency-mode-on-your-vps-at-hostinger/>

**DigitalOcean**
- Control panel: <https://cloud.digitalocean.com/>
- Droplets documentation: <https://docs.digitalocean.com/products/droplets/>
- Cloud Firewalls: <https://docs.digitalocean.com/products/networking/firewalls/>
- Reserved IP pricing: <https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/>
- Metrics agent: <https://docs.digitalocean.com/products/monitoring/how-to/install-metrics-agent/>
- Recovery Console: <https://docs.digitalocean.com/products/droplets/how-to/recovery/recovery-console/>
- Pricing: <https://www.digitalocean.com/pricing/droplets>

**Ubuntu and Linux**
- Ubuntu Server documentation: <https://documentation.ubuntu.com/server/>
- Ubuntu 26.04 LTS release notes: <https://documentation.ubuntu.com/release-notes/26.04/>
- UFW: <https://help.ubuntu.com/community/UFW>
- OpenSSH `sshd_config` reference: <https://man.openbsd.org/sshd_config>
- Fail2ban: <https://github.com/fail2ban/fail2ban>
- Ubuntu Pro: <https://ubuntu.com/pro>

**Web server and TLS**
- Nginx documentation: <https://nginx.org/en/docs/>
- Mozilla SSL Configuration Generator: <https://ssl-config.mozilla.org/>
- Certbot instructions: <https://certbot.eff.org/instructions>
- Let's Encrypt documentation: <https://letsencrypt.org/docs/> · rate limits: <https://letsencrypt.org/docs/rate-limits/> · certificate lifetimes: <https://letsencrypt.org/docs/cert-lifetimes/>
- SSL Labs Server Test: <https://www.ssllabs.com/ssltest/>

**Runtime, databases and tools**
- Node.js release schedule: <https://nodejs.org/en/about/previous-releases> · NodeSource packages: <https://github.com/nodesource/distributions>
- PM2: <https://pm2.keymetrics.io/docs/usage/quick-start/> · ecosystem file: <https://pm2.keymetrics.io/docs/usage/application-declaration/> · startup: <https://pm2.keymetrics.io/docs/usage/startup/>
- PostgreSQL: <https://www.postgresql.org/docs/current/> · `pg_hba.conf`: <https://www.postgresql.org/docs/current/auth-pg-hba-conf.html>
- MySQL 8.4 Reference Manual: <https://dev.mysql.com/doc/refman/8.4/en/>
- age (encryption): <https://github.com/FiloSottile/age> · rclone: <https://rclone.org/docs/>
- Uptime Kuma: <https://github.com/louislam/uptime-kuma> · Netdata: <https://learn.netdata.cloud/docs/netdata-agent/installation/linux>
- Lynis: <https://cisofy.com/lynis/>
- PuTTY: <https://www.chiark.greenend.org.uk/~sgtatham/putty/> · Git: <https://git-scm.com/>

---

## Appendix B: Applying this manual to the Fileora processing server

The Fileora processing service (the `server/` folder of the Fileora project) is a single Python service. It follows the same principles as this manual, with a few differences: it runs under **systemd** instead of PM2, as its own system user `fileora`, and brings its own installer.

### B.1 How Fileora maps to this manual

| This manual | Fileora processing server |
|---|---|
| Application user `app` | System user `fileora` (no login shell), created by `install.sh` |
| Code in `/var/www/...` | `/opt/fileora/app` (code), `/opt/fileora/venv` (Python), `/opt/fileora/browsers` |
| Working data / uploads | `/var/lib/fileora/jobs` (temporary job files, deleted after `FILEORA_TTL_MIN`) |
| Secrets in `/etc/application/application.env` | `/etc/fileora/fileora.env` (owner root, mode `600`), read by systemd `EnvironmentFile=` |
| PM2 process on 127.0.0.1:5000 | systemd service `fileora.service`: Uvicorn on **127.0.0.1:8000** with sandboxing (`NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`) |
| Nginx site 8.1.4 | `server/deploy/nginx-api-proxy.conf` → `/etc/nginx/sites-available/fileora-api` (large uploads, `/app/v1/` rate limit for the mobile app) |
| `deploy.sh` | Re-run `sudo bash install.sh` from the updated code folder (safe to run again) |
| Health check | `curl -s http://127.0.0.1:8000/health`; full test: `sudo bash deploy/smoke_test.sh` |
| Logs | `journalctl -u fileora -n 100 --no-pager` |

### B.2 Setup on AWS EC2 (or Hostinger / DigitalOcean)

1. **Server**: section 3 (or 4 / 5). Ubuntu 24.04 LTS (the installer targets it). Size by workload: the environment file suggests about **one concurrent job per 2 GB RAM** (`FILEORA_WORKERS`). Elastic IP on AWS.
2. **Firewalls**: only **22** (restricted), **80**, **443**. Port **8000 is never opened**: Nginx is the only public entrance.
3. **Base configuration**: section 6 (6.1–6.11 and 6.17). Node.js and PM2 (6.12–6.13) are not needed for Fileora.
4. **Copy the code** to the server (Git or `rsync`, 9.2), then from the `server/` folder:

   ```bash
   sudo bash install.sh
   ```

5. **Shared key**: open `/etc/fileora/fileora.env` with `sudo nano` and paste the key from **WordPress → Fileora → Settings → Shared key** into `FILEORA_KEY=` (type or paste it directly on the server; never send it by chat or e-mail, and never put it into the mobile app). Then `sudo systemctl restart fileora`. Optional AI tools need `ANTHROPIC_API_KEY` in the same file, which also stays on the server only.
6. **Nginx + SSL**: DNS `A api.example.com → <SERVER_IP>` (10.1), install `deploy/nginx-api-proxy.conf` as `/etc/nginx/sites-available/fileora-api`, replace `api.example.com`, enable it, `sudo nginx -t && sudo systemctl reload nginx`, then `sudo certbot --nginx -d api.example.com` (the certbot alternative from 10.3).
7. **Mobile app gateway** (optional): set `FILEORA_APP_GATEWAY=1` and keep `FILEORA_TRUST_PROXY=1` (Nginx sends `X-Real-IP`), restart the service, and enter `https://api.example.com` in **WordPress → Fileora → App Center → API tools → "Processing server address for the app"**. No key goes into the app.
8. **Verify**: `sudo bash deploy/smoke_test.sh` (health → real job → download → delete), then `curl -sI https://api.example.com/health`.

### B.3 Monitoring and backups for Fileora

- `monitor.sh` (8.9): in `/etc/application/monitor.env` set `SERVICES="nginx fileora fail2ban"`, `LOCAL_HEALTH_URLS="http://127.0.0.1:8000/health"`, `SITE_URL=https://api.example.com/health`, `CERT_FILE=/etc/letsencrypt/live/api.example.com/fullchain.pem`. The PM2 check is skipped automatically when PM2 isn't installed.
- `backup.sh` (8.8): `DB_ENGINE=none` (the service has no database); set `CONFIG_PATHS="/etc/fileora /etc/systemd/system/fileora.service /etc/nginx /etc/letsencrypt /etc/ssh/sshd_config.d /etc/fail2ban/jail.local /etc/ufw /etc/cron.d/application /opt/scripts"`; set `UPLOADS_DIR=` (empty), because job files are temporary by design.
- Keep `/var/lib/fileora` on a disk with enough free space for the largest expected jobs (`FILEORA_MAX_MB` × concurrent jobs), and let `monitor.sh` watch disk usage.

---

*End of manual.*






# Fileora app (React Native) – version 0.7

Package `in.fileora.app` · React Native 0.88 (New Architecture) · Android 7+ · light/dark mode (phone setting or your choice in Settings)

## What's new in 0.7
| Part | Details |
|---|---|
| **Ads** | Google AdMob, placed as in the approved designs and managed in WordPress (App Center → Ads): a native card on Home, a banner at the bottom of a tool's page, a full-screen ad after a finished task (limits: every N tasks, N minutes apart, not in a new install's first tasks), a 300×250 at the bottom of the result sheet, and an opt-in rewarded video for ad-free hours (Settings → Ads & privacy). Google's consent form where required; "Privacy choices" in Settings. Builds use Google's sample App IDs (test ads only) until the repository variables `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` are set (Settings → Secrets and variables → Actions → Variables). Code: `src/ads/`. |
| **Alerts** | New bottom-bar tab with the notification history (App Center sends the last 60 days; notifications received while the app is open are kept too) and an unread badge that clears when Alerts is opened. `src/remote/inbox.ts`, `src/screens/AlertsScreen.tsx`. |
| **Notifications** | While the app is open, Android now shows a real notification with the Fileora sound (it used to show a plain pop-up without sound); iOS shows a banner with sound. **Check notifications** in Settings shows what can stop notifications (permission, the channel's sound and pop-up, battery limits, the phone maker's Autostart) with buttons to the right phone settings, and **Send a test notification** (arrives after 10 seconds, so the app can be closed first). |
| **Notification & Privacy** | App Center can lock each setting (notifications on/off, categories, quiet, lock-screen privacy, anonymous usage, test button, reset): a locked option is hidden and uses App Center's default. |
| **Promotions** | Promotions screen (☰ menu by default; App Center → Navigation can move it to the bar) with cards from App Center → Promotions, and a Home card linking to it. Hidden while App Center has none. |
| **Daily Update** | A card that slides up at the bottom of Home with a bold heading, a paragraph and a button to a web page (App Center → Promotions): once a day, once, or every time; × closes it; it never blocks Home. |
| **ATS Resume** | Removed: tab, screen, menu item and Home entries. The Home hero's second button is now Scanner. |
| **Advertising ID** | Allowed for the ads (the Google Mobile Ads SDK adds it). Firebase Analytics still doesn't collect it. Update the Play Console Data safety form and the App Store privacy answers before publishing. |

## What's new in 0.4
| Part | Details |
|---|---|
| **Scanner** | Two independent tabs on one page, each with its own list, **+** button, sort and **Clear all** (to the Recycle Bin). *Scanned Images*: Camera (the phone's camera app) or Gallery → **border step** (automatic page edges, Full border / Detect border, drag the corners with a magnifier) → **filter step** (None, Photo, Document, Black and White, Monochrome; Rotate; Distortion on/off; ADD PAGE) → **Scan complete** (document name, Save as PDF). Documents open as a page grid (reorder, discard, add pages, Save/Update PDF). *Convert PDFs*: PDFs or images → the same corner/perspective/filter editor → **Save as PDF**. All image work is done on the phone (`src/scanner/editor.html`). |
| **Success** | Confetti + "Congratulations! Your files are completed successfully." only after a task worked. |
| **API tools** | Word/Excel/PowerPoint ↔ PDF, OCR, PDF/A, Protect, Unlock, Redact, PDF Forms, Edit PDF and the AI tools show *Temporarily unavailable* with the maintenance message. Switch on with `API_TOOLS_LIVE = true` in `src/config.ts` when the server is live. |
| **Files** | **Cloud Storage** (Google Drive, JioCloud, OneDrive: Add Connection through each service's app; upload any Fileora file) and **Recycle Bin** (deleted files and scans: restore, delete permanently, empty). |
| **Share to Fileora** | Gallery → Share → Fileora (JPG, PNG, WebP, HEIC…, one or many): the images open ready; pick an image tool (the file is already chosen on the tool page) or Scan to PDF. |
| **Logo** | New logo (Filore_New.svg) everywhere it appears; letter counters are see-through, "File" turns white in dark mode. |
| **Animations** | No bounce: smooth timing everywhere; reduced-motion respected. |
| **Signing** | Release builds use your private key when the repository has the signing secrets (see below); otherwise the public test key. |

## What's in 0.3
| Part | Details |
|---|---|
| **Navigation** | *Bottom bar (6)*: Home · Tools · Scanner · Files · Resume · Settings. *Menu* (☰): all tools + the 7 categories, Home, Scanner, Files, ATS Resume, Blog, Settings, Contact us, API Status and the information pages. |
| **Home** | Hero with **Browse by tools**, **Downloads** and **ATS Resume**; search; **Recently used**; the 7 categories; **Your most used tools** (from your own usage, filled up with popular tools until you have history); **Your files** with Downloaded / Opened / Processed tabs; **Your activity**: donut of tool uses by category and a 7-day bar chart of MB/GB processed (tap a segment or bar for its value), both from the history kept on the phone. Empty states until there is real data. |
| **Downloads** (Activity) | Downloaded · Opened · Processed lists with thumbnails, size, pages, date and tool; open or delete. |
| **Tools** | All 69 ready tools. These work natively in the app: **Merge PDF** (pick 2+, add more, reorder, remove, thumbnails), **Watermark** and **Page numbers** on the phone (pdf-lib), and **Compress, Word/Excel/PowerPoint → PDF, PDF → Word/Excel/PowerPoint, OCR, PDF/A, Repair, Protect, Unlock** through the website's public API (queue position, errors, cancel). The rest open their fileora.in page inside the app. Originals are never changed. |
| **Your file is ready** | Pop-up after every task: open the file, or keep going with it (after Merge: Compress, Sign, Watermark, Page numbers). |
| **Scanner** | **+** → *Camera*: Google's ML Kit document scanner (auto edges, crop & rotate, filters, clean, retake, more pages, gallery import) → JPG pages + PDF. *Gallery*: pick photos → review (order, discard with "Are you sure you want to discard this image?", add pages) → PDF. Two sections: Scanned images, Converted PDFs. |
| **Files** | My Storage (real size and counts of Fileora's files, processed count, phone used/free space), Internal storage (Android file picker → open), filters All Files / PDF / Images / Documents / Folders (Downloads, Processed, Scans). |
| **Settings** | Account (currently free to use), Dark mode (saved on the phone), Terms & Conditions, Privacy Policy, About, Contact (website pages), Share application (Android share sheet: WhatsApp, etc.). Footer: Fileora logo, version, "Developed by @techdeployers" → www.techdeployers.com. |
| **Saving** | Results: the app's own Fileora folder (shown in Files) + a copy in **Downloads/Fileora**. |
| **Analytics** | Google Analytics for Firebase: screens, tool opens. Never file names or contents; advertising ID off. The Home charts and lists use only the history file on the phone. |

**Permissions:** Internet; storage only on Android 7–9 (for Downloads/Fileora). No camera permission (photos are taken with the phone's camera app), no photo/storage permission on Android 10+ (Android's photo picker and file picker), no location, no advertising ID.

**No keys in the app:** the app only uses the public website. Server tools go through WordPress (per-task token, daily limit, file checks), which forwards them to the processing server. Nothing on the website or the server was changed for the app.

**Website pages used by Settings** are found by slug: Terms (`terms-and-conditions`, `terms-of-service`, `terms-of-use`, `terms`), Privacy (`privacy-policy`), About (`about-us`, `about`), Contact (`contact`, `contact-us`). If a page doesn't exist on the site, the app says so.

## Get the APK
Every push to `main` builds the APK on GitHub Actions (about 15 minutes):
- **Actions** → the run → **Artifacts** → `fileora-apk`, or
- the `builds` branch → `fileora-app.apk`.

Version: `package.json` → `version` (Gradle uses it: 0.4.0 → versionName 0.4.0, versionCode 400).

### Your own signing key (recommended before sharing the app)
Add these in GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**:
`FILEORA_KEYSTORE_BASE64` (the keystore file, base64), `FILEORA_KEYSTORE_PASSWORD`, `FILEORA_KEY_ALIAS`, `FILEORA_KEY_PASSWORD`.
The next build is signed with it. Keep a backup of the keystore and passwords: every future update must be signed with the same key. Phones with a test-key build must uninstall it once before installing the first build with your key.

## Run on a computer (optional)
Node 22, JDK 17, Android Studio. `npm ci`, then `npx react-native run-android` with a phone (USB debugging) or an emulator.

## Before the Play Store
- This APK is signed with React Native's public **test key**: for testing only. The store version needs your private upload key (kept by you, never in the repository) and an AAB (`./gradlew bundleRelease`).
- Data safety form: app activity (screens, tool opens) and device/app info for Analytics; files sent to server tools are processed and deleted after download (or within 1 hour); files, scans and history in the app stay on the phone.

## Files
| Path | What |
|---|---|
| `App.tsx` | Native stack (Tabs, Tool, Process, Web, Activity, ScanReview, Blog) + 6 bottom tabs, splash, menu |
| `src/screens/` | Home, Tools, Tool, Process (native tools), Scanner, ScanEditor, ScanDoc, Shared, Files, Cloud, RecycleBin, Activity, Alerts, Promo, Settings, Blog, Web |
| `src/ads/` | AdMob placements (native card, banners, full-screen after tasks, rewarded ad-free hours), consent, limits |
| `src/scanner/editor.html` | Scanner editor page (edge detection, perspective, filters); `npm run editor` regenerates `editorHtml.ts` |
| `android/app/src/main/java/in/fileora/app/FileoraNativeModule.kt` | Share-to-Fileora, PDF pages as images, cloud app hand-off |
| `src/store/` | On-phone state (files, usage history, theme), derived numbers for Home, file helpers |
| `src/lib/pdf.ts` | Merge, watermark, page numbers, images → PDF (pdf-lib) |
| `src/lib/serverJob.ts` | Server tools through `fileora.in/wp-json/fileora/v1/jobs` |
| `src/lib/capture.ts`, `pick.ts`, `output.ts`, `native.ts` | Camera/photos, file picker, saving results, native helpers |
| `src/data/nativeTools.ts` | Which tools run natively, their options, related tools |
| `src/components/UsageCharts.tsx` | Donut and 7-day bars |
| `src/components/` | Header, tab bar, menu, file rows/thumbnails, result pop-up, splash |
| `src/data/tools.ts` | The 69 tools (from the plugin) |
| `src/api/wp.ts`, `src/config.ts` | Website addresses and REST calls |
| `.github/workflows/android.yml` | APK build on GitHub |
