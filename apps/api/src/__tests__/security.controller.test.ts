import { describe, expect, it, vi } from 'vitest';
import { SecurityController } from '../controllers/security.controller';

describe('WebSocket security control contract', () => {
  it('rejects obsolete defense commands explicitly', async () => {
    const handlers = new Map<string, (message: Buffer) => Promise<void> | void>();
    const send = vi.fn();
    const socket = {
      on: (event: string, handler: (message: Buffer) => Promise<void> | void) => handlers.set(event, handler),
      send,
    };
    const app = { log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } };
    const controller = new SecurityController(app as never);
    controller.handleConnection({ socket } as never);

    await handlers.get('message')!(Buffer.from(JSON.stringify({ type: 'ACTIVATE_DEFENSE' })));

    expect(send).toHaveBeenCalledWith(JSON.stringify({
      type: 'ERROR',
      code: 'UNSUPPORTED_CONTROL',
      message: 'Defense control is not available on this stream',
    }));
  });
});
