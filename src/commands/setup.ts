import chalk from 'chalk';
import { checkDependency, ensureHaloDir, checkDnsmasqRunning } from '../utils';
import { initializeConfig, loadConfig } from '../core/config';
import { setupLoopbackAlias } from '../core/loopback';
import { createCaddyService, startService } from '../core/service';
import { setupPFRules } from '../core/pf';
import { execCommand } from '../utils';
import { generateCaddyfile } from '../core/caddy';
import {
  createDnsmasqConfig,
  createDnsmasqService,
  startDnsmasqService,
  restartDnsmasqService
} from '../core/dnsmasq-service';

export async function setupCommand(): Promise<void> {
  console.log(chalk.bold('\n🔵 Halo Setup\n'));
  
  // Inform user about sudo requirement upfront
  console.log(chalk.yellow('⚠  This setup requires sudo privileges to:'));
  console.log(chalk.gray('   - Create loopback alias (127.0.0.10)'));
  console.log(chalk.gray('   - Configure port forwarding (PF) rules'));
  console.log(chalk.gray('   - Create DNS resolver files'));
  console.log(chalk.gray('   - Trust Caddy CA certificate\n'));
  
  try {
    // 1. Check dependencies
    console.log(chalk.blue('Checking dependencies...'));
    await checkDependencies();
    console.log(chalk.green('✓ All dependencies installed\n'));
    
    // 2. Create halo directory
    console.log(chalk.blue('Creating Halo directory...'));
    await ensureHaloDir();
    console.log(chalk.green('✓ Directory created\n'));
    
    // 3. Setup loopback alias
    console.log(chalk.blue('Setting up loopback alias (127.0.0.10)...'));
    await setupLoopbackAlias();
    console.log(chalk.green('✓ Loopback alias configured\n'));
    
    
    // 4. Create dnsmasq configuration
    console.log(chalk.blue('Creating dnsmasq configuration...'));
    await createDnsmasqConfig();
    console.log(chalk.green('✓ dnsmasq config created\n'));
    
    // 5. Create and restart halo dnsmasq service
    console.log(chalk.blue('Setting up halo dnsmasq service...'));
    await createDnsmasqService();
    await restartDnsmasqService();
    console.log(chalk.green('✓ dnsmasq service restarted\n'));
    
    // 6. Initialize config
    console.log(chalk.blue('Initializing configuration...'));
    await initializeConfig();
    console.log(chalk.green('✓ Configuration initialized\n'));

    // 7. Setup PF port forwarding
    console.log(chalk.blue('Configuring port forwarding (80→8080, 443→8443)...'));
    const config = await loadConfig();
    await setupPFRules(config.loopbackIP, config.httpPort, config.httpsPort);
    console.log(chalk.green('✓ Port forwarding configured\n'));

    // 8. Generate initial Caddyfile
    console.log(chalk.blue('Creating Caddyfile...'));
    await generateCaddyfile(config);
    console.log(chalk.green('✓ Caddyfile created\n'));

    // 9. Create Caddy service
    console.log(chalk.blue('Creating Caddy service...'));
    await createCaddyService();
    console.log(chalk.green('✓ Caddy service created\n'));

    // 10. Start Caddy
    console.log(chalk.blue('Starting Caddy service...'));
    await startService();
    console.log(chalk.green('✓ Caddy service started\n'));

    // 11. Trust Caddy CA
    console.log(chalk.blue('Installing Caddy CA certificate...'));
    await trustCaddyCA();
    console.log(chalk.green('✓ Caddy CA trusted\n'));
    
    // Success message
    console.log(chalk.green.bold('✓ Setup complete!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray('  1. Add a domain:') + ' halo add portal.myapp localhost:3000');
    console.log(chalk.gray('  2. Access:') + ' https://portal.myapp\n');
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Setup failed:'), error.message);
    process.exitCode = 1;
    return;
  }
}

async function checkDependencies(): Promise<void> {
  const deps = [
    { name: 'dnsmasq', required: true },
    { name: 'caddy', required: true }
  ];
  
  for (const dep of deps) {
    const installed = await checkDependency(dep.name);
    
    if (!installed) {
      console.error(chalk.red(`✗ ${dep.name} is not installed`));
      console.log(chalk.yellow(`  Install with: brew install ${dep.name}`));
      throw new Error(`Missing dependency: ${dep.name}`);
    }
  }
}


async function trustCaddyCA(): Promise<void> {
  // Wait for Caddy to be fully ready (max 10 seconds)
  const maxRetries = 20;
  const delayMs = 500;
  
  for (let i = 0; i < maxRetries; i++) {
    const checkResult = await execCommand('curl -s http://localhost:2019/config/ > /dev/null 2>&1');
    
    if (checkResult.success) {
      // Caddy is ready, now trust the CA
      const result = await execCommand('sudo caddy trust --address localhost:2019');
      
      if (!result.success) {
        throw new Error(`Failed to trust Caddy CA: ${result.stderr}`);
      }
      return;
    }
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Caddy did not start within 10 seconds. Try running: sudo caddy trust --address localhost:2019');
}
