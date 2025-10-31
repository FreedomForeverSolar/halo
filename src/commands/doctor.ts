import chalk from 'chalk';
import { existsSync } from 'fs';
import { checkDependency, getConfigPath, getLaunchdPlistPath, execCommand, checkDnsmasqRunning, testDNSResolution } from '../utils';
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
      console.log(chalk.green('✓ dnsmasq installed'));
    } else {
      console.log(chalk.red('✗ dnsmasq not installed'));
      suggestions.push(`Install dnsmasq: ${chalk.cyan('brew install dnsmasq')}`);
      issuesFound++;
    }
    
    if (caddyInstalled) {
      console.log(chalk.green('✓ caddy installed'));
    } else {
      console.log(chalk.red('✗ caddy not installed'));
      suggestions.push(`Install caddy: ${chalk.cyan('brew install caddy')}`);
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
      console.log(chalk.green('✓ Caddy service installed'));
    } else {
      console.log(chalk.red('✗ Caddy service not installed'));
      suggestions.push(`Run setup: ${chalk.cyan('halo setup')}`);
      issuesFound++;
    }
    
    if (dnsmasqServiceExists) {
      console.log(chalk.green('✓ dnsmasq service installed'));
    } else {
      console.log(chalk.red('✗ dnsmasq service not installed'));
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
      process.exit(1);
    }
    
    // [3/4] DNS Check
    console.log(chalk.white.bold('[3/4] DNS (dnsmasq)'));
    
    const config = await loadConfig();
    const tlds = Object.keys(config.tlds);
    
    if (tlds.length === 0) {
      console.log(chalk.gray('No namespaces configured yet'));
      console.log();
    } else {
      const tldsWithIssues: string[] = [];
      
      // Check all TLDs (read-only)
      for (const tld of tlds) {
        let tldHasIssues = false;
        
        // Check dnsmasq.conf entry
        const hasDnsmasqEntry = await checkDnsmasqEntry(tld);
        if (!hasDnsmasqEntry) {
          tldHasIssues = true;
        }
        
        // Check /etc/resolver file
        const resolverPath = `/etc/resolver/${tld}`;
        const hasResolver = existsSync(resolverPath);
        if (!hasResolver) {
          tldHasIssues = true;
        }
        
        if (tldHasIssues) {
          tldsWithIssues.push(tld);
        }
      }
      
      // Show condensed namespace setup status
      const tldCount = tlds.length;
      
      if (tldsWithIssues.length === 0) {
        console.log(chalk.green(`✓ ${tldCount} namespace${tldCount > 1 ? 's' : ''} configured`));
      } else {
        console.log(chalk.yellow(`⚠ ${tldsWithIssues.length} of ${tldCount} namespace${tldCount > 1 ? 's' : ''} ${tldsWithIssues.length > 1 ? 'have' : 'has'} configuration issues`));
        for (const tld of tldsWithIssues) {
          console.log(chalk.gray(`  → .${tld}`));
        }
        issuesFound += tldsWithIssues.length;
        
        // Add fix suggestions for each namespace
        for (const tld of tldsWithIssues) {
          suggestions.push(`Fix .${tld} configuration: ${chalk.cyan(`halo ns fix ${tld}`)}`);
        }
      }
      
      // Check if dnsmasq is running
      const dnsmasqRunning = await checkDnsmasqRunning();
      if (dnsmasqRunning) {
        console.log(chalk.green('✓ dnsmasq running'));
      } else {
        console.log(chalk.red('✗ dnsmasq not running'));
        suggestions.push(`Start dnsmasq: ${chalk.cyan('halo dns start')}`);
        issuesFound++;
      }
      
      // Test DNS resolution for all TLDs
      if (dnsmasqRunning) {
        let failedResolutions = 0;
        for (const tld of tlds) {
          const testDomain = `test.${tld}`;
          const resolves = await testDNSResolution(testDomain);
          if (!resolves) {
            failedResolutions++;
          }
        }
        
        if (failedResolutions === 0) {
          console.log(chalk.green('✓ DNS resolution tests'));
        } else {
          console.log(chalk.yellow(`⚠ ${failedResolutions} namespace${failedResolutions > 1 ? 's' : ''} failed resolution test`));
          suggestions.push(`Check namespace resolution: ${chalk.cyan('halo ns status <namespace>')}`);
          suggestions.push(`Restart dnsmasq: ${chalk.cyan('halo dns restart')}`);
          issuesFound++;
        }
      }
      
      console.log();
    }
    
    // [4/4] Loopback IP Setup & Caddy
    console.log(chalk.white.bold('[4/4] Caddy'));
    
    // Check Caddy service
    const caddyStatus = await getServiceStatus();
    if (caddyStatus.running) {
      console.log(chalk.green('✓ Caddy running') + chalk.gray(` (PID: ${caddyStatus.pid})`));
    } else {
      console.log(chalk.red('✗ Caddy not running'));
      suggestions.push(`Start Caddy: ${chalk.cyan('halo start')}`);
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
      
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(chalk.red('\n✗ Doctor check failed:'), error.message);
    process.exit(1);
  }
}
