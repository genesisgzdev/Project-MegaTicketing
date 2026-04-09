const fs = require('fs');
const path = require('path');

const projectRoot = 'C:/Users/Genesisif/Desktop/TDS-MegaTicketing-Industrial/Project-MegaTicketing';
const testsDir = path.join(projectRoot, 'apps/api/src/__tests__');

if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
}

const redisTestCode = import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCircuitBreaker } from '../redis';

describe('RedisCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should execute operation successfully when closed', async () => {
    const breaker = new RedisCircuitBreaker(3, 10000);
    const operation = vi.fn().mockResolvedValue('success');
    const fallback = vi.fn().mockResolvedValue('fallback');

    const result = await breaker.execute(operation, fallback);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should retry operation on failure', async () => {
    const breaker = new RedisCircuitBreaker(3, 10000);
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    const fallback = vi.fn().mockResolvedValue('fallback');

    const resultPromise = breaker.execute(operation, fallback, 3, 10);
    
    // Fast-forward the retry delay
    await vi.runAllTimersAsync();
    
    const result = await resultPromise;
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should open circuit and use fallback after max failures', async () => {
    const breaker = new RedisCircuitBreaker(2, 10000);
    const operation = vi.fn().mockRejectedValue(new Error('fail'));
    const fallback = vi.fn().mockResolvedValue('fallback');

    // First attempt fails entirely (using up maxRetries)
    let p1 = breaker.execute(operation, fallback, 1, 10);
    await vi.runAllTimersAsync();
    await p1;

    // Second attempt fails entirely
    let p2 = breaker.execute(operation, fallback, 1, 10);
    await vi.runAllTimersAsync();
    await p2;

    // Circuit should now be OPEN. Next call returns fallback immediately without trying operation
    operation.mockClear();
    const result3 = await breaker.execute(operation, fallback);
    
    expect(result3).toBe('fallback');
    expect(operation).not.toHaveBeenCalled();
  });
});
;

fs.writeFileSync(path.join(testsDir, 'redis.test.ts'), redisTestCode, 'utf8');

const reservationTestCode = import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReservationController } from '../controllers/reservation.controller';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Mock dependencies
vi.mock('../services/reservation.service', () => {
  return {
    ReservationService: vi.fn().mockImplementation(() => ({
      reserveSeat: vi.fn()
    }))
  };
});

vi.mock('../services/pubsub.service', () => {
  return {
    PubSubService: vi.fn().mockImplementation(() => ({
      publishOrderReserved: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

vi.mock('../services/fraud.service', () => {
  return {
    FraudService: vi.fn().mockImplementation(() => ({
      detectFraud: vi.fn()
    }))
  };
});

describe('ReservationController', () => {
  let app: Partial<FastifyInstance>;
  let request: Partial<FastifyRequest>;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    app = {
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn()
      }
    };

    request = {
      body: {
        seatId: '123e4567-e89b-12d3-a456-426614174000',
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174000'
      },
      ip: '127.0.0.1'
    };

    reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };
  });

  it('should return 400 for invalid body schema', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    request.body = { invalid: true };
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', message: 'Invalid request data' }));
  });

  it('should return 403 if fraud is detected', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    // Force fraud detect
    (controller as any).fraudService.detectFraud.mockResolvedValue(true);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Security policy violation: Suspicious activity detected' }));
  });

  it('should return 201 on successful reservation', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    (controller as any).fraudService.detectFraud.mockResolvedValue(false);
    (controller as any).service.reserveSeat.mockResolvedValue(true);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(201);
    expect((controller as any).pubsubService.publishOrderReserved).toHaveBeenCalled();
  });

  it('should return 409 if seat is locked', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    (controller as any).fraudService.detectFraud.mockResolvedValue(false);
    (controller as any).service.reserveSeat.mockResolvedValue(false);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(409);
  });
});
;

fs.writeFileSync(path.join(testsDir, 'reservation.controller.test.ts'), reservationTestCode, 'utf8');

