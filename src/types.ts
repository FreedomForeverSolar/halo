export interface Config {
  version: string;
  loopbackIP: string;
  httpPort: number;
  httpsPort: number;
  mappings: {
    [domain: string]: {
      [port: number]: PortMapping;
    };
  };
  tlds: {
    [tld: string]: TLDConfig;
  };
}

export interface PortMapping {
  target: string;
  ssl: boolean;
  protocol: 'http' | 'https';
}

export interface TLDConfig {
  dnsConfigured: boolean;
}

export interface ParsedURL {
  domain: string;
  ports: PortConfig[];
  tld: string;
}

export interface PortConfig {
  port: number;
  ssl: boolean;
}

export interface AddCommandOptions {
  ssl?: boolean;
  verbose?: boolean;
}

export interface RemoveCommandOptions {
  verbose?: boolean;
}
