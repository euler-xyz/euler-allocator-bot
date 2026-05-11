FROM node:18

# Use corepack-managed pnpm (version pinned in package.json `packageManager`).
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies (frozen — fails on lockfile drift)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Run the application
CMD ["pnpm", "start"]
