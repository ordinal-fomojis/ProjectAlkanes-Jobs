# ProjectAlkanes Jobs

Cron jobs for the **Shovel** platform, implemented as **Azure Functions (Node.js + TypeScript)**.

This service syncs Bitcoin mempool/token state (Alkane and BRC) into MongoDB and manages broadcast/confirmation flows for queued transactions.

## Related Repositories

- Frontend: https://github.com/ordinal-fomojis/ProjectAlkanes-FE
- Backend: https://github.com/ordinal-fomojis/ProjectAlkanes-BE
- Infrastructure (IaC): https://github.com/ordinal-fomojis/ProjectAlkanes-IAC

## What This Repo Contains

- Azure Functions timer-triggered jobs in `src/functions`
- Job implementations in `src/jobs`
- MongoDB data access and sync helpers in `src/database`
- Shared RPC/API utilities in `src/utils`
- Unit/integration tests with Vitest in `tests`

## Scheduled Jobs

Functions are registered as timer triggers via `registerJob()` and each schedule is controlled by an environment variable:

| Function | Cron env var | Purpose |
|---|---|---|
| `broadcast` | `BROADCAST_CRON` | Broadcast pending txs, update mempool/confirmation status |
| `syncMempool` | `SYNC_MEMPOOL_CRON` | Sync current mempool txs and affected alkane mints |
| `syncTokens` | `SYNC_TOKENS_CRON` | Sync Alkane tokens + BRC tokens (default + 6-byte) |
| `syncCalculatedFields` | `SYNC_CALCULATED_FIELDS_CRON` | Recompute calculated mempool mint fields |

If a cron env var is missing/empty, that function is not registered.

## Tech Stack

- Node.js 22
- TypeScript
- Azure Functions v4 programming model (`@azure/functions`)
- MongoDB
- Vitest + ESLint

## Prerequisites

- Node.js 22.x
- npm
- Azure Functions Core Tools (`func`)
- MongoDB instance
- API keys for Sandshrew, Ordiscan, and Unisat

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local env file (for example `.env`) using `.env.sample` as reference.
3. Set `DOTENV_PATH` to that env file path before running the app (the code loads env values from `DOTENV_PATH` in non-test environments).
4. Ensure Azurite/local storage is available for Functions (`local.settings.json` already points to `UseDevelopmentStorage=true`).

Run locally:

```bash
npm run build
func start
```

Or use watch mode in one terminal and Functions host in another:

```bash
npm run watch
func host start
```

## Environment Variables

### Required

- `ORDISCAN_API_KEY`
- `UNISAT_API_KEY`
- `MONGODB_URI`

### Common Optional / Defaults

- `MONGODB_DB_NAME` (default from code: `project-alkanes`)
- `BITCOIN_NETWORK` (`mainnet` | `signet` | `testnet`, default `mainnet`)
- `NODE_ENV` (`development`/`production`/`test`)

### Cron Schedules

- `BROADCAST_CRON`
- `SYNC_MEMPOOL_CRON`
- `SYNC_TOKENS_CRON`
- `SYNC_CALCULATED_FIELDS_CRON`

Example cron values are provided in `.env.sample`.

## Scripts

- `npm run build` – Compile TypeScript to `dist`
- `npm run watch` – TypeScript watch mode
- `npm run clean` – Remove `dist`
- `npm start` – Run Azure Functions (`func start`)
- `npm test` – Run Vitest
- `npm run test:coverage` – Run tests with coverage and open HTML report
- `npm run lint` – Run ESLint
- `npm run plop` – Run generators for environment variable management

## Testing

```bash
npm run lint
npm run build
npm test
```

The CI workflow also validates test TypeScript config (`tsc -p tests`).

## GitHub Actions

This repo has two workflows:

### 1) Test Workflow (`.github/workflows/test.yaml`)

**Trigger:** `pull_request`, `workflow_dispatch`

Runs:

1. Checkout
2. Setup Node 22 + npm cache
3. `npm install`
4. `tsc -p tests`
5. `npm run lint -- --max-warnings 0`
6. `npm run build`
7. `npm test`

### 2) Deploy Workflow (`.github/workflows/deploy.yaml`)

**Trigger:**

- `push` to `main`
- `workflow_dispatch` with optional inputs:
  - `id` (IaC deployment identifier)
  - `env` (`nonprod` or `prod`)

What it does:

1. Builds app (`npm install`, `npm run build`, `npm prune --omit=dev`)
2. Checks out the IaC repo (`ordinal-fomojis/ProjectAlkanes-IAC`)
3. Reads Terraform output to resolve target Function App names
4. Deploys to non-prod Function App (always attempted, `continue-on-error: true`)
5. Deploys to prod Function App only when workflow conditions match (`main` + manual `env=prod`)

### Required GitHub Repository Configuration

Repository **Variables**:

- `AZURE_CLIENT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`

Repository **Secrets**:

- `ALKANES_IAC_PAT` (used to check out private IaC repo)

Also ensure Azure federated credentials are configured for GitHub OIDC login (`azure/login@v2`).

## Deployment Notes

- Files/folders excluded from deployment are controlled by `.funcignore`.
- This project uses Terraform outputs from the IaC repository to resolve Function App names at deploy time.

## Project Structure

```text
src/
  functions/      # Azure timer trigger registrations
  jobs/           # Core job logic
  database/       # MongoDB collections and sync helpers
  utils/          # RPC/API helpers, parsing, logging, mapping
tests/            # Vitest test suite
.github/workflows/
  test.yaml       # CI checks
  deploy.yaml     # Azure deploy pipeline
```
