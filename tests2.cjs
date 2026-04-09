const fs = require('fs');
const path = require('path');

const projectRoot = 'C:/Users/Genesisif/Desktop/TDS-MegaTicketing-Industrial/Project-MegaTicketing';
const indexFile = path.join(projectRoot, 'apps/api/src/index.ts');
let indexContent = fs.readFileSync(indexFile, 'utf8');

indexContent = indexContent.replace(/server\.register\(rateLimit, \{[\s\S]*?\} as any\);/m, 
"server.register(rateLimit, {\n  max: 100,\n  timeWindow: '1 minute',\n  skip: () => !defenseActive,\n  redis: redis,\n  keyGenerator: (req) => req.ip\n});");
fs.writeFileSync(indexFile, indexContent, 'utf8');

const secCtrlFile = path.join(projectRoot, 'apps/api/src/controllers/security.controller.ts');
let secContent = fs.readFileSync(secCtrlFile, 'utf8');
secContent = secContent.replace(/\* Using any for connection to bypass Fastify version-specific type mismatches\./, "* Using SocketStream for connection.");
fs.writeFileSync(secCtrlFile, secContent, 'utf8');

const testFile = path.join(projectRoot, 'apps/api/src/__tests__/reservation.controller.test.ts');
let testContent = fs.readFileSync(testFile, 'utf8');
testContent = testContent.replace(/\(controller as any\)/g, "(controller as unknown as { fraudService: { detectFraud: import('vitest').Mock }, service: { reserveSeat: import('vitest').Mock }, pubsubService: { publishOrderReserved: import('vitest').Mock } })");
fs.writeFileSync(testFile, testContent, 'utf8');
