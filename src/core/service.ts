import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { execCommand, getLaunchdPlistPath, getCaddyfilePath, getLogsDir } from '../utils';
import os from 'os';
import path from 'path';

export async function createCaddyService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('caddy');
  
  if (existsSync(plistPath)) {
    return;
  }
  
  // Ensure LaunchAgents directory exists
  const launchAgentsDir = path.dirname(plistPath);
  if (!existsSync(launchAgentsDir)) {
    await mkdir(launchAgentsDir, { recursive: true });
  }
  
  const logsDir = getLogsDir();
  const caddyfilePath = getCaddyfilePath();
  const username = os.userInfo().username;
  const userGroup = 'staff'; // Default group for macOS users
  
  // Find caddy binary
  const caddyPath = await findCaddyBinary();
  
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.halo.caddy</string>
  <key>ProgramArguments</key>
  <array>
    <string>${caddyPath}</string>
    <string>run</string>
    <string>--config</string>
    <string>${caddyfilePath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logsDir}/caddy.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/caddy-error.log</string>
  <key>WorkingDirectory</key>
  <string>${os.homedir()}</string>
  <key>UserName</key>
  <string>${username}</string>
  <key>GroupName</key>
  <string>${userGroup}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${os.homedir()}</string>
  </dict>
</dict>
</plist>`;
  
  // Write directly to user LaunchAgents (no sudo needed)
  await writeFile(plistPath, plistContent, 'utf-8');
}

async function findCaddyBinary(): Promise<string> {
  // Check common paths
  const paths = [
    '/opt/homebrew/bin/caddy',
    '/usr/local/bin/caddy'
  ];
  
  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // Try which command
  const result = await execCommand('which caddy');
  if (result.success && result.stdout) {
    return result.stdout.trim();
  }
  
  throw new Error('Caddy binary not found. Is Caddy installed?');
}

export async function startService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('caddy');
  
  if (!existsSync(plistPath)) {
    throw new Error('Service not installed. Run: halo setup');
  }
  
  // Unload first in case it's already loaded
  await execCommand(`launchctl unload ${plistPath} 2>/dev/null`);
  
  // Load the service (no sudo needed for user agents)
  const result = await execCommand(`launchctl load ${plistPath}`);
  
  if (!result.success) {
    throw new Error(`Failed to start service: ${result.stderr}`);
  }
}

export async function stopService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('caddy');
  
  const result = await execCommand(`launchctl unload ${plistPath}`);
  
  if (!result.success) {
    throw new Error(`Failed to stop service: ${result.stderr}`);
  }
}

export async function restartService(): Promise<void> {
  await stopService();
  await startService();
}

export async function getServiceStatus(): Promise<{ running: boolean; pid?: number }> {
  const result = await execCommand('launchctl list | grep com.halo.caddy');
  
  if (!result.success || !result.stdout) {
    return { running: false };
  }
  
  const parts = result.stdout.trim().split(/\s+/);
  const pid = parts[0] !== '-' ? parseInt(parts[0]) : undefined;
  
  return {
    running: true,
    pid
  };
}

export async function removeService(): Promise<void> {
  const plistPath = getLaunchdPlistPath('caddy');
  
  // Unload service
  await execCommand(`launchctl unload ${plistPath} 2>/dev/null`);
  
  // Remove plist file (no sudo needed for user files)
  await execCommand(`rm -f ${plistPath}`);
}
