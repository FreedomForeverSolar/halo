import { spawn } from 'bun';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const GITHUB_API_URL = 'https://api.github.com/repos/freedomforeversolar/halo/releases/latest';
const TIMEOUT_MS = 1000; // 1 second timeout

interface VersionCache {
  lastCheck: number;
  latestVersion: string;
  currentVersion: string;
}

function getCachePath(): string {
  return join(homedir(), '.halo', 'version-check.json');
}

async function ensureCacheDirectory(): Promise<void> {
  const cacheDir = join(homedir(), '.halo');
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
}

async function readCache(): Promise<VersionCache | null> {
  try {
    const cachePath = getCachePath();
    if (!existsSync(cachePath)) {
      return null;
    }
    const data = await readFile(cachePath, 'utf-8');
    return JSON.parse(data) as VersionCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: VersionCache): Promise<void> {
  try {
    await ensureCacheDirectory();
    const cachePath = getCachePath();
    await writeFile(cachePath, JSON.stringify(cache, null, 2));
  } catch {
    // Silent failure - cache write is not critical
  }
}

function shouldCheck(cache: VersionCache | null): boolean {
  if (!cache) return true;
  const now = Date.now();
  return now - cache.lastCheck > CACHE_DURATION;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const version = data.tag_name?.replace(/^v/, ''); // Remove 'v' prefix if present
    return version || null;
  } catch {
    return null;
  }
}

export async function checkForUpdatesBackground(currentVersion: string): Promise<void> {
  // Skip in CI environments
  if (process.env.CI) {
    return;
  }

  try {
    const cache = await readCache();

    // Only spawn background check if cache is stale
    if (!shouldCheck(cache)) {
      return;
    }

    // Spawn detached background process to check for updates
    spawn({
      cmd: [process.argv[0], '-e', `
        (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ${TIMEOUT_MS});

            const response = await fetch('${GITHUB_API_URL}', {
              signal: controller.signal,
              headers: { 'Accept': 'application/vnd.github.v3+json' },
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              const latestVersion = data.tag_name?.replace(/^v/, '');

              if (latestVersion) {
                const fs = await import('fs/promises');
                const path = await import('path');
                const os = await import('os');

                const cacheDir = path.join(os.homedir(), '.halo');
                const cachePath = path.join(cacheDir, 'version-check.json');

                // Ensure directory exists
                await fs.mkdir(cacheDir, { recursive: true });

                const cache = {
                  lastCheck: Date.now(),
                  latestVersion,
                  currentVersion: '${currentVersion}'
                };

                await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
              }
            }
          } catch {}
        })();
      `],
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
      detached: true,
    });
  } catch {
    // Silent failure - version check is not critical
  }
}

export async function displayUpdateNotice(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();

    if (!cache || !cache.latestVersion) {
      return;
    }

    // Compare versions
    if (cache.latestVersion !== currentVersion && isNewerVersion(cache.latestVersion, currentVersion)) {
      console.log(); // Empty line for spacing
      console.log(
        chalk.cyan(`Current version: ${currentVersion}`) +
        chalk.gray(' | ') +
        chalk.yellow(`Latest version: ${cache.latestVersion}`)
      );
      console.log(chalk.gray('Update with: ') + chalk.white('brew update && brew upgrade freedomforeversolar/tools/halo'));
    }
  } catch {
    // Silent failure - display is not critical
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);

  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;

    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}
