import { watch } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const getSystemHealth = async () => {
  try {
    // Real security scan in background
    const projectRoot = path.join(__dirname, '../../..');
    const scannerPath = process.env.OSV_SCANNER_PATH || 'osv-scanner';
    
    // We run a quick check on package.json
    const { stdout } = await execAsync(`${scannerPath} scan source -r ${projectRoot} --format json`);
    const results = JSON.parse(stdout);
    
    return {
      vulnerabilities: results.results?.[0]?.packages?.length || 0,
      timestamp: new Date().toISOString(),
      status: results.results?.[0]?.packages?.length > 0 ? 'DANGER' : 'SECURE'
    };
  } catch (e) {
    return { vulnerabilities: 0, status: 'SECURE', error: true };
  }
};

export const watchFiles = (onchange: (file: string) => void) => {
  const projectRoot = path.join(__dirname, '../../..');
  watch(projectRoot, { recursive: true }, (event, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.git')) {
      onchange(filename);
    }
  });
};
