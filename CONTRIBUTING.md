# Contributing to MegaTicketing

## Local Development
The platform uses Turborepo for monorepo orchestration.

1. **Requirements**: Node.js 20+, Docker, Docker Compose.
2. **Install**: Run 
pm install --legacy-peer-deps --ignore-scripts. We enforce 
pm over yarn or pnpm; the packageManager field is strictly set to 
pm@10.8.2.
3. **Database**: Run 
px prisma generate --schema=packages/database/prisma/schema.prisma and 
px prisma db push to synchronize the PostgreSQL schema.

## Turborepo Configuration
- The monorepo uses Turborepo v2.0+. Ensure your 	urbo.json uses the "tasks" object, not the deprecated "pipeline" directive.
- Container builds execute 
px turbo run build --filter=@mega-ticketing/api to isolate the backend compilation from frontend dependencies.

## Coding Standards
- **TypeScript**: Strict mode is enabled. The use of ny is strictly prohibited. Use unknown for caught errors and cast them to Error.
- **Fastify**: Follow the Controller/Service pattern.
- **React**: Use React.memo, useMemo, and useCallback for all high-frequency rendering components.

## Testing
- Unit tests use **Vitest / Jest**.
- Concurrency logic, such as the RedisCircuitBreaker, must be tested using fake timers (jest.useFakeTimers()). This mathematically proves the exponential backoff algorithm's correctness without pausing the CI/CD pipeline with real setTimeout delays.
