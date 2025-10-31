import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config';
import { parseURL } from '../core/url-parser';
import { isValidTarget } from '../utils';
import { generateCaddyfile, reloadCaddy } from '../core/caddy';
import type { AddCommandOptions } from '../types';

export async function addCommand(url: string, target: string, options: AddCommandOptions = {}): Promise<void> {
  try {
    // 1. Validate target
    if (!isValidTarget(target)) {
      console.error(chalk.red('✗ Invalid target format'));
      console.log(chalk.yellow('  Expected format: localhost:port or IP:port'));
      console.log(chalk.yellow('  Example: localhost:3000'));
      process.exit(1);
    }
    
    // 2. Parse URL
    const parsed = parseURL(url, options);
    if (options.verbose) {
      console.log();
    }
    
    // 3. Load config
    const config = await loadConfig();
    
    // 4. Check if namespace is registered
    if (!config.tlds[parsed.tld]?.dnsConfigured) {
      console.error(chalk.red(`\n✗ Namespace '.${parsed.tld}' is not registered\n`));
      console.log(chalk.yellow('Register it first with:'), chalk.cyan(`halo ns add ${parsed.tld}`));
      console.log();
      process.exit(1);
    }
    
    // 5. Update config with mappings
    if (!config.mappings[parsed.domain]) {
      config.mappings[parsed.domain] = {};
    }
    
    for (const portConfig of parsed.ports) {
      config.mappings[parsed.domain][portConfig.port] = {
        target,
        ssl: portConfig.ssl,
        protocol: portConfig.ssl ? 'https' : 'http'
      };
    }
    
    await saveConfig(config);
    
    // 6. Regenerate Caddyfile
    if (options.verbose) {
      console.log(chalk.blue('Configuring Caddy...'));
    }
    await generateCaddyfile(config);
    
    // 7. Reload Caddy
    await reloadCaddy();
    if (options.verbose) {
      console.log(chalk.green('✓ Caddy configured'));
    }
    
    // 10. Display success
    console.log(chalk.green.bold('\n✓ Domain mapping added!\n'));
    console.log(chalk.white('Configuration:'));
    
    for (const portConfig of parsed.ports) {
      const protocol = portConfig.ssl ? 'HTTPS' : 'HTTP';
      const sslNote = portConfig.ssl ? ' (SSL termination → HTTP)' : '';
      console.log(chalk.gray(`  - ${protocol.toLowerCase()}://${parsed.domain}:${portConfig.port} (${config.loopbackIP}:${portConfig.port})${sslNote} → ${target}`));
    }
    
    console.log(chalk.white('\nAccess your app at:'));
    for (const portConfig of parsed.ports) {
      const protocol = portConfig.ssl ? 'https' : 'http';
      const portDisplay = (portConfig.port === 80 || portConfig.port === 443) ? '' : `:${portConfig.port}`;
      console.log(chalk.cyan(`  ${protocol}://${parsed.domain}${portDisplay}`));
    }
    console.log();
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Failed to add mapping:'), error.message);
    
    // Provide helpful hint if service isn't running
    if (error.message.includes('not running')) {
      console.log(chalk.yellow('\n💡 Tip: Run'), chalk.cyan('halo start'), chalk.yellow('to start the Caddy service'));
    }
    
    process.exit(1);
  }
}
