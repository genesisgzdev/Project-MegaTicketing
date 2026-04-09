import redis from '../redis';

/**
 * FraudService: Module for detecting suspicious reservation patterns.
 * Uses Redis for high-performance temporal counters and rate limiting.
 */
export class FraudService {
  private readonly VELOCITY_LIMIT = 5;
  private readonly VELOCITY_WINDOW = 10; // seconds
  
  private readonly PATTERN_LIMIT = 20; // "Massive" threshold
  private readonly PATTERN_WINDOW = 10; // seconds

  /**
   * Performs a comprehensive fraud check before allowing a reservation.
   * @param ip - The source IP address of the request
   * @param eventId - The ID of the event being booked
   * @returns Promise<boolean> - True if fraud is detected, false otherwise
   */
  async detectFraud(ip: string, eventId: string): Promise<boolean> {
    const isVelocityFraud = await this.checkVelocity(ip);
    if (isVelocityFraud) return true;

    const isPatternFraud = await this.checkPattern(eventId);
    if (isPatternFraud) return true;

    return false;
  }

  /**
   * Velocity Check: Detects if a single IP is making too many requests.
   * Limit: > 5 attempts in 10 seconds.
   */
  private async checkVelocity(ip: string): Promise<boolean> {
    const key = `fraud:velocity:ip:${ip}`;
    
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, this.VELOCITY_WINDOW);
    }

    return count > this.VELOCITY_LIMIT;
  }

  /**
   * Pattern Matching: Detects massive attempts for the same event from different users.
   * Limit: > 20 attempts in 10 seconds for the same event.
   */
  private async checkPattern(eventId: string): Promise<boolean> {
    const key = `fraud:pattern:event:${eventId}`;
    
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, this.PATTERN_WINDOW);
    }

    return count > this.PATTERN_LIMIT;
  }
}


