import { execCommand, getSystemLaunchdPlistPath } from '../utils';
import { writeFile } from 'fs/promises';

const LOOPBACK_IP = '127.0.0.10';

export async function setupLoopbackAlias(): Promise<void> {
  // Check if alias exists
  if (await checkLoopbackAlias()) {
    return;
  }
  
  // Create alias
  await createLoopbackAlias();
  
  // Create launchd plist for persistence
  await createLoopbackLaunchAgent();
}

async function checkLoopbackAlias(): Promise<boolean> {
  const result = await execCommand(`ifconfig lo0 | grep ${LOOPBACK_IP}`);
  return result.success;
}

async function createLoopbackAlias(): Promise<void> {
  const result = await execCommand(`sudo ifconfig lo0 alias ${LOOPBACK_IP} up`);
  
  if (!result.success) {
    throw new Error(`Failed to create loopback alias: ${result.stderr}`);
  }
}

async function createLoopbackLaunchAgent(): Promise<void> {
  const plistPath = getSystemLaunchdPlistPath('loopback');
  
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.halo.loopback</string>
  <key>ProgramArguments</key>
  <array>
    <string>/sbin/ifconfig</string>
    <string>lo0</string>
    <string>alias</string>
    <string>${LOOPBACK_IP}</string>
    <string>up</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>`;
  
  // Write to temp file first
  const tempPath = '/tmp/com.halo.loopback.plist';
  await writeFile(tempPath, plistContent, 'utf-8');
  
  // Move to system location with sudo
  const moveResult = await execCommand(`sudo mv ${tempPath} ${plistPath}`);
  if (!moveResult.success) {
    throw new Error(`Failed to create loopback daemon: ${moveResult.stderr}`);
  }
  
  // Set proper permissions
  await execCommand(`sudo chown root:wheel ${plistPath}`);
  await execCommand(`sudo chmod 644 ${plistPath}`);
  
  // Bootstrap the daemon using modern launchctl syntax
  const bootstrapResult = await execCommand(`sudo launchctl bootstrap system ${plistPath}`);
  if (!bootstrapResult.success) {
    // If it's already loaded, that's okay
    if (!bootstrapResult.stderr.includes('Already loaded') && !bootstrapResult.stderr.includes('service already loaded')) {
      throw new Error(`Failed to load loopback daemon: ${bootstrapResult.stderr}`);
    }
  }
}

export async function removeLoopbackAlias(): Promise<void> {
  // Remove alias
  await execCommand(`sudo ifconfig lo0 -alias ${LOOPBACK_IP}`);
  
  // Bootout and remove system daemon
  const plistPath = getSystemLaunchdPlistPath('loopback');
  await execCommand(`sudo launchctl bootout system/com.halo.loopback 2>/dev/null`);
  await execCommand(`sudo rm -f ${plistPath}`);
}
