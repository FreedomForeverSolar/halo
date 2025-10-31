import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { execCommand, getLaunchdPlistPath, getDnsmasqConfPath } from '../utils';

export async function createDnsmasqConfig(): Promise<void> {
  const confPath = getDnsmasqConfPath();
  
  // Create basic dnsmasq configuration
  const config = `# Halo-managed dnsmasq configuration
# This file is automatically managed by Halo

# Listen on localhost only
listen-address=127.0.0.1

# Don't read /etc/resolv.conf or /etc/hosts
no-resolv
no-hosts

# Don't poll for changes
no-poll

# Cache size
cache-size=1000

# Domain mappings will be added below by Halo
`;

  await writeFile(confPath, config, 'utf-8');
}

export async function addDnsmasqConfigEntry(tld: string, ip: string): Promise<void> {
  const confPath = getDnsmasqConfPath();
  const entry = `address=/.${tld}/${ip}\n`;
  
  // Append entry to config file
  const result = await execCommand(`echo "${entry}" >> ${confPath}`);
  
  if (!result.success) {
    throw new Error(`Failed to add DNS entry: ${result.stderr}`);
  }
}

export async function removeDnsmasqConfigEntry(tld: string): Promise<void> {
  const confPath = getDnsmasqConfPath();
  
  // Remove entry from config file (no sudo needed)
  const result = await execCommand(`sed -i '' "/address=\\\\/\\\\.${tld}\\\\//d" ${confPath}`);
  
  if (!result.success) {
    throw new Error(`Failed to remove DNS entry: ${result.stderr}`);
  }
}

export async function checkDnsmasqConfigEntry(tld: string, ip: string): Promise<boolean> {
  const confPath = getDnsmasqConfPath();
  
  if (!existsSync(confPath)) {
    return false;
  }
  
  const result = await execCommand(`grep "address=/\\\\.${tld}/${ip}" ${confPath}`);
  return result.success;
}

export async function createDnsmasqService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('dnsmasq');
  const confPath = getDnsmasqConfPath();
  
  // Get dnsmasq binary path
  const whichResult = await execCommand('which dnsmasq');
  if (!whichResult.success) {
    throw new Error('dnsmasq binary not found. Install with: brew install dnsmasq');
  }
  const dnsmasqBin = whichResult.stdout;
  
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.halo.dnsmasq</string>
    <key>ProgramArguments</key>
    <array>
        <string>${dnsmasqBin}</string>
        <string>--port=53530</string>
        <string>--no-daemon</string>
        <string>--conf-file=${confPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/halo-dnsmasq.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/halo-dnsmasq-error.log</string>
</dict>
</plist>`;

  await writeFile(plistPath, plist, 'utf-8');
}

export async function startDnsmasqService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('dnsmasq');
  
  if (!existsSync(plistPath)) {
    throw new Error('dnsmasq service not created. Run: halo setup');
  }
  
  // Load the service
  const result = await execCommand(`launchctl load ${plistPath}`);
  
  if (!result.success) {
    throw new Error(`Failed to start dnsmasq service: ${result.stderr}`);
  }
}

export async function stopDnsmasqService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('dnsmasq');
  
  if (!existsSync(plistPath)) {
    return; // Service doesn't exist, nothing to stop
  }
  
  // Unload the service
  await execCommand(`launchctl unload ${plistPath}`);
}

export async function restartDnsmasqService(): Promise<void> {
  await stopDnsmasqService();
  
  // Wait a moment for service to fully stop
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await startDnsmasqService();
}

export async function removeDnsmasqService(): Promise<void> {
  await stopDnsmasqService();
  
  const plistPath = getLaunchdPlistPath('dnsmasq');
  
  if (existsSync(plistPath)) {
    await execCommand(`rm ${plistPath}`);
  }
}

export async function stopSystemDnsmasq(): Promise<void> {
  // Check if system dnsmasq is running
  const result = await execCommand('sudo brew services list | grep dnsmasq | grep started');
  
  if (result.success) {
    // Stop system dnsmasq
    await execCommand('sudo brew services stop dnsmasq');
  }
}
