# Contributing to Project MegaTicketing

Thank you for your interest in contributing to MegaTicketing! We welcome contributions from the community to help make this ticketing suite even better.

## 🛡️ Security First
If you find a security vulnerability, please **DO NOT** open a public issue. Instead, refer to our security policy in [SECURITY.md](SECURITY.md) (coming soon) or contact the maintainers directly.

## 🚀 How to Contribute

### 1. Reporting Bugs
- Use the GitHub Issue tracker.
- Provide a clear description of the bug and steps to reproduce.
- Include information about your environment (Node.js version, OS, etc.).

### 2. Pull Requests
- Fork the repository and create your branch from `main`.
- Ensure your code follows the existing style and architecture.
- **Run local security scans** using Snyk before submitting:
  ```bash
  npx snyk test --all-projects
  ```
- Write clear, descriptive commit messages using [Conventional Commits](https://www.conventionalcommits.org/).
- Ensure all tests pass.

## 🛠️ Development Setup
Refer to the [Local Development](README.md#-local-development) section in the README.

## 📜 Coding Standards
- Use TypeScript for all backend and frontend logic.
- Follow the Hexagonal Architecture pattern where applicable.
- Ensure all new features are documented in the `docs/` folder.

## ⚖️ License
By contributing to MegaTicketing, you agree that your contributions will be licensed under its [Apache License 2.0](LICENSE).
