# Euler Allocator Bot – Agent Notes

## What the Agent Does
The service runs a looped allocator that rebalances an Euler Earn vault. Every cycle it:
- pulls current vault + strategy state through a Viem `PublicClient`;
- calculates new target allocations with a greedy annealing heuristic;
- checks utilization, soft-cap, and APY constraints; and
- optionally sends a batch transaction through Euler’s EVC contract (or simulates when broadcasting is disabled) and pushes notifications about the outcome.

## Runtime Structure
- `src/index.ts` bootstraps the process: loads parsed env constants, instantiates `Allocator`, and schedules `computeAllocation()` on an interval.
- `src/modules/Allocator.ts` orchestrates the full run: fetches vault data, computes current returns, runs simulated annealing (`utils/greedyStrategy`), validates deltas, executes the rebalance via `utils/common/executeRebalance`, and logs/notifies results.
- `src/utils`
  - `common/` reusable helpers (RPC chain selection, allocation math, transaction batching, logging, env parsing).
  - `euler/` on-chain queries & rate conversions specific to Euler (vault lens reads, internal balance, IRM config, Merkl rewards).
  - `greedyStrategy/` optimization primitives: initial greed allocation, returns calculator, simulated annealing w/ utilization + soft-cap guards.
  - `notifications/` Slack & Telegram senders plus unified dispatcher.
  - `rewards/merkl.ts` APY contribution from Merkl reward campaigns.
- `src/constants` centralizes static config (annealing parameters, ABIs, parsed env, notification wiring).
- `src/data/rpcClient.ts` builds a shared Viem client using chain metadata.
- `src/types` holds zod schemas + shared typings.
- `test/` mirrors the utility layout with Jest unit coverage for greedy calculations, parsing, and snapshot checks.

## Key Runtime Flow
1. `getEulerEarn()` pulls vault strategy info, resolves on-chain details for each EVault, and applies optional strategy overrides.
2. `computeGreedyReturns()` evaluates APY impact (interest + rewards) for a candidate allocation; utilization is tracked for guardrails.
3. Mode `annealing`: `computeGreedySimAnnealing()` perturbs allocations while respecting supply caps, soft caps (`SOFT_CAPS` env), and utilization limits (`MAX_UTILIZATION`). Acceptance requires at least `ALLOCATION_DIFF_TOLERANCE` improvement to aggregate APY.
4. Mode `equalization`: `computeUnifiedApyAllocation()` smooths strategy APYs by shifting liquidity from low-yield to high-yield vaults while preserving caps/utilization checks. Acceptance requires the post-run spread to fall beneath `APY_SPREAD_TOLERANCE` (or improve vs previous spread when the tolerance is unset).
5. Mode `combined` (default) runs simulated annealing followed by APY equalization and enforces both tolerances before dispatch.
6. `verifyAllocation()` ensures reallocations clear their configured tolerances, utilization is improved, and caps are respected.
7. `executeRebalance()` prepares an EVC batch call packed with a single `EulerEarn.reallocate` entry. It simulates first, enforces `MAX_GAS_COST` (when set), then either broadcasts via wallet client or returns `"simulation"`.
8. `notifyRun()` routes success/error summaries to Telegram/Slack using env-provided credentials.

## Environment Configuration
Parsed in `src/constants/constants.ts` (required unless noted):
- `ALLOCATION_DIFF_TOLERANCE` (number %) – minimal APY improvement to execute a rebalance.
- `ALLOCATOR_PRIVATE_KEY` (hex) – signer for EVC batch; required even when simulating.
- `CASH_PERCENTAGE` (bigint 18-dec) – cash reserve kept in idle vault.
- `NO_IDLE_VAULT` (`true`/`false`, default `false`) – set to `true` when the strategy set has no idle vault; requires `CASH_PERCENTAGE = 0`.
- `MAX_STRATEGY_APY_DIFF` (number %) – optional cap on cross-strategy APY spread during annealing.
- `OPTIMIZATION_MODE` (`annealing` | `equalization` | `combined`, default `combined`) – selects which optimization pipeline the allocator executes; CLI `--mode/--optimizer/--strategy` overrides this at runtime.
- `APY_SPREAD_TOLERANCE` (number %) – target ceiling for the APY spread when equalization is enabled; if omitted, any strictly tighter spread is accepted.
- `CHAIN_ID` – supported: 1 (mainnet), 8453 (Base), 42161 (Arbitrum), 9745 (custom Plasma chain defined in `chainConversion.ts`).
- `EARN_VAULT_ADDRESS`, `EVC_ADDRESS`, `VAULT_LENS_ADDRESS`, `EULER_EARN_VAULT_LENS_ADDRESS` – deployed contract addresses.
- `INTERVAL_TIME` (ms) – delay between allocation cycles.
- `BROADCAST` (`true`/`false`) – controls whether rebalance txs are actually sent.
- `RPC_URL` – RPC endpoint for Viem client (used for both public + wallet transports).
- `STRATEGIES_OVERRIDE` (optional CSV `protocol:address`) – forces allocation order subset.
- `MAX_GAS_COST` (optional bigint) – ceiling on `gas * gasPrice`; aborts if exceeded.
- `MAX_UTILIZATION` (optional number) – utilization limit per vault; annealer prioritizes reducing breaches.
- `SOFT_CAPS` (optional CSV `vault:min:max` in wei) – per-strategy min/max bounds.

Notification extras from `notificationConstants.ts`:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` – enable Telegram messenger.
- `SLACK_WEBHOOK` – Slack notifications.

Other flags:
- `NODE_ENV=dev` toggles pretty logging via `pino-pretty`.

`.env.example` lists the core variables; Doppler scripts (`scripts/doppler*.sh`) sync secrets for dev/stg/prd.

## Tooling & Commands
Package scripts (`pnpm` default):
- `pnpm dev` – run allocator in watch/tsx mode.
- `pnpm build` – TypeScript compile (`tsc`) plus `tsc-alias` path rewrites.
- `pnpm start` – execute compiled output (`dist/index.js`).
- `pnpm test` – Jest unit suite with coverage (roots `src` + `test`).
- `pnpm format` – Prettier over `src/` and `test/`.
- Docker helpers (`docker:*`) build/run containerized allocator.
- Doppler helpers (`doppler:login`, `doppler:sync*`) manage env secrets.

TypeScript paths come from `tsconfig.json` (`@/*` alias), and Jest mirrors that via `moduleNameMapper`. Coverage excludes constants, notification senders, and entrypoints; reports land in `coverage/`.

## Acceptance & CI Signals
- No CI workflow is present in the repo; expect downstream automation to run `pnpm install`, `pnpm build`, and `pnpm test --coverage`.
- Jest’s coverage gate (invoked by the default script) acts as the main acceptance criterion—failures or coverage regressions break the pipeline.
- Dockerfile builds the production image: installs deps, compiles TS, and runs `pnpm start`, aligning with how deployments should execute.

## Operational Notes
- `docker-compose.yml` wires container env vars; some keys (e.g., `DATABASE_URL`, `STRATEGIES`) look legacy—ensure they match the current constants file before relying on them.
- The allocator loops via `setTimeout(main, INTERVAL_TIME)`; crashing errors are logged and surfaced through notifications before the next iteration.
- Strategy overrides must include the idle vault when `CASH_PERCENTAGE > 0` and `NO_IDLE_VAULT` is `false` to keep cash handling intact.
