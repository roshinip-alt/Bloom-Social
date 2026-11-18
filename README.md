# bloom

A calm, structured workspace for creators: plan content, manage goals, understand performance across connected
Instagram, YouTube and TikTok accounts, and track brand collaborations.

**V1 modules:** Dashboard · Planly (calendar, daily plans, tasks, notes) · Goals · Analytics · Content Studio · Audience ·
Brand & Earnings · Settings / Connected accounts.

**V1 boundaries:** no Bloom sign-in (local workspaces only — do not deploy publicly with real data), no AI features, no
payment processing, no publishing to social platforms. Social accounts connect through each platform's official OAuth.

## Quick start

```bash
cp .env.example .env            # set INTERNAL_API_TOKEN; TOKEN_ENCRYPTION_KEY for live connections
docker compose up --build       # → http://localhost:8088
```

No Docker? Run the three services directly (embedded database, no install): see
[docs/local-development.md](docs/local-development.md#option-b--three-terminals-no-docker).

The app opens on a **demo workspace** with clearly labelled synthetic data. Switch to **My workspace** (top bar) to
connect real accounts.

## Repository layout

```
bloom/
├── Reference/          refer.pdf (master brief) · project-structure.md
├── frontend/           React + TypeScript + Vite + TanStack Query + Tailwind + Radix + Recharts
├── backend-java/       Spring Boot 3 / Java 21 modular monolith (com.bloom.*)
├── integration-node/   Express + TypeScript provider gateway (OAuth callbacks, adapters, webhooks)
├── database/           migrations/ (Flyway) · seeds/ (demo content)
├── docs/               architecture, database design, class diagrams, API, roadmap, decisions, integrations
└── docker-compose.yml
```

## Documentation

| Document | What's in it |
|---|---|
| [architecture.md](docs/architecture.md) | Components, Java↔Node contract, connection & sync sequence diagrams, data-correctness rules |
| [database-design.md](docs/database-design.md) | ER diagram, conventions, constraints, metric model |
| [class-diagram.md](docs/class-diagram.md) | Main classes and collaborations (Java, Node, frontend) |
| [api-documentation.md](docs/api-documentation.md) | All 84 `/api/v1` endpoints, error format; Swagger at `/api/v1/docs` |
| [integrations/](docs/integrations/README.md) | Per-provider scopes, endpoints, verification dates, developer-console setup |
| [local-development.md](docs/local-development.md) | Running, environment variables, tests, troubleshooting |
| [development-roadmap.md](docs/development-roadmap.md) | Status, limitations, external blockers, how to add app auth |
| [DECISIONS.md](docs/DECISIONS.md) | Choices made and why |
| [PROGRESS.md](docs/PROGRESS.md) | Build log |

## Checks

```bash
(cd backend-java && mvn test)                                                        # 32 tests
(cd integration-node && npm ci && npm run typecheck && npm run lint && npm test && npm run build)   # 46 tests
(cd frontend && npm ci && npm run typecheck && npm run lint && npm test && npm run build)           # 16 tests
```
