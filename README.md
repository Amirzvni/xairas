# Xairas

Lightweight security monitoring for Linux servers. Single binary, zero dependencies, real-time alerts via Telegram and email.

Xairas gives you instant system snapshots and a background daemon that watches for threats — new ports, ARP spoofing, SUID binaries, unauthorized users, kernel modules, and more. Deploy in under a minute.

## Screenshots

![Resources Monitor](assets/resources.png)

![Network Audit](assets/network.png)

![Alert Email](assets/email-alerts.png)

![Daily Report](assets/daily-reports.png)


## Quick Start

**Option A — Standalone binary (recommended for production):**

```bash
# Copy the binary to your server
sudo cp xairas /usr/local/bin/xairas
sudo chmod 755 /usr/local/bin/xairas

# Configure
sudo xairas config init

# Start monitoring
sudo xairas daemon start
```

**Option B — Via npm (requires Node.js 22+):**

```bash
npm install -g xairas
sudo xairas config init
sudo xairas daemon start
```

## Commands

### Instant Snapshots

Run any of these for an immediate system view:

```bash
sudo xairas resources    # CPU, RAM, disk, I/O, network, processes
sudo xairas network      # Listening ports, connections, process ownership
sudo xairas filesystem   # SUID binaries, /tmp, cron, timers, sensitive files
sudo xairas auth         # Failed logins, users, sudo, SSH sessions, sudoers
sudo xairas services     # Running services
sudo xairas kernel       # NTP, AppArmor, kernel modules
```

### Configuration

```bash
sudo xairas config init          # Interactive wizard
sudo xairas config set <key> <value>
sudo xairas config get <key>
sudo xairas config list          # Shows all values, secrets are masked
```

**Config keys:**

| Key | Description | Default |
|-----|-------------|---------|
| `telegram.apiUrl` | Telegram API URL (change for reverse proxy) | `https://api.telegram.org` |
| `telegram.botToken` | Bot token from BotFather | |
| `telegram.chatId` | Chat/group ID for alerts | |
| `email.host` | SMTP server | |
| `email.port` | SMTP port | `587` |
| `email.username` | SMTP username | |
| `email.password` | SMTP password | |
| `email.from` | Sender address | |
| `email.to` | Recipient addresses (comma-separated) | |
| `report.dailyTime` | Daily report time (HH:MM) | `08:00` |
| `report.timezone` | Timezone | `UTC` |
| `thresholds.diskioRead` | Disk read alert threshold (MB/s) | `100` |
| `thresholds.diskioWrite` | Disk write alert threshold (MB/s) | `100` |
| `alerts.newPort` | Alert on new listening ports | `true` |
| `alerts.newTmp` | Alert on new files in /tmp | `true` |

### Reports

```bash
sudo xairas report               # Send a full report right now
```

Sends a formatted report to all configured channels (email + Telegram).

### Daemon

```bash
sudo xairas daemon start         # Install and start as systemd service
sudo xairas daemon stop          # Stop and disable
sudo xairas daemon status        # Check if running
sudo xairas daemon logs          # Show last 50 log lines
```

The daemon survives reboots. It runs as a systemd service under `/etc/systemd/system/xairas.service`.

## What the Daemon Monitors

Every 60 seconds, the daemon checks:

### Resource Alerts
- **CPU** — alert at 90%
- **RAM** — alert at 90%
- **Swap** — alert at 90%
- **Disk usage** — alert at 90% per partition
- **Inode usage** — alert at 90%
- **Zombie processes** — alert at 100+
- **Disk I/O** — alert at configurable MB/s threshold

### Network Alerts
- **New listening port** — a port opens that wasn't there before (togglable)
- **ARP spoofing** — a known IP changes its MAC address

### Filesystem Alerts
- **New SUID/SGID binary** — privilege escalation vector
- **Cron job changes** — persistence mechanism
- **Systemd timer changes** — modern persistence mechanism
- **New files in /tmp or /dev/shm** — attacker staging areas (togglable)
- **Sensitive file modifications** — .bashrc, .profile, authorized_keys
- **LD_PRELOAD hijacking** — malicious shared library injection
- **rc.local changes** — boot persistence

### Security Alerts
- **New user accounts** — backdoor accounts
- **Sudoers changes** — privilege escalation
- **PAM module tampering** — backdoor authentication
- **New services or re-enabled services** — unauthorized software
- **New kernel modules** — rootkit detection
- **Unexpected reboot** — uptime reset
- **AppArmor disabled** — security control removed
- **NTP disabled or clock desync** — log tampering attempt

### Daily Report
- Full system report sent at the configured time via email and Telegram

All alerts have a **30-minute cooldown** — if a condition persists, you get reminded every 30 minutes, not every 60 seconds.

## Security

- Config stored at `/etc/xairas/config.json` with `0600` permissions (root only)
- Sensitive fields (tokens, passwords) encrypted with AES-256-CBC
- Encryption key derived from `/etc/machine-id` — config file is useless if copied to another machine
- No data leaves the server except through your configured Telegram and email channels

## Building from Source

Requires Node.js 22+ and a Linux machine (binary compiles for current platform only):

```bash
git clone https://github.com/amirzvni/xairas.git
cd xairas
npm install

# Bundle
npx esbuild src/index.js --bundle --platform=node --format=cjs --outfile=dist/xairas.js

# Create SEA config
cat > sea-config.json << 'EOF'
{
  "main": "dist/xairas.js",
  "output": "dist/sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF

# Generate blob
node --experimental-sea-config sea-config.json

# Copy node binary
cp $(which node) dist/xairas

# Inject blob
npx postject dist/xairas NODE_SEA_BLOB dist/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Install
sudo cp dist/xairas /usr/local/bin/xairas
sudo chmod 755 /usr/local/bin/xairas
```

## Architecture

```
src/
├── index.js              Entry point
├── cli.js                Routes to commands
├── commands/
│   ├── auth.js           Authentication audit
│   ├── config.js         Configuration management
│   ├── daemon.js         Daemon start/stop/status
│   ├── filesystem.js     Filesystem audit
│   ├── kernel.js         Kernel & system audit
│   ├── network.js        Network audit
│   ├── report.js         On-demand report
│   ├── resources.js      Resource monitor
│   └── services.js       Services audit
├── daemon/
│   ├── scheduler.js      Job scheduler (30s tick)
│   └── jobs/
│       ├── alerts.js           Resource threshold alerts
│       ├── filesystem-alerts.js Filesystem change detection
│       ├── network-alerts.js    Port & ARP monitoring
│       ├── report.js            Daily scheduled report
│       └── security-alerts.js   User, service, kernel monitoring
└── utils/
    ├── auth.js           Auth log parsers
    ├── config.js         Config read/write
    ├── crypto.js         Machine-bound encryption
    ├── filesystem.js     Filesystem parsers
    ├── kernel.js         Kernel parsers
    ├── network.js        Network parsers
    ├── notify.js         Telegram & email senders
    ├── report.js         Report builder & formatters
    ├── resources.js      Resource parsers (/proc)
    └── services.js       Service parsers
```

## Data Sources

Xairas reads directly from `/proc` and standard Linux tools. No kernel modules, no eBPF, no agents. Works on any Linux distribution with systemd.

| Source | Used For |
|--------|----------|
| `/proc/uptime` | Uptime, reboot detection |
| `/proc/stat` | CPU usage, process spawn rate |
| `/proc/meminfo` | RAM and swap |
| `/proc/diskstats` | Disk I/O rates |
| `/proc/net/dev` | Network bandwidth |
| `/proc/net/arp` | ARP spoofing detection |
| `/proc/modules` | Kernel module monitoring |
| `/proc/*/status` | Process list, zombies, root processes |
| `ss` | Ports, connections, process ownership |
| `df` | Disk and inode usage |
| `systemctl` | Services, timers |
| `aa-status` | AppArmor status |
| `timedatectl` | NTP and time sync |
| `/etc/passwd` | User accounts |
| `/etc/sudoers` | Sudo rules |
| `/etc/pam.d/` | PAM integrity |
| `/var/log/auth.log` | Failed logins, sudo history |

## Requirements

- Linux (any distribution with systemd and glibc)
- Root access (most features require it)
- Node.js 22+ (only for npm install or building from source — not needed for binary)

## Telegram Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Add the bot to your alerts group
3. Disable privacy mode: BotFather → /mybots → Bot Settings → Group Privacy → Turn Off
4. Send a message in the group, then get the chat ID:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool
   ```
5. Configure:
   ```bash
   sudo xairas config set telegram.botToken "<TOKEN>"
   sudo xairas config set telegram.chatId "<CHAT_ID>"
   ```

For regions where Telegram is blocked, set a reverse proxy URL:
```bash
sudo xairas config set telegram.apiUrl "https://your-reverse-proxy.com/api-telegram"
```

## License

MIT