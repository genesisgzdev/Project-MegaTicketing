import redis from '../redis';

/**
 * FraudService: Module for detecting suspicious reservation patterns.
 * Uses Redis for high-performance temporal counters and rate limiting.
 */
export class FraudService {
  private readonly VELOCITY_LIMIT = 5;
  private readonly VELOCITY_WINDOW = 10; // seconds
  
  private readonly PATTERN_WINDOW = 10; // seconds

  /**
   * Performs a comprehensive fraud check before allowing a reservation.
   * @param ip - The source IP address of the request
   * @param eventId - The ID of the event being booked
   * @returns Promise<boolean> - True if fraud is detected, false otherwise
   */
  async detectFraud(ip: string, eventId: string, userId: string): Promise<boolean> {
    const isVelocityFraud = await this.checkVelocity(ip, eventId, userId);
    if (isVelocityFraud) return true;

    // Event pressure is a signal for observability, never a global deny rule.
    await this.recordEventPressure(eventId);

    return false;
  }

  /**
   * Velocity Check: Detects if a single IP is making too many requests.
   * Limit: > 5 attempts in 10 seconds.
   */
  private async checkVelocity(ip: string, eventId: string, userId: string): Promise<boolean> {
    const ipKey = `fraud:velocity:ip:${ip}:event:${eventId}`;
    const userKey = `fraud:velocity:user:${userId}:event:${eventId}`;
    
    const increment = async (key: string) => Number(await redis.eval(`
      local count = redis.call('incr', KEYS[1])
      if count == 1 or redis.call('ttl', KEYS[1]) < 0 then redis.call('expire', KEYS[1], ARGV[1]) end
      return count
    `, 1, key, this.VELOCITY_WINDOW));
    const [ipCount, userCount] = await Promise.all([increment(ipKey), increment(userKey)]);

    return ipCount > this.VELOCITY_LIMIT || userCount > this.VELOCITY_LIMIT;
  }

  /**
   * Pattern Matching: Detects massive attempts for the same event from different users.
   * Limit: > 20 attempts in 10 seconds for the same event.
   */
  private async recordEventPressure(eventId: string): Promise<void> {
    const key = `fraud:pattern:event:${eventId}`;
    
    await redis.eval(`
      local count = redis.call('incr', KEYS[1])
      if count == 1 or redis.call('ttl', KEYS[1]) < 0 then redis.call('expire', KEYS[1], ARGV[1]) end
      return count
    `, 1, key, this.PATTERN_WINDOW);
  }
}
