import type { ParsedURL, AddCommandOptions } from '../types';
import { extractTLD } from '../utils';

export function parseURL(input: string, options?: AddCommandOptions): ParsedURL {
  // Format 3a: Explicit port with protocol
  // https://portal.helios:8443 or http://portal.helios:8080
  const protocolPortMatch = input.match(/^(https?):\/\/([^:\/]+):(\d+)/);
  if (protocolPortMatch) {
    const [, protocol, domain] = protocolPortMatch;
    const port = parseInt(protocolPortMatch[3]);
    return {
      domain,
      ports: [{
        port,
        ssl: protocol === 'https'
      }],
      tld: extractTLD(domain)
    };
  }
  
  // Format 3b: Explicit port without protocol (requires --ssl flag)
  // portal.helios:8443 --ssl
  if (/^[^:\/]+:\d+$/.test(input)) {
    const [domain, portStr] = input.split(':');
    return {
      domain,
      ports: [{
        port: parseInt(portStr),
        ssl: options?.ssl ?? false
      }],
      tld: extractTLD(domain)
    };
  }
  
  // Format 2: Protocol specified (standard ports)
  if (input.startsWith('http://')) {
    const domain = input.replace('http://', '').replace(/\/$/, '');
    return {
      domain,
      ports: [{ port: 80, ssl: false }],
      tld: extractTLD(domain)
    };
  }
  
  if (input.startsWith('https://')) {
    const domain = input.replace('https://', '').replace(/\/$/, '');
    return {
      domain,
      ports: [{ port: 443, ssl: true }],
      tld: extractTLD(domain)
    };
  }
  
  // Format 1: Plain domain (both standard ports)
  return {
    domain: input,
    ports: [
      { port: 80, ssl: false },
      { port: 443, ssl: true }
    ],
    tld: extractTLD(input)
  };
}
