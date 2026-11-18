# Bloom — Required Project Structure

Provided by the project owner alongside `refer.pdf` (the master build brief).
The implementation follows this layout; where the brief names additional files
(e.g. `docs/DECISIONS.md`) they are added without changing the layout.

```
bloom/
├── frontend/
│   └── src/
│       ├── components/  layouts/  pages/
│       ├── hooks/  services/  types/  utils/  styles/
│       └── pages: dashboard, planly, goals, analytics,
│                  content-studio, audience, brand-earnings
├── backend-java/
│   ├── src/main/java/com/bloom/
│   │   ├── config/  auth/  user/  social/  dashboard/  analytics/
│   │   ├── planly/  goals/  content/  audience/  brand/
│   │   └── common/  exception/
│   └── src/main/resources/
├── integration-node/
│   └── src/
│       ├── providers/  workers/  webhooks/  routes/
│       └── middleware/  config/
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── architecture.md
│   ├── database-design.md
│   ├── class-diagram.md
│   ├── api-documentation.md
│   └── development-roadmap.md
└── docker-compose.yml
```
