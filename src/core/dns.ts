import { execCommand, checkDnsmasqRunning } from '../utils';
import { existsSync } from 'fs';
import {
  addDnsmasqConfigEntry,
  removeDnsmasqConfigEntry,
  checkDnsmasqConfigEntry,
  restartDnsmasqService
} from './dnsmasq-service';

const LOOPBACK_IP = '127.0.0.10';

export async function setupDNSForTLD(tld: string): Promise<void> {
  // Check if DNS entry already exists
  if (await checkDnsmasqEntry(tld)) {
    return;
  }
  
  // Add entry to dnsmasq
  await addDnsmasqEntry(tld);
  
  // Create macOS resolver
  await createResolver(tld);
  
  // Restart dnsmasq
  await restartDnsmasq();
}

export async function checkDnsmasqEntry(tld: string): Promise<boolean> {
  return await checkDnsmasqConfigEntry(tld, LOOPBACK_IP);
}


export async function addDnsmasqEntry(tld: string): Promise<void> {
  await addDnsmasqConfigEntry(tld, LOOPBACK_IP);
}

export async function createResolver(tld: string): Promise<void> {
  const resolverPath = `/etc/resolver/${tld}`;
  
  // Check if resolver already exists
  if (existsSync(resolverPath)) {
    return;
  }
  
  // Create resolver directory if it doesn't exist
  await execCommand('sudo mkdir -p /etc/resolver');
  
  // Create resolver file pointing to port 53530 (halo-managed dnsmasq)
  const result = await execCommand(`sudo sh -c 'printf "nameserver 127.0.0.1\\\\nport 53530" > ${resolverPath}'`);
  
  if (!result.success) {
    throw new Error(`Failed to create resolver: ${result.stderr}`);
  }
}

export async function restartDnsmasq(): Promise<void> {
  await restartDnsmasqService();
}

export async function removeDNSForTLD(tld: string): Promise<void> {
  // Remove from dnsmasq config
  await removeDnsmasqConfigEntry(tld);
  
  // Remove resolver
  await execCommand(`sudo rm -f /etc/resolver/${tld}`);
  
  // Restart dnsmasq
  await restartDnsmasq();
}

export async function flushDNSCache(): Promise<void> {
  // macOS requires sudo for DNS cache flush
  await execCommand('sudo dscacheutil -flushcache');
  // Also flush mDNSResponder for better coverage
  await execCommand('sudo killall -HUP mDNSResponder');
}

export async function registerTLD(tld: string): Promise<void> {
  // Check if DNS entry already exists
  if (await checkDnsmasqEntry(tld)) {
    // Already registered, just ensure resolver exists
    await createResolver(tld);
    // Flush DNS cache to ensure changes take effect
    await flushDNSCache();
    return;
  }
  
  // Add entry to dnsmasq
  await addDnsmasqEntry(tld);
  
  // Create macOS resolver
  await createResolver(tld);
  
  // Restart dnsmasq
  await restartDnsmasq();
  
  // Flush DNS cache to ensure changes take effect
  await flushDNSCache();
}

export async function unregisterTLD(tld: string): Promise<void> {
  // Remove from dnsmasq config
  await removeDnsmasqConfigEntry(tld);
  
  // Remove resolver
  await execCommand(`sudo rm -f /etc/resolver/${tld}`);
  
  // Restart dnsmasq
  await restartDnsmasq();
  
  // Flush DNS cache to ensure changes take effect
  await flushDNSCache();
}

export async function checkTLDRegistration(tld: string): Promise<boolean> {
  // Check if dnsmasq entry exists
  const hasDnsmasq = await checkDnsmasqEntry(tld);
  
  // Check if resolver exists
  const resolverPath = `/etc/resolver/${tld}`;
  const hasResolver = existsSync(resolverPath);
  
  return hasDnsmasq && hasResolver;
}
