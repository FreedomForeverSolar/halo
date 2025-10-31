# 🔵 Halo

**Your local development guardian** - Simple DNS and SSL management for custom domains in local development.

Halo makes it easy to use custom domains like `portal.myapp` or `api.helios` instead of `localhost:3000` in your local development environment. It handles DNS resolution, SSL certificates, and routing automatically.

## Quick Start

```bash
# Install via Homebrew
brew install freedomforeversolar/tap/halo

# Run initial setup (requires sudo for system configuration)
halo setup

# Register a namespace (custom TLD)
halo ns add myapp

# Add a domain mapping
halo add portal.myapp localhost:3000

# Access your app with HTTPS!
open https://portal.myapp
```

That's it! Your local service is now accessible via `https://portal.myapp` with automatic SSL.

---

## Installation

### Option 1: Homebrew (Recommended)

```bash
# Add the FreedomForeverSolar tap
brew tap freedomforeversolar/tap

# Install Halo
brew install halo
```

The Homebrew formula automatically installs dependencies (`caddy` and `dnsmasq`).

### Option 2: Build from Source

**Prerequisites:**
- [Bun](https://bun.sh) runtime installed
- macOS (required for PF and system integration)

**Build steps:**

```bash
# Clone the repository
git clone https://github.com/freedomforeversolar/halo.git
cd halo

# Install dependencies
bun install

# Build the binary
make build

# Install to /usr/local/bin (requires sudo)
make install

# Verify installation
halo --version
```

### System Requirements

- **OS**: macOS (uses Packet Filter and macOS-specific DNS resolver)
- **Dependencies**: `caddy`, `dnsmasq` (auto-installed via Homebrew)
- **Privileges**: Requires `sudo` for system-level configuration

---

## Setup

Run the initial setup once after installation:

```bash
halo setup
```

### What Setup Does

The setup process configures your system for local domain routing:

1. **Checks Dependencies** - Verifies `caddy` and `dnsmasq` are installed
2. **Creates Configuration** - Initializes Halo's config directory (`~/.halo/`)
3. **Loopback Alias** - Creates `127.0.0.10` as a dedicated IP for Halo
4. **Port Forwarding** - Configures PF rules to route ports 80→8080, 443→8443
5. **DNS Service** - Sets up and starts a dedicated dnsmasq service for Halo
6. **Caddy Setup** - Configures Caddy as a reverse proxy with automatic SSL
7. **CA Certificate** - Installs Caddy's CA certificate for trusted SSL

**Note**: Setup requires `sudo` privileges for system-level changes.

### Verify Setup

After setup completes, verify everything is working:

```bash
halo doctor
```

This runs diagnostic checks on all Halo components.

---

## Namespaces

Namespaces are custom top-level domains (TLDs) like `.myapp` or `.helios`. You must register a namespace before adding domains under it.

### Register a Namespace

```bash
halo ns add myapp
```

This configures DNS resolution for all domains ending in `.myapp`.

### List Registered Namespaces

```bash
halo ns list
# or
halo ns ls
```

Shows all registered namespaces and how many domains use each one.

### Check Namespace Status

```bash
halo ns status myapp
```

Verifies that a namespace is properly configured and DNS resolution is working.

### Fix Namespace Issues

If a namespace has configuration problems:

```bash
halo ns fix myapp
```

Automatically repairs DNS configuration and restarts services.

### Remove a Namespace

```bash
# Remove (requires no active domains)
halo ns remove myapp

# Force remove even with active domains
halo ns remove myapp --force
```

**Note**: You must remove all domains using a namespace before removing it (unless using `--force`).

---

## Domain Routes

Domain routes map custom domains to your local services.

### Add a Domain Mapping

**Basic HTTP (port 80):**
```bash
halo add portal.myapp localhost:3000
```
Access at: `http://portal.myapp`

**Basic HTTPS (port 443):**
```bash
halo add portal.myapp localhost:3000
```
Access at: `https://portal.myapp` (SSL termination handled by Caddy)

**Custom Port with HTTP:**
```bash
halo add api.myapp:8080 localhost:4000
```
Access at: `http://api.myapp:8080`

**Custom Port with SSL Termination:**
```bash
halo add api.myapp:8443 localhost:4000 --ssl
```
Access at: `https://api.myapp:8443` (Caddy terminates SSL, forwards HTTP to `localhost:4000`)

**Full URL Syntax:**
```bash
# These are equivalent
halo add portal.myapp localhost:3000
halo add https://portal.myapp localhost:3000
halo add portal.myapp:443 localhost:3000
```

### List Active Mappings

```bash
halo list
# or
halo ls
```

Shows:
- All registered namespaces
- All active domain mappings
- Port configurations and targets

### Remove a Domain Mapping

```bash
# Remove all ports for a domain
halo remove portal.myapp

# Remove specific port
halo remove portal.myapp:443

# Remove using protocol (removes default port)
halo remove https://portal.myapp  # removes port 443
halo remove http://portal.myapp   # removes port 80
```

### How It Works

1. **DNS Resolution**: dnsmasq resolves `portal.myapp` → `127.0.0.10`
2. **Port Forwarding**: PF rules forward `127.0.0.10:443` → `127.0.0.10:8443`
3. **Reverse Proxy**: Caddy listens on `8443`, terminates SSL, proxies to `localhost:3000`
4. **Your Browser**: Connects to `https://portal.myapp` with a valid SSL certificate

---

## Doctor and Troubleshooting

### Run Diagnostics

```bash
halo doctor
```

The doctor command checks:
- ✓ Dependencies installed (caddy, dnsmasq)
- ✓ Setup complete (config, loopback alias, PF rules, services)
- ✓ DNS configured (namespaces, dnsmasq running, resolution tests)
- ✓ Caddy running and responsive

If issues are found, the doctor provides specific fix commands.

### Common Issues

#### Issue: Domain doesn't resolve

**Symptoms**: `nslookup portal.myapp` fails or `ping portal.myapp` doesn't work

**Solutions**:
```bash
# Check namespace registration
halo ns status myapp

# Fix namespace configuration
halo ns fix myapp

# Restart DNS service
halo dns restart

# Flush DNS cache
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

#### Issue: "Connection refused" or SSL errors

**Symptoms**: Browser shows connection errors when accessing domain

**Solutions**:
```bash
# Check if Caddy is running
halo doctor

# Restart Caddy service
halo restart

# If SSL certificate issues, re-trust the CA
sudo caddy trust --address localhost:2019
```

#### Issue: Service not starting

**Symptoms**: `halo start` fails or service immediately stops

**Solutions**:
```bash
# Check service status
launchctl list | grep halo

# View service logs
cat ~/.halo/caddy.log

# Regenerate configuration and restart
halo restart
```

#### Issue: Port conflicts

**Symptoms**: Setup fails or Caddy won't start due to port already in use

**Solutions**:
```bash
# Check what's using ports 8080 or 8443
lsof -i :8080
lsof -i :8443

# Stop conflicting services or change Halo's ports in config
# Edit ~/.halo/config.json and adjust httpPort/httpsPort
```

### Service Management

**Start Halo:**
```bash
halo start
```

**Stop Halo:**
```bash
halo stop
```

**Restart Halo:**
```bash
halo restart
```

**Check Service Status:**
```bash
halo doctor  # includes service status
```

### DNS Service Management

**Start dnsmasq:**
```bash
halo dns start
```

**Stop dnsmasq:**
```bash
halo dns stop
```

**Restart dnsmasq:**
```bash
halo dns restart
```

**Check DNS Status:**
```bash
halo dns status
```

---

## Cleanup

To completely remove Halo and all its configuration:

```bash
halo cleanup
```

### What Cleanup Removes

The cleanup process (requires `sudo`):

1. ✓ Stops and removes Caddy service
2. ✓ Stops and removes dnsmasq service  
3. ✓ Removes port forwarding rules (PF)
4. ✓ Removes DNS configuration (resolvers, dnsmasq entries)
5. ✓ Removes loopback alias (`127.0.0.10`)
6. ✓ Deletes Halo directory (`~/.halo/`)

After cleanup, your system is returned to its original state.

### When to Use Cleanup

- Completely removing Halo from your system
- Troubleshooting persistent issues (cleanup + fresh setup)
- Before reinstalling Halo

**Note**: After cleanup, you'll need to run `halo setup` again if you want to use Halo.

---

## Examples

### Example: Multi-service Development

```bash
# Register your project namespace
halo ns add myproject

# Frontend on port 3000
halo add app.myproject localhost:3000

# Backend API on port 4000
halo add api.myproject localhost:4000

# Admin panel on port 5000
halo add admin.myproject localhost:5000

# View all mappings
halo list
```

Now access:
- `https://app.myproject` → Frontend
- `https://api.myproject` → API
- `https://admin.myproject` → Admin

### Example: Custom Ports

```bash
# Frontend on custom HTTPS port
halo add app.myproject:8443 localhost:3000 --ssl

# API on custom HTTP port  
halo add api.myproject:8080 localhost:4000

# WebSocket service (no SSL)
halo add ws.myproject:9000 localhost:9000
```

Access:
- `https://app.myproject:8443`
- `http://api.myproject:8080`
- `ws://ws.myproject:9000`

---

## Command Reference

### Setup & Maintenance
- `halo setup` - Initial system setup
- `halo cleanup` - Remove all Halo configuration
- `halo doctor` - Diagnose and check system health

### Domain Routes
- `halo add <url> <target>` - Add domain mapping
- `halo remove <url>` - Remove domain mapping
- `halo list` / `halo ls` - List all mappings

### Namespaces
- `halo ns add <namespace>` - Register namespace
- `halo ns remove <namespace>` - Unregister namespace
- `halo ns list` / `halo ns ls` - List namespaces
- `halo ns status <namespace>` - Check namespace configuration
- `halo ns fix <namespace>` - Fix namespace issues

### Services
- `halo start` - Start Caddy service
- `halo stop` - Stop Caddy service
- `halo restart` - Restart Caddy service

### DNS
- `halo dns start` - Start dnsmasq
- `halo dns stop` - Stop dnsmasq
- `halo dns restart` - Restart dnsmasq
- `halo dns status` - Check DNS status

---

## How It Works

Halo creates a complete local development environment for custom domains:

1. **DNS Resolution**: dnsmasq intercepts requests for your custom TLDs (e.g., `.myapp`) and resolves them to `127.0.0.10`

2. **Loopback Alias**: A secondary loopback IP (`127.0.0.10`) keeps Halo isolated from other localhost services

3. **Port Forwarding**: macOS Packet Filter (PF) forwards privileged ports (80, 443) to unprivileged ports (8080, 8443) where Caddy runs without root

4. **Reverse Proxy**: Caddy handles HTTPS with automatic SSL certificates and proxies requests to your local services

5. **Automatic SSL**: Caddy generates and manages SSL certificates using its internal CA, trusted by your system

---

## Configuration

Halo stores its configuration in `~/.halo/`:

```
~/.halo/
├── config.json          # Main configuration
├── Caddyfile           # Generated Caddy configuration
├── dnsmasq.conf        # dnsmasq configuration
└── caddy.log           # Caddy service logs
```

**config.json structure:**
```json
{
  "version": "1.0.0",
  "loopbackIP": "127.0.0.10",
  "httpPort": 8080,
  "httpsPort": 8443,
  "mappings": {
    "portal.myapp": {
      "443": {
        "target": "localhost:3000",
        "ssl": true,
        "protocol": "https"
      }
    }
  },
  "tlds": {
    "myapp": {
      "dnsConfigured": true
    }
  }
}
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/freedomforeversolar/halo/issues)
- **Diagnostics**: Run `halo doctor` for automated troubleshooting
- **Logs**: Check `~/.halo/caddy.log` for service logs

---

## License

MIT License - see LICENSE file for details.

---

## Contributing

Contributions welcome! Please see the contributing guidelines in the repository.
