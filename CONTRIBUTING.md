# Contributing to Project MegaTicketing

Welcome! We are excited that you want to contribute to MegaTicketing. This project is a high-performance monorepo, and following our standards ensures system integrity and performance.

## 🏗 Monorepo Flow (Turborepo)

We use [Turborepo](https://turbo.build/) to manage our build pipeline and caching.

### 🛠 Pipeline Commands
- **`npm run dev`**: Starts all applications (`api`, `web`) in development mode with hot-reloading.
- **`npm run build`**: Builds all packages and apps. Turbo will use local/remote caching to skip unchanged tasks.
- **`npm run lint`**: Runs ESLint across the entire monorepo.
- **`npm run test`**: Executes unit and integration tests.

### 📦 Structure
- `apps/api`: Fastify backend.
- `apps/web`: React frontend.
- `packages/database`: Prisma schema and generated client.
- `packages/shared`: Zod schemas and shared utility functions.

## 📜 TypeScript & Coding Standards

We enforce strict TypeScript configurations to ensure type safety across the stack.

### 🔹 Standards
1. **Strict Mode**: `strict: true` is mandatory in all `tsconfig.json` files. No `any` allowed.
2. **Type-First Development**: Define Zod schemas in `packages/shared` before implementing logic. Infer TypeScript types from these schemas.
3. **Hexagonal Architecture**: Keep business logic decoupled from external dependencies (Prisma, Fastify, Stripe).
4. **Functional Purity**: Prefer immutable data structures and pure functions where possible.

### 🔹 Linting & Formatting
- **ESLint**: We use a custom configuration extending `typescript-eslint/recommended`.
- **Prettier**: Code must be formatted using Prettier.
- **Husky**: Pre-commit hooks run `lint` and `type-check` automatically.

## 🚀 Contribution Process

1. **Check Issues**: Find an issue or open a new one to discuss your proposal.
2. **Branching**: Create a branch from `main` using `feat/`, `fix/`, or `docs/` prefixes.
3. **Security Check**: Run `npx snyk test --all-projects` locally.
4. **PR Guidelines**:
   - Ensure `npm run build` passes locally.
   - All PRs must include tests for new logic.
   - Use [Conventional Commits](https://www.conventionalcommits.org/).

## ⚖️ License
By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
