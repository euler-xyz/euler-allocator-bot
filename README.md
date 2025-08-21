# Allocator

Gratefully based on original work from [Objective Labs](https://github.com/objectivedefi)

## Prerequisites

- Node.js
- [pnpm](https://pnpm.io/) package manager

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Generate Prisma schema and client:
```bash
pnpm generate-schema
```

## Code Style

This project uses Prettier for code formatting. The configuration can be found in `.prettierrc`. To maintain consistent code style:

1. Test your code before committing:
```bash
pnpm test
```

2. Format your code before committing:
```bash
pnpm format
```