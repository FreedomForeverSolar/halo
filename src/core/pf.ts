import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { execCommand } from '../utils';

const PF_ANCHOR_NAME = 'com.halo';
const PF_ANCHOR_PATH = `/etc/pf.anchors/${PF_ANCHOR_NAME}`;
const PF_CONF_PATH = '/etc/pf.conf';

export async function setupPFRules(loopbackIP: string, httpPort: number, httpsPort: number): Promise<void> {
  // Create PF anchor file with port forwarding rules
  const anchorContent = `# Halo port forwarding rules
# Forward privileged ports to high ports for Caddy
rdr pass on lo0 inet proto tcp from any to ${loopbackIP} port 80 -> ${loopbackIP} port ${httpPort}
rdr pass on lo0 inet proto tcp from any to ${loopbackIP} port 443 -> ${loopbackIP} port ${httpsPort}
`;
  
  // Write anchor file to temp location first
  const tempPath = `/tmp/${PF_ANCHOR_NAME}`;
  await writeFile(tempPath, anchorContent, 'utf-8');
  
  // Move to system location with sudo
  const moveResult = await execCommand(`sudo mv ${tempPath} ${PF_ANCHOR_PATH}`);
  if (!moveResult.success) {
    throw new Error(`Failed to create PF anchor file: ${moveResult.stderr}`);
  }
  
  // Set proper permissions
  await execCommand(`sudo chown root:wheel ${PF_ANCHOR_PATH}`);
  await execCommand(`sudo chmod 644 ${PF_ANCHOR_PATH}`);
  
  // Update pf.conf to include our anchor
  await updatePFConf();
  
  // Enable and load PF rules
  await enablePF();
}

async function updatePFConf(): Promise<void> {
  // Check if our anchor is already in pf.conf
  const checkResult = await execCommand(`grep -q "${PF_ANCHOR_NAME}" ${PF_CONF_PATH}`);
  
  if (checkResult.success) {
    // Already configured
    return;
  }
  
  // Read current pf.conf
  let pfConfContent = '';
  if (existsSync(PF_CONF_PATH)) {
    pfConfContent = await readFile(PF_CONF_PATH, 'utf-8');
  }
  
  // Add our anchor line
  const anchorLine = `rdr-anchor "${PF_ANCHOR_NAME}"`;
  const loadLine = `load anchor "${PF_ANCHOR_NAME}" from "${PF_ANCHOR_PATH}"`;
  
  // Insert after any existing rdr-anchor lines, or at the end
  const lines = pfConfContent.split('\n');
  let insertIndex = lines.length;
  
  // Find the last rdr-anchor or rdr line
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].match(/^(rdr-anchor|rdr|nat-anchor|nat)\s/)) {
      insertIndex = i + 1;
      break;
    }
  }
  
  lines.splice(insertIndex, 0, anchorLine, loadLine);
  const newContent = lines.join('\n');
  
  // Write to temp file
  const tempPath = '/tmp/pf.conf.halo';
  await writeFile(tempPath, newContent, 'utf-8');
  
  // Move to system location with sudo
  const moveResult = await execCommand(`sudo mv ${tempPath} ${PF_CONF_PATH}`);
  if (!moveResult.success) {
    throw new Error(`Failed to update pf.conf: ${moveResult.stderr}`);
  }
  
  await execCommand(`sudo chown root:wheel ${PF_CONF_PATH}`);
  await execCommand(`sudo chmod 644 ${PF_CONF_PATH}`);
}

async function enablePF(): Promise<void> {
  // Check if PF is already enabled
  const statusResult = await execCommand('sudo pfctl -s info 2>&1');
  const isEnabled = statusResult.stdout.includes('Status: Enabled') || statusResult.stderr.includes('Status: Enabled');
  
  if (!isEnabled) {
    // Enable PF
    const enableResult = await execCommand('sudo pfctl -e 2>&1');
    if (!enableResult.success) {
      throw new Error(`Failed to enable PF: ${enableResult.stderr}`);
    }
  }
  
  // Load the rules
  const loadResult = await execCommand(`sudo pfctl -f ${PF_CONF_PATH}`);
  if (!loadResult.success) {
    throw new Error(`Failed to load PF rules: ${loadResult.stderr}`);
  }
}

export async function removePFRules(): Promise<void> {
  // Remove anchor file
  if (existsSync(PF_ANCHOR_PATH)) {
    await execCommand(`sudo rm -f ${PF_ANCHOR_PATH}`);
  }
  
  // Remove lines from pf.conf
  if (existsSync(PF_CONF_PATH)) {
    const content = await readFile(PF_CONF_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => !line.includes(PF_ANCHOR_NAME));
    
    const tempPath = '/tmp/pf.conf.halo';
    await writeFile(tempPath, lines.join('\n'), 'utf-8');
    await execCommand(`sudo mv ${tempPath} ${PF_CONF_PATH}`);
    await execCommand(`sudo chown root:wheel ${PF_CONF_PATH}`);
    await execCommand(`sudo chmod 644 ${PF_CONF_PATH}`);
  }
  
  // Reload PF
  await execCommand(`sudo pfctl -f ${PF_CONF_PATH} 2>&1`);
}

export async function checkPFRules(): Promise<boolean> {
  // Check if anchor file exists
  if (!existsSync(PF_ANCHOR_PATH)) {
    return false;
  }
  
  // Check if pf.conf references our anchor
  const checkResult = await execCommand(`grep -q "${PF_ANCHOR_NAME}" ${PF_CONF_PATH}`);
  return checkResult.success;
}
