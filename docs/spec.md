# TV Screener+ Project Specification

**Version:** 0.3 (Implementation Ready)
**Date:** January 2025
**Status:** Ready for implementation

---

## 1. Project Overview

A TradingView screener wrapper/enhancer that allows:
1. Ingesting results from TradingView screeners via programmatic API
2. Triggering screeners with custom parameters from a simple UI
3. Periodic scans with browser-based alerts/notifications
4. Custom filters and momentum/trending logic not available in TradingView

### Target User
- Single user (you)
- Local deployment for prototype
- US equities focus

---

## 2. Architecture

### Hybrid Python + TypeScript (Option C)

**Why this approach:**
- Python service: Native access to `tradingview-screener` library
- TypeScript app: Type safety, better for UI/business logic
- Clean separation: Easy to swap data source later

```
tv-screener-plus/
├── docker-compose.yml
├── README.md
│
├── screener-service/           # Python microservice
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   └── src/
│       ├── __init__.py
│       ├── main.py             # FastAPI entry point
│       ├── routes.py           # API endpoints
│       ├── screener.py         # tradingview-screener wrapper
│       ├── models.py           # Pydantic request/response models
│       └── config.py           # Settings
│
├── app/                        # TypeScript main application
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   │
│   ├── src/
│   │   ├── server/             # Backend (Fastify)
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── routes/
│   │   │   │   ├── screener.ts
│   │   │   │   ├── watchlist.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   └── config.ts
│   │   │   ├── services/
│   │   │   │   ├── screenerClient.ts   # Calls Python service
│   │   │   │   ├── alertService.ts     # Browser push notifications
│   │   │   │   ├── schedulerService.ts # Cron-based scanning
│   │   │   │   └── momentumService.ts  # Custom scoring logic
│   │   │   ├── db/
│   │   │   │   ├── index.ts            # SQLite connection
│   │   │   │   ├── schema.ts           # Table definitions
│   │   │   │   └── migrations/
│   │   │   └── types/
│   │   │       └── index.ts
│   │   │
│   │   └── client/             # Frontend (React)
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── ScreenerForm.tsx
│   │       │   ├── ResultsTable.tsx
│   │       │   ├── WatchlistManager.tsx
│   │       │   ├── AlertConfig.tsx
│   │       │   └── MomentumScore.tsx
│   │       ├── hooks/
│   │       │   └── useScreener.ts
│   │       ├── api/
│   │       │   └── client.ts
│   │       └── styles/
│   │           └── index.css   # Tailwind
│   │
│   └── tests/
│
└── docs/
    ├── SPEC.md                 # This file
    └── tradingview-screener-research.txt
```

---

## 3. Technology Stack

### Python Screener Service
| Component | Choice | Version |
|-----------|--------|---------|
| Framework | FastAPI | 0.109+ |
| Screener | tradingview-screener | 3.0.0 |
| Server | Uvicorn | 0.27+ |
| Validation | Pydantic | 2.x |

### TypeScript Application
| Component | Choice | Version |
|-----------|--------|---------|
| Runtime | Node.js | 20 LTS |
| Language | TypeScript | 5.x |
| Backend Framework | Fastify | 4.x |
| Frontend Framework | React | 18.x |
| Build Tool | Vite | 5.x |
| Database | SQLite (better-sqlite3) | 9.x |
| Scheduler | node-cron | 3.x |
| HTTP Client | ofetch or native fetch | - |
| Testing | Vitest | 1.x |
| CSS | Tailwind CSS | 3.x |

---

## 4. Data Storage (SQLite)

### Why SQLite
- Single file, no server to run
- Better than JSON for querying
- Easy to backup (copy one file)
- Good enough for single-user prototype

### Schema

```sql
-- Watchlists
CREATE TABLE watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist items (tickers)
CREATE TABLE watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,  -- e.g., "AAPL" (simple symbol, no exchange prefix)
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, ticker)
);

-- Saved screener configurations
CREATE TABLE screener_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config JSON NOT NULL,  -- Full filter config as JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert rules
CREATE TABLE alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    rule_type TEXT NOT NULL,  -- 'screener' | 'watchlist' | 'ticker'
    target_id INTEGER,        -- screener_config_id or watchlist_id (nullable for ticker)
    target_ticker TEXT,       -- For single ticker alerts
    conditions JSON NOT NULL, -- Alert conditions
    cooldown_minutes INTEGER DEFAULT 60,
    last_triggered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom momentum/indicator configurations
CREATE TABLE momentum_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_default BOOLEAN DEFAULT 0,
    config JSON NOT NULL,  -- Weights, thresholds, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert history (for debugging/review)
CREATE TABLE alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSON,  -- Snapshot of data that triggered alert
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);
```

---

## 5. API Contracts

### Python Screener Service (Port 8001)

#### POST /scan
Run a screener query against TradingView.

**Request:**
```typescript
interface ScanRequest {
  markets?: string[];           // Default: ["america"]
  columns: string[];            // Fields to retrieve
  filters?: Filter[];           // Optional filters
  orderBy?: OrderBy;            // Optional sorting
  limit?: number;               // Default: 50, max: 1000
  offset?: number;              // For pagination
}

interface Filter {
  field: string;
  op: "gt" | "gte" | "lt" | "lte" | "eq" | "between" | "in";
  value: number | string | [number, number] | string[];
}

interface OrderBy {
  field: string;
  direction: "asc" | "desc";
}
```

**Response:**
```typescript
interface ScanResponse {
  totalCount: number;
  results: Record<string, any>[];  // Dynamic based on requested columns
  timestamp: string;               // ISO timestamp
}
```

**Example Request:**
```json
{
  "columns": ["name", "close", "volume", "RSI", "MACD.macd", "MACD.signal", "EMA20", "market_cap_basic", "relative_volume_10d_calc"],
  "filters": [
    { "field": "market_cap_basic", "op": "between", "value": [1000000000, 50000000000] },
    { "field": "relative_volume_10d_calc", "op": "gt", "value": 1.2 }
  ],
  "orderBy": { "field": "volume", "direction": "desc" },
  "limit": 100
}
```

#### GET /fields
List available fields with metadata.

**Response:**
```typescript
interface FieldsResponse {
  fields: Field[];
}

interface Field {
  name: string;
  displayName: string;
  type: "number" | "text" | "percent" | "price" | "time" | "bool";
  timeframes?: string[];  // Available timeframe variants
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{ "status": "ok", "timestamp": "2025-01-19T12:00:00Z" }
```

---

### TypeScript App Backend (Port 3000)

#### Screener Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/scan | Proxy to Python service + apply custom scoring |
| GET | /api/fields | Proxy to Python service |

#### Watchlist Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/watchlists | List all watchlists |
| POST | /api/watchlists | Create watchlist |
| GET | /api/watchlists/:id | Get watchlist with items |
| PUT | /api/watchlists/:id | Update watchlist |
| DELETE | /api/watchlists/:id | Delete watchlist |
| POST | /api/watchlists/:id/items | Add ticker to watchlist |
| DELETE | /api/watchlists/:id/items/:ticker | Remove ticker |
| POST | /api/watchlists/:id/scan | Scan watchlist tickers |

#### Screener Config Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/configs | List saved configs |
| POST | /api/configs | Save new config |
| GET | /api/configs/:id | Get config |
| PUT | /api/configs/:id | Update config |
| DELETE | /api/configs/:id | Delete config |
| POST | /api/configs/:id/run | Run saved config |

#### Alert Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/alerts | List alert rules |
| POST | /api/alerts | Create alert rule |
| PUT | /api/alerts/:id | Update alert rule |
| DELETE | /api/alerts/:id | Delete alert rule |
| POST | /api/alerts/:id/toggle | Enable/disable |
| GET | /api/alerts/history | Get alert history |

#### Momentum Config Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/momentum | List momentum configs |
| POST | /api/momentum | Create config |
| PUT | /api/momentum/:id | Update config |
| DELETE | /api/momentum/:id | Delete config |
| PUT | /api/momentum/:id/default | Set as default |

---

## 6. Custom Momentum/Trending Logic

### Momentum Score Calculation

Runs in TS app as post-processing on screener results.

```typescript
interface MomentumConfig {
  name: string;
  
  // Component weights (should sum to 100)
  weights: {
    rsiScore: number;        // e.g., 20
    macdScore: number;       // e.g., 25
    trendScore: number;      // e.g., 25
    volumeScore: number;     // e.g., 30
  };
  
  // RSI scoring
  rsi: {
    period: number;          // 14 (which RSI field to use)
    bullishMin: number;      // e.g., 50
    bullishMax: number;      // e.g., 70
    overbought: number;      // e.g., 70
    oversold: number;        // e.g., 30
  };
  
  // MACD scoring
  macd: {
    requireAboveSignal: boolean;
    requirePositive: boolean;
  };
  
  // Trend scoring (price vs moving averages)
  trend: {
    emaShort: number;        // e.g., 20
    emaLong: number;         // e.g., 50
    requireAboveShort: boolean;
    requireAboveLong: boolean;
    requireShortAboveLong: boolean;  // EMA20 > EMA50 (golden cross)
  };
  
  // Volume scoring
  // TODO: Verify `relative_volume_10d_calc` field exists in TradingView API during implementation
  volume: {
    relativeVolumeMin: number;  // e.g., 1.2
    relativeVolumeBonus: number; // e.g., 2.0 (extra points if above)
  };
}

// Default configuration
const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  name: "Default Momentum",
  weights: {
    rsiScore: 20,
    macdScore: 25,
    trendScore: 25,
    volumeScore: 30
  },
  rsi: {
    period: 14,
    bullishMin: 50,
    bullishMax: 70,
    overbought: 70,
    oversold: 30
  },
  macd: {
    requireAboveSignal: true,
    requirePositive: false
  },
  trend: {
    emaShort: 20,
    emaLong: 50,
    requireAboveShort: true,
    requireAboveLong: false,
    requireShortAboveLong: true
  },
  volume: {
    relativeVolumeMin: 1.2,
    relativeVolumeBonus: 2.0
  }
};

// Scoring function
function calculateMomentumScore(
  stock: StockData,
  config: MomentumConfig
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    rsi: 0,
    macd: 0,
    trend: 0,
    volume: 0
  };
  
  // RSI Score
  const rsi = stock[`RSI${config.rsi.period}`] ?? stock.RSI;
  if (rsi >= config.rsi.bullishMin && rsi <= config.rsi.bullishMax) {
    breakdown.rsi = config.weights.rsiScore;
  } else if (rsi > config.rsi.oversold && rsi < config.rsi.bullishMin) {
    breakdown.rsi = config.weights.rsiScore * 0.5;  // Partial score
  }
  
  // MACD Score
  const macdAboveSignal = stock['MACD.macd'] > stock['MACD.signal'];
  const macdPositive = stock['MACD.macd'] > 0;
  if (config.macd.requireAboveSignal && macdAboveSignal) {
    breakdown.macd += config.weights.macdScore * 0.6;
  }
  if (config.macd.requirePositive && macdPositive) {
    breakdown.macd += config.weights.macdScore * 0.4;
  } else if (!config.macd.requirePositive && macdAboveSignal) {
    breakdown.macd = config.weights.macdScore;
  }
  
  // Trend Score
  const emaShort = stock[`EMA${config.trend.emaShort}`];
  const emaLong = stock[`EMA${config.trend.emaLong}`];
  const price = stock.close;
  
  let trendPoints = 0;
  let trendChecks = 0;
  
  if (config.trend.requireAboveShort) {
    trendChecks++;
    if (price > emaShort) trendPoints++;
  }
  if (config.trend.requireAboveLong) {
    trendChecks++;
    if (price > emaLong) trendPoints++;
  }
  if (config.trend.requireShortAboveLong) {
    trendChecks++;
    if (emaShort > emaLong) trendPoints++;
  }
  
  if (trendChecks > 0) {
    breakdown.trend = (trendPoints / trendChecks) * config.weights.trendScore;
  }
  
  // Volume Score
  const relVol = stock.relative_volume_10d_calc;
  if (relVol >= config.volume.relativeVolumeBonus) {
    breakdown.volume = config.weights.volumeScore;
  } else if (relVol >= config.volume.relativeVolumeMin) {
    const ratio = (relVol - config.volume.relativeVolumeMin) / 
                  (config.volume.relativeVolumeBonus - config.volume.relativeVolumeMin);
    breakdown.volume = config.weights.volumeScore * (0.5 + ratio * 0.5);
  }
  
  const score = breakdown.rsi + breakdown.macd + breakdown.trend + breakdown.volume;
  
  return { score: Math.round(score), breakdown };
}
```

---

## 7. Alert System

### Alert Types

```typescript
type AlertRuleType = "screener" | "watchlist" | "ticker";

interface AlertCondition {
  field: string;          // e.g., "RSI", "momentumScore", "close"
  operator: "gt" | "gte" | "lt" | "lte";  // V1: threshold alerts only
  // TODO (V2): Add "crosses_above" | "crosses_below" operators (requires historical state tracking)
  value: number;
}

interface AlertRule {
  id: number;
  name: string;
  enabled: boolean;
  ruleType: AlertRuleType;
  targetId?: number;      // screener_config_id or watchlist_id
  targetTicker?: string;  // For single ticker alerts
  conditions: AlertCondition[];
  cooldownMinutes: number;
  lastTriggeredAt?: string;
}
```

### Notification Implementation (Browser Push)

```typescript
// Request permission on app load
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Browser doesn't support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// Send notification
function sendNotification(title: string, options: NotificationOptions): void {
  if (Notification.permission === "granted") {
    new Notification(title, options);
  }
}

// Example usage
sendNotification("🚀 Momentum Alert", {
  body: "NVDA hit momentum score 85 (RSI: 62, Volume: 2.1x)",
  icon: "/favicon.ico",
  tag: "momentum-alert-NVDA",  // Prevents duplicate notifications
});
```

---

## 8. Scheduler

### Periodic Scan Configuration

```typescript
interface ScheduledScan {
  id: string;
  name: string;
  enabled: boolean;
  cronExpression: string;  // e.g., "*/5 9-16 * * 1-5" (every 5 min during market hours)
  screenerConfigId?: number;
  watchlistId?: number;
  alertRuleIds: number[];  // Which alerts to check
}

// Default schedules
const DEFAULT_SCHEDULES = [
  {
    name: "Market Hours Scan",
    cronExpression: "*/5 9-16 * * 1-5",  // Every 5 min, 9am-4pm, Mon-Fri
    enabled: false
  },
  {
    name: "Pre-Market Check",
    cronExpression: "0 8 * * 1-5",  // 8am Mon-Fri
    enabled: false
  }
];
```

**Note:** Cron runs on server time. Configure timezone in app settings.

---

## 9. Frontend / UI / UX Design

> **NOTE:** This section is a placeholder. Frontend/UI/UX design will be planned and iterated on separately in a later phase. The component structure below is a rough outline only.

### Pages

1. **Dashboard** (`/`)
   - Quick stats (active alerts, watchlist count)
   - Recent alert history
   - Quick scan button

2. **Screener** (`/screener`)
   - Filter builder form
   - Results table with momentum scores
   - Save config button
   - Export results (CSV)

3. **Watchlists** (`/watchlists`)
   - List of watchlists
   - Create/edit/delete
   - Add tickers (with search/autocomplete)
   - Scan watchlist button

4. **Alerts** (`/alerts`)
   - List of alert rules
   - Create/edit/delete
   - Enable/disable toggle
   - Alert history log

5. **Settings** (`/settings`)
   - Momentum config editor
   - Scheduler management
   - Notification preferences

### Key Components

```
components/
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Layout.tsx
│
├── screener/
│   ├── FilterBuilder.tsx      # Dynamic filter form
│   ├── FilterRow.tsx          # Single filter condition
│   ├── FieldSelect.tsx        # Dropdown with field search
│   ├── ResultsTable.tsx       # Sortable data table
│   └── MomentumBadge.tsx      # Score display (color-coded)
│
├── watchlist/
│   ├── WatchlistCard.tsx
│   ├── WatchlistForm.tsx
│   ├── TickerSearch.tsx
│   └── TickerList.tsx
│
├── alerts/
│   ├── AlertRuleCard.tsx
│   ├── AlertRuleForm.tsx
│   ├── ConditionBuilder.tsx
│   └── AlertHistory.tsx
│
└── common/
    ├── Button.tsx
    ├── Input.tsx
    ├── Select.tsx
    ├── Table.tsx
    ├── Modal.tsx
    └── Toast.tsx
```

---

## 10. Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Project setup (monorepo structure, configs)
- [ ] Python service: basic `/scan` and `/fields` endpoints
- [ ] TS backend: Fastify setup, SQLite connection, schema
- [ ] TS backend: Proxy routes to Python service
- [ ] Verify end-to-end data flow

### Phase 2: Core Features (Week 2)
- [ ] Screener UI: filter builder, results table
- [ ] Momentum scoring service
- [ ] Watchlist CRUD (backend + UI)
- [ ] Save/load screener configs

### Phase 3: Alerts & Scheduling (Week 3)
- [ ] Alert rules CRUD (backend + UI)
- [ ] Browser notification integration
- [ ] Scheduler service with node-cron
- [ ] Alert history logging

### Phase 4: Polish (Week 4)
- [ ] UI improvements, loading states, error handling
- [ ] Settings page
- [ ] Documentation
- [ ] Testing

---

## 11. Configuration Files

### docker-compose.yml

```yaml
version: "3.8"

services:
  screener-service:
    build: ./screener-service
    ports:
      - "8001:8001"
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped

  app:
    build: ./app
    ports:
      - "3000:3000"
    environment:
      - SCREENER_SERVICE_URL=http://screener-service:8001
      - DATABASE_PATH=/data/tvscreener.db
    volumes:
      - app-data:/data
    depends_on:
      - screener-service
    restart: unless-stopped

volumes:
  app-data:
```

### Python requirements.txt

```
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.0.0
tradingview-screener>=3.0.0
python-dotenv>=1.0.0
```

### TypeScript package.json (partial)

```json
{
  "name": "tv-screener-plus",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "tsc && vite build",
    "test": "vitest"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "@fastify/static": "^7.0.0",
    "better-sqlite3": "^9.0.0",
    "fastify": "^4.0.0",
    "node-cron": "^3.0.0",
    "ofetch": "^1.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "zustand": "^4.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "concurrently": "^8.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 12. Environment Variables

### Python Service (.env)

```bash
LOG_LEVEL=info
# Optional: TradingView session cookie for real-time data
# TV_SESSION_ID=your_session_id_here
```

### TypeScript App (.env)

```bash
# Server
PORT=3000
SCREENER_SERVICE_URL=http://localhost:8001
DATABASE_PATH=./data/tvscreener.db

# App
NODE_ENV=development
```

---

## 13. Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Hybrid Python + TS | Native library access + type safety |
| Storage | SQLite | Simple, queryable, single file |
| UI Framework | React + Vite | Fast iteration, familiar ecosystem |
| CSS | Tailwind | Utility-first, quick prototyping |
| Notifications | Browser Push | Easiest, no external services |
| Scheduler | node-cron | Lightweight, runs in-process |
| Testing | Vitest | Fast, native TS support |
| Timeframes | 4h, daily, weekly | Prototype scope |
| Markets | US equities only | Prototype scope |
| Momentum fields | Fetch only when requested | Minimize API calls, fetch only what's needed |
| Alert operators (V1) | Threshold only (gt/lt/etc.) | Crossing operators deferred to V2 (needs state) |
| Scheduled scans | App must be open | No background daemon for V1 |
| Ticker input format | Simple symbol (e.g., `AAPL`) | No exchange prefix needed |
| Filter logic | AND + OR (nested) | Support both for flexible queries |
| Results table columns | Fixed defaults + fully customizable | User can add/remove any column |
| Development setup | Direct (Python + Node) | Docker added later for deployment |
| Frontend/UI/UX | Planned separately | Will iterate in dedicated phase |

---

## 14. Out of Scope (V2+)

- Multi-user support / authentication
- Production deployment (cloud hosting)
- Historical candle data / backtesting
- Intraday timeframes (< 4h)
- Email/Telegram/Discord notifications
- Import shared TradingView screener URLs
- Mobile app
- Real-time streaming updates

---

## 15. References

- [tradingview-screener Library Research](./tradingview-screener-research.txt)
- [tradingview-screener GitHub](https://github.com/shner-elmo/TradingView-Screener)
- [tradingview-screener Fields](https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Fastify Docs](https://fastify.dev/)
- [Vite Docs](https://vitejs.dev/)
- [better-sqlite3 Docs](https://github.com/WiseLibs/better-sqlite3)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | Jan 2025 | Initial draft |
| 0.2 | Jan 2025 | Final decisions: SQLite storage, browser notifications, full API contracts, momentum logic, UI components |
| 0.3 | Jan 2025 | Implementation planning: V1 simplifications (threshold alerts only, app-open scheduling), development setup (direct, no Docker), UI/UX marked for separate planning phase, ticker format simplified, nested filter logic confirmed |
