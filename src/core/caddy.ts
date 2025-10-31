import { writeFile } from 'fs/promises';
import { execCommand, getCaddyfilePath } from '../utils';
import type { Config } from '../types';

export async function generateCaddyfile(config: Config): Promise<void> {
  const lines: string[] = [
    '{',
    '  admin localhost:2019',
    '  auto_https disable_redirects',
    '  local_certs',
    `  http_port ${config.httpPort}`,
    `  https_port ${config.httpsPort}`,
    '}',
    ''
  ];
  
  // Iterate through all mappings
  for (const [domain, ports] of Object.entries(config.mappings)) {
    for (const [port, mapping] of Object.entries(ports)) {
      const portNum = parseInt(port);
      const protocol = mapping.ssl ? 'https' : 'http';
      const tld = domain.split('.').pop() || '';
      
      // Determine if this is a standard port (80 for HTTP, 443 for HTTPS)
      const isStandardPort = (portNum === 80 && !mapping.ssl) || (portNum === 443 && mapping.ssl);
      
      // Add comment
      const sslNote = mapping.ssl ? ' (SSL termination) → HTTP → ' : ' → ';
      const actualPort = mapping.ssl ? config.httpsPort : config.httpPort;
      lines.push(`# ${domain}:${port} → ${protocol.toUpperCase()} (Caddy listens on ${actualPort})${sslNote}${mapping.target}`);
      
      // Add server block - don't specify port, let Caddy use the global http_port/https_port
      // Only add port if it's non-standard
      if (isStandardPort) {
        lines.push(`${protocol}://${domain} {`);
      } else {
        lines.push(`${protocol}://${domain}:${port} {`);
      }
      lines.push(`  bind ${config.loopbackIP}`);
      
      // Add reverse proxy
      lines.push(`  reverse_proxy ${mapping.target}`);
      lines.push('}');
      lines.push('');
    }
  }
  
  const caddyfilePath = getCaddyfilePath();
  await writeFile(caddyfilePath, lines.join('\n'), 'utf-8');
}

export async function reloadCaddy(): Promise<void> {
  // Check if Caddy is running first
  const running = await isCaddyRunning();
  if (!running) {
    throw new Error(
      'Caddy service is not running. Start it with: halo start'
    );
  }
  
  // Validate Caddyfile first
  const validateResult = await execCommand(`caddy validate --config ${getCaddyfilePath()}`);
  
  if (!validateResult.success) {
    throw new Error(`Invalid Caddyfile: ${validateResult.stderr}`);
  }
  
  // Reload via API using caddy reload command
  const reloadResult = await execCommand(`caddy reload --config ${getCaddyfilePath()} --adapter caddyfile`);
  
  if (!reloadResult.success) {
    throw new Error(
      `Failed to reload Caddy via API: ${reloadResult.stderr}. ` +
      `Try restarting the service with: halo restart`
    );
  }
}

export async function validateCaddyfile(): Promise<boolean> {
  const result = await execCommand(`caddy validate --config ${getCaddyfilePath()}`);
  return result.success;
}

export async function isCaddyRunning(): Promise<boolean> {
  const result = await execCommand('curl -s http://localhost:2019/config/ > /dev/null');
  return result.success;
}
