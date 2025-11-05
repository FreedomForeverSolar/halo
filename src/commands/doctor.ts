import chalk from 'chalk';
import { existsSync } from 'fs';
import { checkDependency, getConfigPath, getLaunchdPlistPath, execCommand, checkDnsmasqRunning, testDNSResolution, getDomainsForNamespace, testDomainRouting } from '../utils';
import { checkDnsmasqEntry } from '../core/dns';
import { loadConfig } from '../core/config';
import { getServiceStatus } from '../core/service';
import { checkPFRules } from '../core/pf';

export async function doctorCommand(): Promise<void> {
  console.log(chalk.bold('\n🔵 Halo Doctor\n'));
  
  let issuesFound = 0;
  const suggestions: string[] = [];
  
  try {
    // [1/4] Dependency Check
    console.log(chalk.white.bold('[1/4] Dependencies'));
    
    const dnsmasqInstalled = await checkDependency('dnsmasq');
    const caddyInstalled = await checkDependency('caddy');
    
    if (dnsmasqInstalled) {
      console.log(chalk.green('✓ DNS server installed'));
    } else {
      console.log(chalk.red('✗ DNS server not installed'));
      suggestions.push(`Install DNS server: ${chalk.cyan('brew install dnsmasq')}`);
      issuesFound++;
    }

    if (caddyInstalled) {
      console.log(chalk.green('✓ Proxy server installed'));
    } else {
      console.log(chalk.red('✗ Proxy server not installed'));
      suggestions.push(`Install proxy server: ${chalk.cyan('brew install caddy')}`);
      issuesFound++;
    }
    
    console.log();
    
    // [2/4] Setup Check
    console.log(chalk.white.bold('[2/4] Setup'));
    
    const configExists = existsSync(getConfigPath());
    const setupLoopbackResult = await execCommand('ifconfig lo0 | grep 127.0.0.10');
    const setupPfRulesOk = await checkPFRules();
    const caddyServiceExists = existsSync(getLaunchdPlistPath('caddy'));
    const dnsmasqServiceExists = existsSync(getLaunchdPlistPath('dnsmasq'));
    
    if (configExists) {
      console.log(chalk.green('✓ Config file exists'));
    } else {
      console.log(chalk.red('✗ Config file missing'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    if (setupLoopbackResult.success) {
      console.log(chalk.green('✓ Loopback alias (127.0.0.10)'));
    } else {
      console.log(chalk.red('✗ Loopback alias missing'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    if (setupPfRulesOk) {
      console.log(chalk.green('✓ PF rules configured'));
    } else {
      console.log(chalk.red('✗ PF rules not configured'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    if (caddyServiceExists) {
      console.log(chalk.green('✓ Proxy service installed'));
    } else {
      console.log(chalk.red('✗ Proxy service not installed'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    if (dnsmasqServiceExists) {
      console.log(chalk.green('✓ DNS service installed'));
    } else {
      console.log(chalk.red('✗ DNS service not installed'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    console.log();
    
    // If setup is incomplete, don't continue with other checks
    if (!configExists) {
      console.log(chalk.yellow.bold(`⚠  ${issuesFound} issue${issuesFound > 1 ? 's' : ''} found\n`));
      console.log(chalk.white('Suggestions:'));
      suggestions.forEach(s => console.log(chalk.gray('  → ') + s));
      console.log();
      process.exitCode = 1;
      return;
    }
    
    // [3/4] DNS Check
    console.log(chalk.white.bold('[3/4] DNS'));

    const config = await loadConfig();
    const tlds = Object.keys(config.tlds);

    if (tlds.length === 0) {
      console.log(chalk.gray('No namespaces configured yet'));
      console.log();
    } else {
      // Check if DNS service is running
      const dnsmasqRunning = await checkDnsmasqRunning();
      if (dnsmasqRunning) {
        console.log(chalk.green('✓ DNS service running'));
      } else {
        console.log(chalk.red('✗ DNS service not running'));
        suggestions.push(`Start DNS: ${chalk.cyan('halo dns start')}`);
        issuesFound++;
      }

      // Check each namespace
      console.log(chalk.white('Namespaces:'));

      for (const tld of tlds) {
        const namespaceIssues: string[] = [];
        let hasInfraIssues = false;

        // Check dnsmasq.conf entry
        const hasDnsmasqEntry = await checkDnsmasqEntry(tld);
        if (!hasDnsmasqEntry) {
          namespaceIssues.push('missing DNS config');
          hasInfraIssues = true;
        }

        // Check /etc/resolver file
        const resolverPath = `/etc/resolver/${tld}`;
        const hasResolver = existsSync(resolverPath);
        if (!hasResolver) {
          namespaceIssues.push('missing resolver');
          hasInfraIssues = true;
        }

        // Test DNS resolution
        let dnsResolves = false;
        if (dnsmasqRunning && !hasInfraIssues) {
          const testDomain = `test.${tld}`;
          dnsResolves = await testDNSResolution(testDomain);
          if (!dnsResolves) {
            namespaceIssues.push('DNS not resolving to Proxy');
          }
        }

        // Get domains for this namespace
        const domains = getDomainsForNamespace(config, tld);

        // Test domain routing if namespace DNS is working
        const routingIssues: string[] = [];
        if (dnsResolves && domains.length > 0) {
          for (const { domain, ports } of domains) {
            for (const port of ports) {
              const routes = await testDomainRouting(domain, port);
              if (!routes) {
                routingIssues.push(`${domain}${port !== 80 ? ':' + port : ''}`);
              }
            }
          }
        }

        // Display results for this namespace
        if (namespaceIssues.length === 0 && routingIssues.length === 0) {
          // All checks passed
          console.log(chalk.green(`  ✓ ${tld}: Healthy`));
        } else if (namespaceIssues.length > 0) {
          // DNS resolution or infrastructure issues
          console.log(chalk.red(`  ✗ ${tld}: ${namespaceIssues.join(', ')}`));
          suggestions.push(`Fix ${tld} namespace configuration: ${chalk.cyan(`halo ns fix ${tld}`)}`);
          issuesFound++;
        } else if (routingIssues.length > 0) {
          // Routing issues only
          const routeCount = routingIssues.length;
          const routeWord = routeCount === 1 ? 'route' : 'routes';
          console.log(chalk.red(`  ✗ ${tld}: ${routeCount} ${routeWord} not resolving correctly`));
          suggestions.push(`Check ${tld} namespace routing details: ${chalk.cyan(`halo ns status ${tld}`)}`);
          issuesFound++;
        }
      }

      console.log();
    }
    
    // [4/4] Proxy
    console.log(chalk.white.bold('[4/4] Proxy'));

    // Check Proxy service
    const caddyStatus = await getServiceStatus();
    if (caddyStatus.running) {
      console.log(chalk.green('✓ Proxy running') + chalk.gray(` (PID: ${caddyStatus.pid})`));
    } else {
      console.log(chalk.red('✗ Proxy not running'));
      suggestions.push(`Start Proxy: ${chalk.cyan('halo start')}`);
      issuesFound++;
    }
    
    console.log();
    
    // Summary
    if (issuesFound === 0) {
      console.log(chalk.green.bold('✓ All checks passed!\n'));
    } else {
      console.log(chalk.yellow.bold(`⚠  ${issuesFound} issue${issuesFound > 1 ? 's' : ''} found\n`));
      
      if (suggestions.length > 0) {
        console.log(chalk.white('Suggestions:'));
        suggestions.forEach(s => console.log(chalk.gray('  → ') + s));
        console.log();
      }

      process.exitCode = 1;
      return;
    }
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Doctor check failed:'), error.message);
    process.exitCode = 1;
    return;
  }
}
