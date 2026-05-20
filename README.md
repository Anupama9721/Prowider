# Prowider — Mini Lead Distribution System

A full-stack Next.js app with PostgreSQL that implements smart lead allocation, real-time dashboard updates, and idempotent webhooks.

## Tech Stack
- **Frontend**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Real-time**: Server-Sent Events (SSE)
- **Concurrency**: Serializable transactions

---

## Setup Instructions

### 1. Clone & Install
```bash
git clone <repo-url>
cd prowider
npm install
```

### 2. Configure Database
```bash
cp .env.example .env.local
# Edit .env.local and set your PostgreSQL DATABASE_URL:
# DATABASE_URL="postgresql://user:password@localhost:5432/prowider_db"
```

### 3. Initialize Database
```bash
npm run setup
# This runs: prisma generate + prisma db push + seed
```

Or step by step:
```bash
npx prisma generate       # Generate Prisma client
npx prisma db push        # Push schema to DB
node prisma/seed.js       # Seed services, providers, allocation state
```

### 4. Run
```bash
npm run dev    # Development
npm run build && npm start  # Production
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home / overview |
| `/request-service` | Customer lead submission form |
| `/dashboard` | Provider dashboard (real-time) |
| `/test-tools` | Webhook testing panel |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/leads` | Create a new lead + auto-allocate |
| `GET` | `/api/leads` | List all leads |
| `GET` | `/api/leads/stream` | SSE stream for real-time updates |
| `GET` | `/api/providers` | List all providers with assignments |
| `GET` | `/api/services` | List all services |
| `POST` | `/api/webhook` | Payment webhook (quota reset) |
| `POST` | `/api/test-tools` | Bulk lead generation for testing |

---

## Allocation Algorithm

### Rules
- Each lead is assigned to **exactly 3 providers**
- **Mandatory assignments** (always first, if quota available):
  - Service 1 → Provider 1
  - Service 2 → Provider 5
  - Service 3 → Provider 1 + Provider 4
- **Remaining slots** filled from service-specific pools via **round-robin**

### Round-Robin Pools
- Service 1: [Provider 2, 3, 4]
- Service 2: [Provider 6, 7, 8]
- Service 3: [Provider 2, 3, 5, 6, 7, 8]

### How It Works
1. Mandatory providers are added first (if under quota)
2. `AllocationState` table stores a persistent `pointer` per service
3. Pool is filtered to eligible providers (not already assigned, under quota)
4. Starting from `pointer`, we pick needed providers round-robin
5. Pointer is advanced and saved atomically in the same transaction

This ensures fair distribution that:
- Persists across server restarts
- Respects monthly quota
- Never double-assigns a provider to the same lead
- Is deterministic (not random)

---

## Concurrency Handling

All lead creation runs inside a **Serializable** Prisma transaction:

```js
await prisma.$transaction(async (tx) => {
  // create lead
  // allocate providers (reads + writes allocation pointer)
}, { isolationLevel: 'Serializable' });
```

PostgreSQL's serializable isolation detects conflicting concurrent transactions and retries them automatically, ensuring:
- No two transactions can both read and write the same allocation pointer simultaneously
- Provider `leadsReceived` increments are atomic
- Duplicate phone+service leads are caught by a DB-level unique constraint

---

## Webhook Idempotency

The `/api/webhook` endpoint requires an `X-Idempotency-Key` header.

**Flow:**
1. Check `WebhookEvent` table for existing key
2. If found → return cached result, **no side effects**
3. If new → process event + insert key in same transaction

This means calling the webhook 100 times with the same key has the same effect as calling it once.

```bash
# Test idempotency manually:
KEY="unique-key-$(date +%s)"
curl -X POST /api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"eventType":"payment_confirmed"}'

# Call again — will return {idempotent: true}, no quota change
curl -X POST /api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"eventType":"payment_confirmed"}'
```

---

## Real-Time Dashboard

The dashboard at `/dashboard` connects to `/api/leads/stream` (SSE endpoint).

When a lead is created:
1. `POST /api/leads` completes the transaction
2. Calls `sseEmitter.emit('lead_assigned', {...})`
3. All connected dashboard clients receive the event instantly
4. Dashboard re-fetches provider data and highlights updated provider cards

Fallback: If SSE disconnects, `EventSource` auto-reconnects.

---

## Database Schema

```
services          — id, name
providers         — id, name, monthlyQuota, leadsReceived
leads             — id, name, phone, city, description, serviceId, createdAt
                    UNIQUE(phone, serviceId)
lead_assignments  — id, leadId, providerId, assignedAt
                    UNIQUE(leadId, providerId)
allocation_states — id, serviceId (UNIQUE), pointer
webhook_events    — id (idempotency key), eventType, payload, processedAt
```

---

## Deployment (Railway / Supabase / Render)

1. Set `DATABASE_URL` environment variable
2. Run `npm run setup` (or add it to build command)
3. `npm run build && npm start`

For Railway:
```
Build command: npm install && npm run setup && npm run build
Start command: npm start
```
