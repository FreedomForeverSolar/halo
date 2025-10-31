import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Config } from '../types';
import { getConfigPath, ensureHaloDir } from '../utils';

const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  loopbackIP: '127.0.0.10',
  httpPort: 8080,
  httpsPort: 8443,
  mappings: {},
  tlds: {}
};

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  
  try {
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    // Migrate old configs that don't have httpPort/httpsPort
    if (!config.httpPort) {
      config.httpPort = DEFAULT_CONFIG.httpPort;
    }
    if (!config.httpsPort) {
      config.httpsPort = DEFAULT_CONFIG.httpsPort;
    }
    
    return config;
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureHaloDir();
  const configPath = getConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function initializeConfig(): Promise<void> {
  const configPath = getConfigPath();
  
  if (existsSync(configPath)) {
    console.log('✓ Config already exists');
    return;
  }
  
  await saveConfig(DEFAULT_CONFIG);
  console.log('✓ Config initialized');
}
