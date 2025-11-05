import chalk from 'chalk';
import { checkDnsmasqRunning, testDNSResolution } from '../utils';
import { flushDNSCache } from '../core/dns';
import { loadConfig } from '../core/config';
import {
  startDnsmasqService,
  stopDnsmasqService,
  restartDnsmasqService
} from '../core/dnsmasq-service';

export async function dnsStartCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Starting dnsmasq...'));
    
    // Check if already running
    const isRunning = await checkDnsmasqRunning();
    if (isRunning) {
      console.log(chalk.yellow('⚠  dnsmasq is already running'));
      return;
    }
    
    // Start dnsmasq service
    await startDnsmasqService();
    
    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify it started
    const isNowRunning = await checkDnsmasqRunning();
    if (!isNowRunning) {
      throw new Error('dnsmasq failed to start');
    }
    
    // Flush DNS cache
    await flushDNSCache();
    
    console.log(chalk.green('✓ dnsmasq started\n'));
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to start dnsmasq:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function dnsStopCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Stopping dnsmasq...'));
    
    // Check if running
    const isRunning = await checkDnsmasqRunning();
    if (!isRunning) {
      console.log(chalk.yellow('⚠  dnsmasq is not running'));
      return;
    }
    
    // Stop dnsmasq service
    await stopDnsmasqService();
    
    console.log(chalk.green('✓ dnsmasq stopped\n'));
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to stop dnsmasq:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function dnsRestartCommand(): Promise<void> {
  try {
    console.log(chalk.blue('Restarting dnsmasq...'));
    
    // Restart dnsmasq service
    await restartDnsmasqService();
    
    // Wait for service to restart
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify it's running
    const isRunning = await checkDnsmasqRunning();
    if (!isRunning) {
      throw new Error('dnsmasq failed to restart');
    }
    
    // Flush DNS cache
    await flushDNSCache();
    
    console.log(chalk.green('✓ dnsmasq restarted\n'));
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to restart dnsmasq:'), error.message);
    process.exitCode = 1;
    return;
  }
}

export async function dnsStatusCommand(): Promise<void> {
  try {
    console.log(chalk.bold('\n🔵 DNS Status\n'));
    
    // Check if dnsmasq is running
    const isRunning = await checkDnsmasqRunning();
    const statusText = isRunning 
      ? chalk.green('✓ Running') 
      : chalk.red('✗ Stopped');
    console.log(chalk.gray('dnsmasq:'), statusText);
    
    if (!isRunning) {
      console.log(chalk.yellow('\n💡 Start with:'), chalk.cyan('halo dns start\n'));
      return;
    }
    
    // Load config to get namespaces
    const config = await loadConfig();
    const tlds = Object.keys(config.tlds);
    
    if (tlds.length === 0) {
      console.log(chalk.gray('\nNo namespaces configured yet\n'));
      return;
    }
    
    // Test all TLDs and count issues
    let failedCount = 0;
    for (const tld of tlds) {
      const testDomain = `test.${tld}`;
      const resolves = await testDNSResolution(testDomain);
      if (!resolves) {
        failedCount++;
      }
    }
    
    // Show condensed namespace setup status
    const tldCount = tlds.length;
    const tldStatus = failedCount === 0
      ? chalk.green(`✓ ${tldCount} namespace${tldCount > 1 ? 's' : ''} configured`)
      : chalk.yellow(`⚠ ${tldCount} namespace${tldCount > 1 ? 's' : ''} configured (${failedCount} with resolution issues)`);
    
    console.log(chalk.gray('\nNamespaces:'), tldStatus);
    
    // Show feedback if there are issues
    if (failedCount > 0) {
      console.log(chalk.yellow('\n💡 To see which namespaces have issues:'), chalk.cyan('halo ns list'));
      console.log(chalk.yellow('   To check a specific namespace:'), chalk.cyan('halo ns status <namespace>'));
    }
    
    console.log();
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to check DNS status:'), error.message);
    process.exitCode = 1;
    return;
  }
}
