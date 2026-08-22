import { beforeEach, describe, expect, it, vi } from 'vitest';

const { incrementWithExpiry } = vi.hoisted(() => ({ incrementWithExpiry: vi.fn() }));

vi.mock('../redis', () => ({ incrementWithExpiry }));

import { FraudService } from '../services/fraud.service';

describe('FraudService', () => {
  beforeEach(() => incrementWithExpiry.mockReset());

  it('uses atomic expiring counters for actor velocity', async () => {
    incrementWithExpiry.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const service = new FraudService();

    expect(await service.detectFraud('198.51.100.10', 'event-1', 'user-1')).toBe(false);

    expect(incrementWithExpiry).toHaveBeenCalledWith('fraud:velocity:ip:198.51.100.10:event:event-1', 10);
    expect(incrementWithExpiry).toHaveBeenCalledWith('fraud:velocity:user:user-1:event:event-1', 10);
    expect(incrementWithExpiry).toHaveBeenCalledWith('fraud:pattern:event:event-1', 10);
  });
});
