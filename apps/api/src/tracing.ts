import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry Distributed Tracing Configuration.
 * Configures NodeSDK with OTLP gRPC exporter for Jaeger/Honeycomb.
 */
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'mega-ticketing-api',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4317', // Jaeger OTLP gRPC port
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyInstrumentation(),
    new IORedisInstrumentation(),
    new PrismaInstrumentation(),
  ],
});

// Start the SDK and handle graceful shutdown
try {
  sdk.start();
  console.log('[TRACING] OpenTelemetry SDK initialized successfully');
} catch (error) {
  console.error('[TRACING] Error initializing OpenTelemetry SDK', error);
}

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[TRACING] OpenTelemetry SDK shut down successfully'))
    .catch((error) => console.error('[TRACING] Error shutting down OpenTelemetry SDK', error))
    .finally(() => process.exit(0));
});

export default sdk;
