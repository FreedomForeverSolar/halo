import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

export async function execCommand(command: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error: any) {
    return { success: false, stdout: error.stdout?.trim() || '', stderr: error.stderr?.trim() || error.message };
  }
}

export function getHaloDir(): string {
  return path.join(os.homedir(), '.halo');
}

export function getConfigPath(): string {
  return path.join(getHaloDir(), 'config.json');
}

export function getCaddyfilePath(): string {
  return path.join(getHaloDir(), 'Caddyfile');
}

export function getDnsmasqConfPath(): string {
  return path.join(getHaloDir(), 'dnsmasq.conf');
}

export function getLogsDir(): string {
  return path.join(getHaloDir(), 'logs');
}

export function getLaunchdPlistPath(name: string): string {
  // All services now run as user agents since PF handles port forwarding
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `com.halo.${name}.plist`);
}

export function getSystemLaunchdPlistPath(name: string): string {
  // System-level LaunchDaemon path (requires sudo to manage)
  return path.join('/Library', 'LaunchDaemons', `com.halo.${name}.plist`);
}

export async function ensureHaloDir(): Promise<void> {
  const haloDir = getHaloDir();
  if (!existsSync(haloDir)) {
    await mkdir(haloDir, { recursive: true });
  }
  
  const logsDir = getLogsDir();
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }
}

export function extractTLD(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1];
}

export function isValidTarget(target: string): boolean {
  // Match localhost:port or IP:port
  return /^(localhost|127\.0\.0\.\d+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.test(target);
}

export async function checkDependency(command: string): Promise<boolean> {
  const result = await execCommand(`which ${command}`);
  return result.success && result.stdout.length > 0;
}

export async function checkDnsmasqRunning(): Promise<boolean> {
  // Check if halo-managed dnsmasq is running by checking LaunchAgent status
  const plistPath = getLaunchdPlistPath('dnsmasq');
  if (!existsSync(plistPath)) {
    return false;
  }
  
  // Check if process is running via launchctl
  const result = await execCommand('launchctl list | grep com.halo.dnsmasq');
  return result.success;
}

export async function testDNSResolution(domain: string): Promise<boolean> {
  // Use dig to test if domain resolves to 127.0.0.10, querying port 53530
  const result = await execCommand(`dig @127.0.0.1 -p 53530 +short ${domain} +time=1 +tries=1`);
  return result.success && result.stdout === '127.0.0.10';
}

export function getDomainsForNamespace(config: any, tld: string): Array<{ domain: string; ports: number[] }> {
  // Get all domains using a specific namespace/TLD
  const domains: Array<{ domain: string; ports: number[] }> = [];

  for (const [domain, portMappings] of Object.entries(config.mappings)) {
    const domainTld = domain.split('.').pop();
    if (domainTld === tld) {
      const ports = Object.keys(portMappings).map(p => parseInt(p));
      domains.push({ domain, ports });
    }
  }

  return domains;
}

export async function testDomainRouting(domain: string, port: number = 80): Promise<boolean> {
  // Test if domain routes through the proxy by attempting an HTTP request
  // Any HTTP response (2xx, 3xx, 4xx, 5xx) means routing is working
  const url = port === 80 ? `http://${domain}` : `http://${domain}:${port}`;
  const result = await execCommand(`curl -s -o /dev/null -w "%{http_code}" "${url}" --max-time 2 --connect-timeout 2`);

  // Check if we got any HTTP response code (including connection refused would return empty)
  if (!result.success || !result.stdout) {
    return false;
  }

  // Any valid HTTP status code means routing is working
  const statusCode = parseInt(result.stdout);
  return !isNaN(statusCode) && statusCode >= 100 && statusCode < 600;
}

export async function checkCaddyCAIsTrusted(): Promise<boolean> {
  // Check if Caddy's CA certificate is trusted in the system keychain
  const result = await execCommand('security find-certificate -a -c "Caddy Local Authority" /Library/Keychains/System.keychain 2>/dev/null');
  return result.success && result.stdout.includes('Caddy Local Authority');
}
