# Euler Allocator Bot

A bot which uses simulated annealing to find optimal allocations into EulerEarn strategies. It simulates reallocations and calculates impact on the lending and rewards APYs, searching for global optimum.

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
or
```bash
pnpm run doppler:syncprod
```
See [constants](./src/constants/constants.ts) for details.

3. Run
```bash
pnpm run dev
#or
pnpm run build & pnpm start
```

For pretty logs in development, set `NODE_ENV=dev`

## Notifications
The bot can send notifications through Telegram or Slack. See [src/constants/notificationConstants.ts](./src/constants/notificationConstants.ts)

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