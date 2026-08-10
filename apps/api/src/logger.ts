import pino, { Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
  base: {
    service: 'mega-ticketing-api',
    environment: process.env.NODE_ENV || 'development',
  },
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
