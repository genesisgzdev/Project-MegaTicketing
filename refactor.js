const fs = require('fs');
const path = require('path');

const projectRoot = 'C:/Users/Genesisif/Desktop/TDS-MegaTicketing-Industrial/Project-MegaTicketing';
const apiSrcDir = path.join(projectRoot, 'apps/api/src');
const webSrcDir = path.join(projectRoot, 'apps/web/src');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = dir + '/' + files[i];
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      files_.push(name);
    }
  }
  return files_;
}

const apiFiles = getFiles(apiSrcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

for (const file of apiFiles) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix all 'any' types in API
  content = content.replace(/\} catch \(err: any\) \{/g, '} catch (err: unknown) {');
  content = content.replace(/err as any/g, 'err as Error');
  
  if (file.endsWith('index.ts')) {
    content = content.replace(/import \{ config \} from '\.\/config';/, "import { config } from './config';\nimport redis from './redis';");
    content = content.replace(/server\.register\(rateLimit, \{\n  max: 100,\n  timeWindow: '1 minute',\n  skip: \(\) => !defenseActive\n\} as any\);/g, 
      "server.register(rateLimit, {\n  max: 100,\n  timeWindow: '1 minute',\n  skip: () => !defenseActive,\n  redis: redis\n});");
    content = content.replace(/\(connection: any\)/g, "(connection: import('@fastify/websocket').SocketStream)");
    content = content.replace(/\(error: any, request, reply\)/g, "(error: import('fastify').FastifyError, request, reply)");
  }
  
  if (file.endsWith('redis.ts')) {
    content = content.replace(/\(redis as any\)\.releaseLockAtomic/g, "(redis as Redis & { releaseLockAtomic(key: string, value: string): Promise<number> }).releaseLockAtomic");
    // Ensure graceful connection drop handling
    if (!content.includes("redis.on('error'")) {
        content += "\nredis.on('error', (err) => { console.error('Redis connection error:', err); });\n";
    }
  }
  
  if (file.endsWith('payments.ts')) {
    content = content.replace(/new \(Stripe as any\)/g, "new Stripe");
    content = content.replace(/metadata: any/g, "metadata: Record<string, string>");
  }
  
  if (file.includes('security.controller.ts')) {
    content = content.replace(/handleConnection\(connection: any\)/g, "handleConnection(connection: import('@fastify/websocket').SocketStream)");
    content = content.replace(/let subscriber: any = null;/g, "let subscriber: import('ioredis').Redis | null = null;");
  }
  
  if (file.includes('webhook.controller.ts')) {
    content = content.replace(/const paymentIntent = event\.data\.object as any;/g, "const paymentIntent = event.data.object as import('stripe').Stripe.PaymentIntent;");
  }

  if (file.includes('SystemMonitor.tsx') || file.includes('CyberArena.tsx')) {
    // handled later
  }

  // Remove marketing fluff and translate comments
  content = content.replace(/\/\*\*\s*\*\s*production API Entrypoint\.\s*\*\s*Architecture: Controller\/Service Pattern with High-Availability Redis Locking\.\s*\*\//g, 
    "/**\n * API Entrypoint.\n * Architecture: Controller/Service Pattern with Redis Locking.\n */");
  content = content.replace(/\/\/ Security Shield Configuration/g, "// Rate Limiting Configuration");
  content = content.replace(/\/\*\*\s*\*\s*Stripe Webhook Raw Body Handling\.\s*\*\s*Necessary for cryptographic signature validation\.\s*\*\//g, 
    "/**\n * Stripe Webhook Raw Body Parser.\n * Required for signature validation.\n */");
  content = content.replace(/\/\*\*\s*\*\s*Route Registration - Production Grade Orchestration\.\s*\*\//g, "/**\n * Route Registration.\n */");
  content = content.replace(/\/\/ Full-Duplex Real-time Security Hub/g, "// Real-time WebSocket endpoint");
  content = content.replace(/\/\*\*\s*\*\s*Fatal Error Protection Layer\.\s*\*\//g, "/**\n * Global Error Handler.\n */");
  content = content.replace(/\/\*\*\s*\*\s*Server Lifecycle Management\.\s*\*\//g, "/**\n * Server Initialization.\n */");
  content = content.replace(/\[DEPLOYED\] MegaTicketing API/g, "MegaTicketing API");
  content = content.replace(/\/\*\*\s*\*\s*production Database Provider\.\s*\*\s*Bridges the monorepo database package with the API\.\s*\*\//g,
    "/**\n * Database Provider.\n * Bridges the monorepo database package with the API.\n */");
  content = content.replace(/\/\/ production check: avoid hardcoded local Windows paths/g, "// Avoid hardcoded local Windows paths");
  content = content.replace(/\/\/ Generate an production idempotency key/g, "// Generate an idempotency key");
  content = content.replace(/\/\*\*\s*\*\s*ReservationService: Encapsulates production logic for seat availability and locking\.\s*\*\//g,
    "/**\n * ReservationService: Encapsulates logic for seat availability and locking.\n */");
  content = content.replace(/\/\/ production check: Ensure the lock is acquired atomically in Redis/g, "// Ensure the lock is acquired atomically in Redis");
  content = content.replace(/\/\/ 1\. Advanced Fraud Detection \(Velocity & Pattern Matching\)/g, "// 1. Fraud Detection (Velocity & Pattern Matching)");
  content = content.replace(/\/\*\*\s*\*\s*FraudService: Advanced security module for detecting suspicious reservation patterns\./g,
    "/**\n * FraudService: Module for detecting suspicious reservation patterns.");
  content = content.replace(/\/\*\*\s*\*\s*production Pub\/Sub Service\.\s*\*\s*Orchestrates asynchronous order fulfillment streams with robust error handling and retries\.\s*\*\//g,
    "/**\n * Pub/Sub Service.\n * Manages asynchronous order fulfillment streams.\n */");
  content = content.replace(/\/\/ Professional logging with full error context/g, "// Log error context");
  content = content.replace(/\/\*\*\s*\*\s*ReservationController: Orchestrates the API lifecycle for seat bookings\.\s*\*\s*Handles high-concurrency reservation logic and downstream event streaming\.\s*\*\//g,
    "/**\n * ReservationController: Manages API lifecycle for seat bookings.\n * Handles reservation logic and downstream event streaming.\n */");
  content = content.replace(/\/\/ Handle specific production event types/g, "// Handle specific event types");

  fs.writeFileSync(file, content, 'utf8');
}

// Frontend Refactoring
const appPath = path.join(webSrcDir, 'App.tsx');
if (fs.existsSync(appPath)) {
  let appContent = fs.readFileSync(appPath, 'utf8');
  if (!appContent.includes('useCallback')) {
    appContent = appContent.replace(/import \{ useState, useEffect, useRef \} from 'react';/, "import { useState, useEffect, useRef, useCallback } from 'react';");
    appContent = appContent.replace(/const toggleShield = \(\) => \{/g, "const toggleShield = useCallback(() => {");
    appContent = appContent.replace(/    \}\)\);\n  \};/g, "    }));\n  }, [shieldActive]);");
    fs.writeFileSync(appPath, appContent, 'utf8');
  }
}

const sysMonPath = path.join(webSrcDir, 'SystemMonitor.tsx');
if (fs.existsSync(sysMonPath)) {
  let sysContent = fs.readFileSync(sysMonPath, 'utf8');
  // Remove 'any' and wrap in React.memo
  sysContent = sysContent.replace(/function FileNode\(\{ position, name, isError \}: any\) \{/g, "const FileNode = React.memo(({ position, name, isError }: { position: any, name: string, isError: boolean }) => {");
  sysContent = sysContent.replace(/function SecurityCore\(\{ status \}: any\) \{/g, "const SecurityCore = React.memo(({ status }: { status: string }) => {");
  sysContent = sysContent.replace(/function Ground\(\) \{/g, "const Ground = React.memo(() => {");
  sysContent = sysContent.replace(/export default function CyberArena\(\) \{/g, "});\n\nexport default function CyberArena() {");
  // There are two "});" replacements needed for FileNode and SecurityCore
  sysContent = sysContent.replace(/    <\/mesh>\n  \);\n\}\n\nconst SecurityCore/g, "    </mesh>\n  );\n});\n\nconst SecurityCore");
  sysContent = sysContent.replace(/    <\/mesh>\n  \);\n\}\n\nconst Ground/g, "    </mesh>\n  );\n});\n\nconst Ground");
  // Add memoization to sysContent if needed, we'll just leave it since we wrapped them.
  fs.writeFileSync(sysMonPath, sysContent, 'utf8');
}

const cyberArenaPath = path.join(webSrcDir, 'CyberArena.tsx');
if (fs.existsSync(cyberArenaPath)) {
  let cyberContent = fs.readFileSync(cyberArenaPath, 'utf8');
  cyberContent = cyberContent.replace(/export default function CyberArena\(\) \{/g, "const CyberArena = React.memo(() => {");
  cyberContent = cyberContent.replace(/\n\}\n$/g, "\n});\nexport default CyberArena;");
  fs.writeFileSync(cyberArenaPath, cyberContent, 'utf8');
}
