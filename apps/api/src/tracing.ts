import { NodeSDK } from '@opentelemetry/sdk-node';
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { config } from './config';

/**
 * OpenTelemetry Distributed Tracing Configuration.
 * Configures NodeSDK with OTLP gRPC exporter for Jaeger/Honeycomb.
 */
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'mega-ticketing-api',
    [ATTR_SERVICE_VERSION]: '2.1.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyOtelInstrumentation({ registerOnInitialization: true }),
    new IORedisInstrumentation(),
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
