import { getSystemHealth } from '../game-state';

/**
 * Result of a system health check operation.
 */
export interface HealthStatus {
  vulnerabilities: number;
  timestamp: string;
  status: 'DANGER' | 'SECURE' | 'UNKNOWN';
  scanner_missing?: boolean;
}

/**
 * Service to aggregate and report system-wide health and diagnostics.
 * Evaluates security posture and infrastructure status.
 */
export class HealthService {
  /**
   * Performs an asynchronous diagnostic check of the system's security and health.
   * 
   * @returns A promise resolving to a detailed HealthStatus object.
   */
  async check(): Promise<Readonly<HealthStatus>> {
    const health = await getSystemHealth();
    return health as Readonly<HealthStatus>;
  }
}


