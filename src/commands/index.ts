import chalk from 'chalk';
import { existsSync } from 'fs';
import { loadConfig, saveConfig } from '../core/config';
import { generateCaddyfile, reloadCaddy } from '../core/caddy';
import { startService, stopService, restartService, getServiceStatus } from '../core/service';
import { checkPFRules } from '../core/pf';
import { getConfigPath, getLaunchdPlistPath, execCommand, checkDnsmasqRunning } from '../utils';
import type { RemoveCommandOptions } from '../types';

export async function listCommand(): Promise<void> {
  try {
    const config = await loadConfig();
    
    console.log(chalk.bold('\n🔵 Halo Configuration\n'));
    
    // List registered namespaces
    const registeredTLDs = Object.entries(config.tlds)
      .filter(([_, tldConfig]) => tldConfig.dnsConfigured)
      .map(([tld]) => tld);
    
    if (registeredTLDs.length > 0) {
      console.log(chalk.white.bold('Registered Namespaces:'));
      for (const tld of registeredTLDs) {
        // Count domains using this TLD
        const domainCount = Object.keys(config.mappings).filter(domain => {
          const domainTld = domain.split('.').pop();
          return domainTld === tld;
        }).length;
        
        const countText = domainCount === 0 
          ? chalk.gray('(0 domains)')
          : chalk.white(`(${domainCount} domain${domainCount > 1 ? 's' : ''})`);
        
        console.log(chalk.gray('  → ') + chalk.white(`.${tld} `) + countText);
      }
      console.log();
    } else {
      console.log(chalk.gray('No namespaces registered yet\n'));
      console.log(chalk.white('Register one with:'), chalk.cyan('halo ns add myapp\n'));
    }
    
    // List domain mappings
    if (Object.keys(config.mappings).length === 0) {
      console.log(chalk.white.bold('Active Mappings:'));
      console.log(chalk.gray('  No mappings configured yet\n'));
      if (registeredTLDs.length > 0) {
        console.log(chalk.white('  Add one with:'), chalk.cyan(`halo add portal.${registeredTLDs[0]} localhost:3000\n`));
      }
      return;
    }
    
    console.log(chalk.white.bold('Active Mappings:'));
    for (const [domain, ports] of Object.entries(config.mappings)) {
      console.log(chalk.white(`  ${domain} `) + chalk.gray(`(→ ${config.loopbackIP})`));
      
      for (const [port, mapping] of Object.entries(ports)) {
        const protocol = mapping.ssl ? 'HTTPS' : 'HTTP';
        const sslNote = mapping.ssl ? ', SSL term' : '';
        console.log(chalk.gray(`    → ${port.padStart(4)} (${protocol}${sslNote})`) + chalk.white(` → ${mapping.target}`));
      }
    }
    
    console.log();
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to list mappings:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function removeCommand(url: string, options: RemoveCommandOptions = {}): Promise<void> {
  try {
    const config = await loadConfig();
    
    // Parse URL to extract domain and optional port
    let domain: string;
    let specificPort: number | null = null;
    
    // Check for explicit port
    const portMatch = url.match(/^([^:]+):(\d+)$/);
    if (portMatch) {
      domain = portMatch[1];
      specificPort = parseInt(portMatch[2]);
    } else {
      // Remove protocol if present
      domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // Check if it's https:// or http:// to determine port
      if (url.startsWith('https://')) {
        specificPort = 443;
      } else if (url.startsWith('http://')) {
        specificPort = 80;
      }
    }
    
    // Check if domain exists
    if (!config.mappings[domain]) {
      console.log(chalk.red('✗ No domain mapping found'));
      process.exitCode = 1;
      return;
    }
    
    // Remove specific port or all ports
    if (specificPort !== null) {
      if (!config.mappings[domain][specificPort]) {
        console.log(chalk.red('✗ No domain mapping found'));
        process.exitCode = 1;
        return;
      }
      
      delete config.mappings[domain][specificPort];
      if (options.verbose) {
        console.log(chalk.green(`✓ Removed mapping: ${domain}:${specificPort}`));
      }
      
      // If no ports remain, remove domain entirely
      if (Object.keys(config.mappings[domain]).length === 0) {
        delete config.mappings[domain];
        if (options.verbose) {
          console.log(chalk.gray(`  Removed domain: ${domain}`));
        }
      }
    } else {
      delete config.mappings[domain];
      if (options.verbose) {
        console.log(chalk.green(`✓ Removed all mappings for: ${domain}`));
      }
    }
    
    // Save config
    await saveConfig(config);
    
    // Regenerate Caddyfile and reload
    await generateCaddyfile(config);
    await reloadCaddy();
    
    console.log(chalk.green('✓ Domain mapping removed'));
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to remove mapping:'), error.message);

    // Provide helpful hint if service isn't running
    if (error.message.includes('not running')) {
      console.log(chalk.yellow('\n💡 Tip: Run'), chalk.cyan('halo start'), chalk.yellow('to start the Caddy service'));
    }

    process.exitCode = 1;
    return;
  }
}

export async function startCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Starting Halo service...'));
    
    // Regenerate Caddyfile before starting
    const config = await loadConfig();
    await generateCaddyfile(config);
    
    await startService();
    console.log(chalk.green('✓ Service started\n'));
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to start service:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function stopCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Stopping Halo service...'));
    await stopService();
    console.log(chalk.green('✓ Service stopped\n'));
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to stop service:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function restartCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Restarting Halo service...'));
    
    // Regenerate Caddyfile before restarting
    const config = await loadConfig();
    await generateCaddyfile(config);
    
    await restartService();
    console.log(chalk.green('✓ Service restarted\n'));
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to restart service:'), error.message);
    process.exitCode = 1;
    return;
  }
}


