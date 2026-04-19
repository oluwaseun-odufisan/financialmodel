# Flour Mills — Project Finance Modeling System

Full-stack web application that replaces the Excel model `Flour Mills Model Version2_AO.xlsx` with a multi-user SaaS for the accounting team. Every formula, date convention, debt schedule, depreciation rule, and aggregation from the Excel has been translated into a pure JavaScript financial engine. Users can either load the **Flour Mills (Honeywell) preset** or **start a blank project** and enter every value themselves.

---

## What's in the box

```
financial-modeling-system/
├── README.md
├── backend/       Node + Express + MongoDB (required) + JWT auth
│                  → pure JS financial engine in services/financialEngine.js
│                  → Excel + PDF export
└── frontend/      Vite + React 19 + Tailwind + Recharts + TanStack
                   → 8 pages, project management, editable assumptions
```

---

## Feature tour

- **Project management** – create, open, duplicate, delete. Each user has private projects.
- **Two templates on creation**
  - **Flour Mills preset** – 3 MW Solar + BESS reference with ₦1.96 B BOQ pre-filled
  - **Start from scratch** – empty template, enter every value manually
- **Top-bar project switcher** – jump between projects at any time, see run status at a glance
- **Editable everywhere** – 77 assumption fields across 15 sections, live BOQ with auto-totals
- **One-click "Run Model"** – full recalculation across all tabs
- **Export** – branded `.xlsx` (7 sheets) and `.pdf` (executive summary) after every run
- **Dashboard** – 10 KPI cards + 7 charts (Revenue vs Opex, Cumulative Cash, DSCR, tariff curve, etc.)
- **Sensitivity analysis** – 9 scenarios on tariff / capex / opex with IRR, NPV, DSCR deltas

---

## Prerequisites

| | |
|---|---|
| Node.js | ≥ 18 (LTS recommended) |
| MongoDB | Atlas cluster **or** local MongoDB ≥ 6 |
| npm | ships with Node |

---

## Quick-start (local development)

### 1. Install dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure the backend

```bash
cd ../backend
cp .env.example .env
```

Edit `.env`:

```ini
MONGODB_URI=mongodb://127.0.0.1:27017/flour_mills
JWT_SECRET=$(openssl rand -hex 64)     # paste the result here
PORT=5000
```

> **MongoDB is required.** The server refuses to start without a reachable `MONGODB_URI`.
> Install locally with `brew install mongodb-community` (macOS), `apt install mongodb` (Ubuntu), or use a free **MongoDB Atlas** cluster (recommended for teams — see deployment section).

### 3. Start both services (in two terminals)

```bash
# Terminal 1 – backend
cd backend
npm start                               # → http://localhost:5000
```

```bash
# Terminal 2 – frontend
cd frontend
npm run dev                             # → http://localhost:5173
```

Open `http://localhost:5173`. Register your first user with any email + password, then create your first project.

---

## Production deployment

### Option A – MongoDB Atlas + single VM / container

This is the simplest path for a small accounting team.

**1. MongoDB**

1. Create a free cluster at https://cloud.mongodb.com
2. Add a database user and whitelist your server's IP
3. Copy the connection string (looks like `mongodb+srv://...`)

**2. Environment file on the server**

```ini
MONGODB_URI=mongodb+srv://<user>:<pw>@cluster.mongodb.net/flour_mills?retryWrites=true&w=majority
JWT_SECRET=<64+ char random string>
PORT=5000
CORS_ORIGIN=https://finance.yourcompany.com      # must match the frontend URL
```

**3. Build the frontend**

```bash
cd frontend
npm install
npm run build                            # outputs to frontend/dist/
```

**4. Serve**

Point any reverse proxy (Nginx, Caddy, Cloudflare, AWS ALB) at:

- `/api/*`  →  `http://localhost:5000` (the Node backend)
- everything else → `frontend/dist/` (static files)

Example `nginx.conf` snippet:

```nginx
server {
  listen 443 ssl http2;
  server_name finance.yourcompany.com;

  ssl_certificate     /etc/letsencrypt/live/finance.yourcompany.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/finance.yourcompany.com/privkey.pem;

  root /var/www/flour-mills/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;    # SPA fallback
  }
}
```

**5. Process manager**

Run the backend under `pm2` or systemd so it restarts on reboot:

```bash
npm install -g pm2
cd backend
pm2 start server.js --name flour-mills-api
pm2 save
pm2 startup                              # follow the printed instruction
```

### Option B – Docker / Docker Compose

```yaml
# docker-compose.yml
version: "3.9"
services:
  mongo:
    image: mongo:7
    volumes: [ mongo_data:/data/db ]
    restart: unless-stopped

  api:
    build: ./backend
    environment:
      MONGODB_URI: mongodb://mongo:27017/flour_mills
      JWT_SECRET: ${JWT_SECRET}
      PORT: 5000
      CORS_ORIGIN: http://localhost
    depends_on: [ mongo ]
    ports: [ "5000:5000" ]
    restart: unless-stopped

  web:
    build: ./frontend
    ports: [ "80:80" ]
    depends_on: [ api ]
    restart: unless-stopped

volumes:
  mongo_data:
```

With corresponding `Dockerfile` in each package. The backend `Dockerfile` is:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

---

## Environment variables reference

| Variable | Required | Example | Notes |
|---|---|---|---|
| `MONGODB_URI` | **yes** | `mongodb+srv://u:p@c.mongodb.net/flour_mills` | Server exits with clear error if missing/unreachable |
| `JWT_SECRET` | **yes** | `openssl rand -hex 64` | Must be long and random in production |
| `PORT` | no | `5000` | Backend listen port |
| `CORS_ORIGIN` | prod | `https://finance.flourmills.com` | Exact frontend origin, no trailing slash |

---

## Security checklist for production

- [ ] `JWT_SECRET` is at least 64 random characters, unique per environment
- [ ] `MONGODB_URI` uses TLS (`mongodb+srv://`) and credentials aren't committed
- [ ] Reverse proxy terminates HTTPS (Let's Encrypt / Cloudflare)
- [ ] `CORS_ORIGIN` is set to the exact frontend URL (not `*`)
- [ ] MongoDB network access is IP-whitelisted or in a private VPC
- [ ] Regular MongoDB backups (Atlas has these built-in)
- [ ] Process manager auto-restarts the backend (`pm2`, systemd, k8s, etc.)
- [ ] Logs are rotated

---

## How the financial engine maps to the Excel

### Sheet → Module

| Excel sheet | Module | Description |
|---|---|---|
| **Assumption** | `services/seedData.js` | Master input tree. Every value maps to its Excel cell in a comment (`J10`, `J43`, `G81`, etc.). |
| **BOQ** + **3MW BEME** | `computeCapex()` in the engine | Rolls line items into 8 depreciable buckets + VAT/contingency/management |
| **Deal Summary** | `buildKPIs()` | Target tariff, IRR, DSCR, payback |
| **M.Calculation** | `buildMonthlyCalculation()` | 123 months × ~25 rows: revenue, costs, capex drawdown, bridge + senior debt schedules, equity |
| **Depreciation** | `buildDepreciation()` | Yearly, straight-line, 7 asset classes × configurable lives |
| **Financials** | `buildFinancials()` | Yearly IS / BS / CF, balance check |

### Excel primitives reimplemented

`EOMONTH`, `EDATE`, `YEAR`, `MONTH`, `QUOTIENT`, `PMT`, `IPMT`, `PPMT`, `IRR`, `NPV` — identical sign convention and edge-case handling.

### Key formulas verified

- **Timeline** – `N1..N8` rows reproduced exactly (start, `EOMONTH`, year/month, day count, year counter, phase IFS)
- **Tariff escalation** – `(1 + rate)^trigger` where trigger increments each January on or after `year(J11 + escalationCommencement × 12)`
- **Bridge loan** – `PPMT` amortization with semi-annual interest billing (`J166 = 6`)
- **Senior debt** – Level-pay amortization over `tenorYears − principalMoratoriumYears`, semi-annual P&I (`J193 = 6`)
- **Depreciation per category** – `MIN(opening/life, closing − prev.cumulativeDep)` straight-line 10 years (`G105–G111`)
- **Tax** – Applies only after `taxHolidayEnd = J11 + 60 months` and when `PBT ≥ 0`

---

## Verifying the engine

Without starting the server:

```bash
cd backend
node -e "import('./services/financialEngine.js').then(m => import('./services/seedData.js').then(s => {
  const r = m.runModel(s.flourMillsPreset());
  console.log('Capex:', (r.kpis.totalCapex/1e6).toFixed(1)+'M',
              '| IRR:', (r.kpis.projectIRR*100).toFixed(1)+'%',
              '| DSCR:', r.kpis.avgDSCR.toFixed(2));
}))"
```

Expected output (Flour Mills preset):

```
Capex: 2332.8M | IRR: 78.1% | DSCR: 2.32
```

---

## API reference

All project endpoints require `Authorization: Bearer <JWT>`.

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name? }` | Returns `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` | Returns `{ token, user }` |
| GET | `/api/auth/me` | – | Current user |
| GET | `/api/projects` | – | Paginated list, newest first |
| POST | `/api/projects` | `{ projectName, template }` | `template` is `'flour_mills'` or `'blank'` |
| GET | `/api/projects/:id` | – | Full project |
| PUT | `/api/projects/:id` | `{ assumption?, projectName? }` | Saving clears the prior result |
| POST | `/api/projects/:id/run` | – | Executes engine, persists result |
| POST | `/api/projects/:id/duplicate` | `{ projectName? }` | Clone |
| DELETE | `/api/projects/:id` | – | Delete |
| GET | `/api/projects/:id/export/excel` | – | 7-sheet `.xlsx` download |
| GET | `/api/projects/:id/export/pdf` | – | Executive-summary `.pdf` download |
| GET | `/api/health` | – | `{ ok, db, time }` |

---

## Pages

| Route | Purpose |
|---|---|
| `/login` | Sign in / register |
| `/projects` | Grid of all projects with KPIs, create / duplicate / delete |
| `/` | Dashboard — 10 KPIs + 7 charts |
| `/assumptions` | 15-section form, 77 editable fields with Zod validation |
| `/boq` | Editable cost table with live VAT / contingency / management |
| `/monthly` | 123-row read-only Monthly Calculation (5 tabbed views) |
| `/depreciation` | Stacked chart + per-category schedules |
| `/financials` | Income Statement · Balance Sheet · Cash Flow (yearly) |
| `/reports` | 9-scenario sensitivity analysis + DSCR table |

---

## Design system

Strict palette, **no gradients anywhere**:

| Token | Hex | Use |
|---|---|---|
| Primary | `#312783` | Headers, buttons, primary chart series |
| Accent | `#36a9e1` | Accents, secondary series |
| Off-white | `#f8f9fa` | Backgrounds, stripes |
| Ink | `#111827` | Body text |
| Muted | `#6b7280` | Secondary text |
| Border | `#E5E7EB` | Hairlines |

---

## Known discrepancies vs the source Excel

The source workbook contains a small number of formula issues: `N23` references an empty cell; `O1` compares a date serial to the number `10`; the bridge-interest formula bills only one month per semi-annual period rather than six. The engine implements the **intended logic** (10 % escalation starting year 3, interest on the outstanding balance for the full 6-month period) rather than reproducing these bugs. See `services/financialEngine.js` comments for details; swapping to bug-faithful mode is a small localized change in `buildMonthlyCalculation` if ever needed for audit.

---

## Support & maintenance

- Each user's projects are isolated by `userId` on the server
- Results are persisted alongside assumptions; editing assumptions invalidates the cached result
- `PUT /api/projects/:id` automatically clears the prior run — users must click **Run Model** again
- Engine is pure JS with zero native dependencies — portable to any Node ≥ 18 runtime

---

## License

Proprietary. Internal use within Flour Mills / Honeywell.
