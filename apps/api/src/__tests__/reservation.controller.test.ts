import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    (controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).fraudService.detectFraud.mockResolvedValue(true);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Security policy violation: Suspicious activity detected' }));
  });

  it('should return 201 on successful reservation', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    (controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).fraudService.detectFraud.mockResolvedValue(false);
    (controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).service.reserveSeat.mockResolvedValue(true);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(201);
    expect((controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).pubsubService.publishOrderReserved).toHaveBeenCalled();
  });

  it('should return 409 if seat is locked', async () => {
    const controller = new ReservationController(app as FastifyInstance);
    (controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).fraudService.detectFraud.mockResolvedValue(false);
    (controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } }).service.reserveSeat.mockResolvedValue(false);
    
    await controller.handleReservation(request as FastifyRequest, reply as FastifyReply);
    
    expect(reply.status).toHaveBeenCalledWith(409);
  });
});
