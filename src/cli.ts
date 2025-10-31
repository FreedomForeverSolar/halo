#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { setupCommand } from './commands/setup';
import { addCommand } from './commands/add';
import { cleanupCommand } from './commands/cleanup';
import { 
  listCommand, 
  removeCommand, 
  startCommand, 
  stopCommand, 
  restartCommand
} from './commands/index';
import {
  addNamespaceCommand,
  removeNamespaceCommand,
  listNamespaceCommand,
  checkNamespaceCommand,
  fixNamespaceCommand
} from './commands/ns';
import { doctorCommand } from './commands/doctor';
import {
  dnsStartCommand,
  dnsStopCommand,
  dnsRestartCommand,
  dnsStatusCommand
} from './commands/dns';
import { version } from './version';

const program = new Command();

// Custom help formatter with categories
program.configureHelp({
  formatHelp: (cmd, helper) => {
    // Only use custom format for main command
    if (cmd.name() !== 'halo') {
      return helper.formatHelp(cmd, helper);
    }
    
    let output = '';
    
    // Header
    output += chalk.bold('\n🔵 Halo - Your local development guardian\n\n');
    output += chalk.white('Usage: ') + chalk.cyan('halo [command] [options]\n\n');
    
    // Get ns and dns subcommands
    const nsCommand = cmd.commands.find(c => c.name() === 'ns');
    const dnsCommand = cmd.commands.find(c => c.name() === 'dns');
    
    // Categories with subcommands
    const categories = [
      {
        title: 'Domain Routes',
        commands: [
          { name: 'add', description: 'Add a domain mapping' },
          { name: 'remove', description: 'Remove a domain mapping' },
          { name: 'list', alias: 'ls', description: 'List all domain mappings' }
        ]
      },
      {
        title: 'Namespaces',
        commands: [
          { name: 'ns add <namespace>', description: 'Register a new namespace' },
          { name: 'ns remove <namespace>', description: 'Unregister a namespace' },
          { name: 'ns list', alias: 'ns ls', description: 'List all registered namespaces' },
          { name: 'ns status <namespace>', description: 'Check namespace registration' },
          { name: 'ns fix <namespace>', description: 'Fix namespace issues' }
        ]
      },
      {
        title: 'Services',
        commands: [
          { name: 'start', description: 'Start the Halo service' },
          { name: 'stop', description: 'Stop the Halo service' },
          { name: 'restart', description: 'Restart the Halo service' },
          { name: 'doctor', description: 'Diagnose and fix common issues' }
        ]
      },
      {
        title: 'DNS',
        commands: [
          { name: 'dns start', description: 'Start dnsmasq service' },
          { name: 'dns stop', description: 'Stop dnsmasq service' },
          { name: 'dns restart', description: 'Restart dnsmasq service' },
          { name: 'dns status', description: 'Check DNS status' }
        ]
      },
      {
        title: 'Setup & Maintenance',
        commands: [
          { name: 'setup', description: 'Initial system setup (run once)' },
          { name: 'cleanup', description: 'Remove all Halo configuration' }
        ]
      }
    ];
    
    for (const category of categories) {
      output += chalk.white.bold(category.title) + ':\n';
      
      for (const command of category.commands) {
        const nameStr = command.alias ? `${command.name}, ${command.alias}` : command.name;
        output += chalk.cyan(`  ${nameStr.padEnd(30)}`) + chalk.gray(command.description) + '\n';
      }
      
      output += '\n';
    }
    
    // Options
    output += chalk.white.bold('Options:\n');
    output += chalk.cyan('  -h, --help         ') + chalk.gray('Display help for command\n');
    output += chalk.cyan('  -V, --version      ') + chalk.gray('Output version number\n');
    output += '\n';
    
    return output;
  }
});

program
  .name('halo')
  .description(chalk.bold('🔵 Halo - Your local development guardian'))
  .version(version);

// Setup command
program
  .command('setup')
  .description('Initial system setup (run once)')
  .action(async () => {
    await setupCommand();
  });

// Add command
program
  .command('add')
  .description('Add a domain mapping')
  .argument('<url>', 'Domain URL (portal.myapp, https://api.myapp, or portal.myapp:8443)')
  .argument('<target>', 'Target localhost address (e.g., localhost:3000)')
  .option('--ssl', 'Enable SSL termination for custom ports')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (url: string, target: string, options: { ssl?: boolean; verbose?: boolean }) => {
    await addCommand(url, target, options);
  });

// Remove command
program
  .command('remove')
  .description('Remove a domain mapping')
  .argument('<url>', 'Domain URL to remove (portal.myapp or portal.myapp:443)')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (url: string, options: { verbose?: boolean }) => {
    await removeCommand(url, options);
  });

// List command
program
  .command('list')
  .description('List all domain mappings')
  .alias('ls')
  .action(async () => {
    await listCommand();
  });

// Start command
program
  .command('start')
  .description('Start the Halo service')
  .action(async () => {
    await startCommand();
  });

// Stop command
program
  .command('stop')
  .description('Stop the Halo service')
  .action(async () => {
    await stopCommand();
  });

// Restart command
program
  .command('restart')
  .description('Restart the Halo service')
  .action(async () => {
    await restartCommand();
  });


// Doctor command
program
  .command('doctor')
  .description('Diagnose and fix common issues')
  .action(async () => {
    await doctorCommand();
  });

// Cleanup command
program
  .command('cleanup')
  .description('Remove all Halo configuration and system changes')
  .action(async () => {
    await cleanupCommand();
  });

// DNS command with subcommands
const dnsCommand = program
  .command('dns')
  .description('Manage DNS (dnsmasq)');

dnsCommand
  .command('start')
  .description('Start dnsmasq service')
  .action(async () => {
    await dnsStartCommand();
  });

dnsCommand
  .command('stop')
  .description('Stop dnsmasq service')
  .action(async () => {
    await dnsStopCommand();
  });

dnsCommand
  .command('restart')
  .description('Restart dnsmasq service')
  .action(async () => {
    await dnsRestartCommand();
  });

dnsCommand
  .command('status')
  .description('Check dnsmasq status and test DNS resolution')
  .action(async () => {
    await dnsStatusCommand();
  });

// Namespace command with subcommands
const nsCommand = program
  .command('ns')
  .description('Manage namespaces (custom TLDs)');

nsCommand
  .command('add')
  .description('Register a new namespace')
  .argument('<namespace>', 'Namespace to register (e.g., myapp, helios)')
  .action(async (namespace: string) => {
    await addNamespaceCommand(namespace);
  });

nsCommand
  .command('remove')
  .description('Unregister a namespace')
  .argument('<namespace>', 'Namespace to remove')
  .option('--force', 'Force removal even if domains exist')
  .action(async (namespace: string, options: { force?: boolean }) => {
    await removeNamespaceCommand(namespace, options);
  });

nsCommand
  .command('list')
  .description('List all registered namespaces')
  .alias('ls')
  .action(async () => {
    await listNamespaceCommand();
  });

nsCommand
  .command('status')
  .description('Check if a namespace is properly registered')
  .argument('<namespace>', 'Namespace to check')
  .action(async (namespace: string) => {
    await checkNamespaceCommand(namespace);
  });

nsCommand
  .command('fix')
  .description('Fix namespace configuration issues')
  .argument('<namespace>', 'Namespace to fix')
  .action(async (namespace: string) => {
    await fixNamespaceCommand(namespace);
  });

// Parse arguments
program.parse();
