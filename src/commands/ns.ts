import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config';
import { registerTLD, unregisterTLD, checkTLDRegistration, testDNSResolution } from '../core/dns';
import { getDomainsForNamespace, testDomainRouting } from '../utils';

export async function addNamespaceCommand(tld: string): Promise<void> {
  try {
    console.log(chalk.blue(`\nRegistering namespace: .${tld}...\n`));
    
    // Load config
    const config = await loadConfig();
    
    // Check if already registered
    if (config.tlds[tld]?.dnsConfigured) {
      console.log(chalk.yellow(`⚠  Namespace .${tld} is already registered\n`));
      return;
    }
    
    // Register DNS (requires sudo)
    console.log(chalk.blue('Configuring DNS...'));
    await registerTLD(tld);
    console.log(chalk.green('✓ DNS configured'));
    
    // Update config
    if (!config.tlds[tld]) {
      config.tlds[tld] = {
        dnsConfigured: false
      };
    }
    config.tlds[tld].dnsConfigured = true;
    await saveConfig(config);
    
    // Success
    console.log(chalk.green.bold(`\n✓ Namespace .${tld} registered!\n`));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray('  Add a domain:') + ` halo add portal.${tld} localhost:3000\n`);
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Failed to register namespace:'), error.message);
    process.exit(1);
  }
}

export async function removeNamespaceCommand(tld: string, options: { force?: boolean } = {}): Promise<void> {
  try {
    console.log(chalk.blue(`\nRemoving namespace: .${tld}...\n`));
    
    // Load config
    const config = await loadConfig();
    
    // Check if TLD exists
    if (!config.tlds[tld]?.dnsConfigured) {
      console.log(chalk.yellow(`⚠  Namespace .${tld} is not registered\n`));
      return;
    }
    
    // Check if any domains are using this TLD
    const domainsUsingTLD: string[] = [];
    for (const domain of Object.keys(config.mappings)) {
      const domainTld = domain.split('.').pop();
      if (domainTld === tld) {
        domainsUsingTLD.push(domain);
      }
    }
    
    if (domainsUsingTLD.length > 0 && !options.force) {
      console.error(chalk.red('✗ Cannot remove namespace - domains are still using it:\n'));
      for (const domain of domainsUsingTLD) {
        console.log(chalk.gray(`  → ${domain}`));
      }
      console.log(chalk.yellow('\nRemove these domains first:'));
      for (const domain of domainsUsingTLD) {
        console.log(chalk.cyan(`  halo remove ${domain}`));
      }
      console.log();
      process.exit(1);
    }
    
    // Unregister DNS (requires sudo)
    console.log(chalk.blue('Removing DNS configuration...'));
    await unregisterTLD(tld);
    console.log(chalk.green('✓ DNS removed'));
    
    // Remove from config
    delete config.tlds[tld];
    await saveConfig(config);
    
    // Success
    console.log(chalk.green.bold(`\n✓ Namespace .${tld} removed!\n`));
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Failed to remove namespace:'), error.message);
    process.exit(1);
  }
}

export async function listNamespaceCommand(): Promise<void> {
  try {
    const config = await loadConfig();
    
    console.log(chalk.bold('\n🔵 Registered Namespaces\n'));
    
    const registeredTLDs = Object.entries(config.tlds)
      .filter(([_, tldConfig]) => tldConfig.dnsConfigured);
    
    if (registeredTLDs.length === 0) {
      console.log(chalk.gray('  No namespaces registered yet\n'));
      console.log(chalk.white('  Register one with:'), chalk.cyan('halo ns add myapp\n'));
      return;
    }
    
    for (const [tld, _] of registeredTLDs) {
      // Count domains using this TLD
      const domainCount = Object.keys(config.mappings).filter(domain => {
        const domainTld = domain.split('.').pop();
        return domainTld === tld;
      }).length;
      
      const countText = domainCount === 0 
        ? chalk.gray('(0 domains)')
        : chalk.white(`(${domainCount} domain${domainCount > 1 ? 's' : ''})`);
      
      console.log(chalk.white(`  → .${tld}`), countText);
    }
    
    console.log();
    
  } catch (error: any) {
    console.error(chalk.red('✗ Failed to list namespaces:'), error.message);
    process.exit(1);
  }
}

export async function checkNamespaceCommand(tld: string): Promise<void> {
  try {
    console.log(chalk.blue(`\nChecking namespace: .${tld}...\n`));

    // Load config
    const config = await loadConfig();

    // Check config
    const inConfig = config.tlds[tld]?.dnsConfigured === true;

    if (!inConfig) {
      console.log(chalk.red('✗ Namespace not registered\n'));
      console.log(chalk.yellow('Run:'), chalk.cyan(`halo ns add ${tld}\n`));
      process.exit(1);
    }

    let hasIssues = false;

    // Check DNS configuration
    const dnsConfigured = await checkTLDRegistration(tld);

    // Test DNS resolution
    let resolved = false;
    if (dnsConfigured) {
      const testDomain = `test.${tld}`;
      resolved = await testDNSResolution(testDomain);
    }

    // Show namespace DNS status
    if (resolved) {
      console.log(chalk.green('Namespace DNS: ✓ Resolving to Halo'));
    } else {
      console.log(chalk.red('Namespace DNS: ✗ Not resolving to Halo'));
      hasIssues = true;
    }

    // Get domains for this namespace
    const domains = getDomainsForNamespace(config, tld);

    // Test domain routing if DNS is working
    if (resolved) {
      if (domains.length === 0) {
        console.log(chalk.gray('Domain Routes: ℹ No domains configured'));
      } else {
        console.log(chalk.white('Domain Routes:'));
        let routingIssues = 0;

        for (const { domain, ports } of domains) {
          for (const port of ports) {
            const routes = await testDomainRouting(domain, port);
            const portStr = port !== 80 ? `:${port}` : '';
            const target = config.mappings[domain][port].target;

            if (routes) {
              console.log(chalk.green(`  ✓ ${domain}${portStr} → ${target}`));
            } else {
              console.log(chalk.red(`  ✗ ${domain}${portStr} → ${target}`));
              routingIssues++;
              hasIssues = true;
            }
          }
        }

        if (routingIssues > 0) {
          console.log(chalk.yellow(`\n⚠ ${routingIssues} domain${routingIssues > 1 ? 's' : ''} not routing properly`));
        }
      }
    }

    // Summary
    console.log();
    if (!hasIssues) {
      console.log(chalk.green.bold('✓ Namespace is healthy\n'));
      process.exit(0);
    } else {
      console.log(chalk.yellow.bold('⚠ Namespace has issues\n'));
      if (!dnsConfigured || !resolved) {
        console.log(chalk.yellow('Run:'), chalk.cyan(`halo ns fix ${tld}\n`));
        console.log(chalk.yellow('Or try:'), chalk.cyan(`halo dns restart\n`));
      } else {
        console.log(chalk.yellow('Try:'), chalk.cyan('halo restart\n'));
      }
      process.exit(1);
    }

  } catch (error: any) {
    console.error(chalk.red('\n✗ Failed to check namespace:'), error.message);
    process.exit(1);
  }
}

export async function fixNamespaceCommand(tld: string): Promise<void> {
  try {
    console.log(chalk.blue(`\nFixing namespace configuration: .${tld}...\n`));
    
    // Load config
    const config = await loadConfig();
    
    // Check if TLD is registered in config
    if (!config.tlds[tld]?.dnsConfigured) {
      console.log(chalk.red('✗ Namespace is not registered in Halo config'));
      console.log(chalk.yellow('\nRegister it first:'), chalk.cyan(`halo ns add ${tld}\n`));
      process.exit(1);
    }
    
    // Import DNS functions
    const { checkDnsmasqEntry, addDnsmasqEntry, createResolver, restartDnsmasq, flushDNSCache } = await import('../core/dns');
    const { existsSync } = await import('fs');
    
    let fixedIssues = 0;
    let needsRestart = false;
    
    // Check and fix dnsmasq.conf entry
    const hasDnsmasqEntry = await checkDnsmasqEntry(tld);
    if (!hasDnsmasqEntry) {
      console.log(chalk.blue('Adding dnsmasq.conf entry...'));
      await addDnsmasqEntry(tld);
      console.log(chalk.green('✓ dnsmasq.conf entry added'));
      fixedIssues++;
      needsRestart = true;
    } else {
      console.log(chalk.green('✓ dnsmasq.conf entry exists'));
    }
    
    // Check and fix /etc/resolver file
    const resolverPath = `/etc/resolver/${tld}`;
    const hasResolver = existsSync(resolverPath);
    if (!hasResolver) {
      console.log(chalk.blue('Creating /etc/resolver file...'));
      await createResolver(tld);
      console.log(chalk.green('✓ /etc/resolver file created'));
      fixedIssues++;
      needsRestart = true;
    } else {
      console.log(chalk.green('✓ /etc/resolver file exists'));
    }
    
    // Restart dnsmasq if needed
    if (needsRestart) {
      console.log(chalk.blue('\nRestarting dnsmasq...'));
      await restartDnsmasq();
      console.log(chalk.green('✓ dnsmasq restarted'));
      
      console.log(chalk.blue('Flushing DNS cache...'));
      await flushDNSCache();
      console.log(chalk.green('✓ DNS cache flushed'));
    }
    
    // Summary
    console.log();
    if (fixedIssues > 0) {
      console.log(chalk.green.bold(`✓ Fixed ${fixedIssues} issue${fixedIssues > 1 ? 's' : ''} for .${tld}\n`));
    } else {
      console.log(chalk.green.bold(`✓ No issues found - .${tld} is properly configured\n`));
    }
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Failed to fix namespace:'), error.message);
    process.exit(1);
  }
}
