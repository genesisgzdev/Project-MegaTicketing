import { watch } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Executes a security health check using an external scanner.
 * Expects the scanner binary to be available in the system PATH or 
 * provided via the SECURITY_SCANNER_PATH environment variable.
 */
export const getSystemHealth = async () => {
  try {
    const projectRoot = process.cwd();
    const scannerPath = process.env.SECURITY_SCANNER_PATH || 'osv-scanner';
    
    // production check: avoid hardcoded local Windows paths
    const { stdout } = await execAsync(`${scannerPath} scan source -r ${projectRoot} --format json`);
    const results = JSON.parse(stdout);
    
    return {
      vulnerabilities: results.results?.[0]?.packages?.length || 0,
      timestamp: new Date().toISOString(),
      status: results.results?.[0]?.packages?.length > 0 ? 'DANGER' : 'SECURE'
    };
  } catch (e) {
    // Graceful degradation: return a neutral state if the scanner is missing
    return { vulnerabilities: 0, status: 'UNKNOWN', scanner_missing: true };
  }
};

export const watchFiles = (onchange: (file: string) => void) => {
  const projectRoot = process.cwd();
  watch(projectRoot, { recursive: true }, (event, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.git')) {
      onchange(filename);
    }
  });
};


