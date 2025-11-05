import chalk from 'chalk';
import { execCommand, getHaloDir, getConfigPath } from '../utils';
import { removeService } from '../core/service';
import { removePFRules } from '../core/pf';
import { removeLoopbackAlias } from '../core/loopback';
import { loadConfig } from '../core/config';
import { unregisterTLD } from '../core/dns';
import { removeDnsmasqService } from '../core/dnsmasq-service';
import { existsSync } from 'fs';

export async function cleanupCommand(): Promise<void> {
  console.log(chalk.bold('\n🔵 Halo Cleanup\n'));
  console.log(chalk.yellow('⚠  This will remove all Halo configuration and system changes.'));
  console.log(chalk.yellow('   This requires sudo privileges.\n'));

  try {
    // 1. Stop and remove Caddy service
    console.log(chalk.blue('Removing Caddy service...'));
    try {
      await removeService();
      console.log(chalk.green('✓ Caddy service removed\n'));
    } catch (error: any) {
      console.log(chalk.gray('  (Service not found or already removed)\n'));
    }

    // 2. Remove PF rules
    console.log(chalk.blue('Removing port forwarding rules...'));
    try {
      await removePFRules();
      console.log(chalk.green('✓ Port forwarding rules removed\n'));
    } catch (error: any) {
      console.log(chalk.gray('  (Rules not found or already removed)\n'));
    }

    // 3. Remove dnsmasq service
    console.log(chalk.blue('Removing dnsmasq service...'));
    try {
      await removeDnsmasqService();
      console.log(chalk.green('✓ dnsmasq service removed\n'));
    } catch (error: any) {
      console.log(chalk.gray(`  (Service not found or already removed)\n`));
    }

    // 4. Remove dnsmasq entries and resolvers
    console.log(chalk.blue('Removing DNS configuration...'));
    try {
      await removeDNSConfiguration();
      console.log(chalk.green('✓ DNS configuration removed\n'));
    } catch (error: any) {
      console.log(chalk.gray(`  (DNS configuration not found or already removed)\n`));
    }

    // 5. Remove loopback alias
    console.log(chalk.blue('Removing loopback alias...'));
    try {
      await removeLoopbackAlias();
      console.log(chalk.green('✓ Loopback alias removed\n'));
    } catch (error: any) {
      console.log(chalk.gray('  (Loopback alias not found or already removed)\n'));
    }
    
    // 6. Remove .halo directory
    console.log(chalk.blue('Removing Halo directory...'));
    const haloDir = getHaloDir();
    if (existsSync(haloDir)) {
      const result = await execCommand(`rm -rf ${haloDir}`);
      if (!result.success) {
        throw new Error(`Failed to remove Halo directory: ${result.stderr}`);
      }
      console.log(chalk.green('✓ Halo directory removed\n'));
    } else {
      console.log(chalk.gray('  (Directory not found or already removed)\n'));
    }

    // Success message
    console.log(chalk.green.bold('✓ Cleanup complete!\n'));
    console.log(chalk.white('Halo has been completely removed from your system.\n'));

  } catch (error: any) {
    console.error(chalk.red('\n✗ Cleanup failed:'), error.message);
    process.exitCode = 1;
    return;
  }
}

async function removeDNSConfiguration(): Promise<void> {
  // Load config to get all configured TLDs
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return; // No config, nothing to clean up
  }

  const config = await loadConfig();
  const tlds = Object.keys(config.tlds).filter(tld => config.tlds[tld].dnsConfigured);

  if (tlds.length === 0) {
    return; // No TLDs configured
  }

  // Remove all registered TLDs
  for (const tld of tlds) {
    try {
      await unregisterTLD(tld);
    } catch (error) {
      // Continue with other TLDs if one fails
      console.log(chalk.gray(`  (Failed to remove .${tld})\n`));
    }
  }
}
