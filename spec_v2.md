# TV Screener+ Project Specification

**Version:** 1.0
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

### Hybrid Python + TypeScript

**Why this approach:**
- Python service: Native access to `tradingview-screener` library
- TypeScript app: Type safety, better for UI/business logic
- Clean separation: Easy to swap data source later

```
tv-screener-plus/
├── README.md
│
├── screener-service/           # Python microservice
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
│   │       ├── hooks/
│   │       ├── api/
│   │       ├── stores/
│   │       └── styles/
│   │
│   └── tests/
│
└── docs/
    ├── SPEC.md
    └── tradingview-screener-research.txt
```

### Development Setup
- **Direct development** (Python + Node.js running separately)
- Docker/containers added later for deployment
- Hot-reload enabled for both services

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
| State Management | Zustand | 4.x |

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
-- Note: Same ticker CAN exist in multiple watchlists
CREATE TABLE watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,  -- e.g., "AAPL" (simple symbol, no exchange prefix)
    notes TEXT,            -- User notes for this ticker
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, ticker)
);

-- Watchlist item tags
CREATE TABLE watchlist_item_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_item_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (watchlist_item_id) REFERENCES watchlist_items(id) ON DELETE CASCADE,
    UNIQUE(watchlist_item_id, tag)
);

-- Saved screener configurations
CREATE TABLE screener_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config JSON NOT NULL,           -- Full filter config as JSON
    momentum_config JSON,           -- Per-screener momentum config (optional override)
    is_preset BOOLEAN DEFAULT 0,    -- Built-in preset vs user-created
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
    sound_enabled BOOLEAN DEFAULT 0,
    sound_file TEXT,          -- Custom sound file path
    last_triggered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert cooldown tracking (per-rule-per-ticker)
CREATE TABLE alert_cooldowns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    last_triggered_at DATETIME NOT NULL,
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    UNIQUE(alert_rule_id, ticker)
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

-- Alert history (7 day retention)
CREATE TABLE alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSON,  -- Snapshot of data that triggered alert
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- User preferences and UI state
CREATE TABLE user_preferences (
    key TEXT PRIMARY KEY,
    value JSON NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Favorite fields (for field selector)
CREATE TABLE favorite_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0
);

-- Keyboard shortcuts
CREATE TABLE keyboard_shortcuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL UNIQUE,
    shortcut TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 1
);

-- Scan statistics (for dashboard)
CREATE TABLE scan_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT NOT NULL,  -- 'manual' | 'scheduled'
    config_id INTEGER,
    results_count INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Top performers tracking (for dashboard)
CREATE TABLE top_performers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    appearances INTEGER DEFAULT 1,
    highest_momentum_score INTEGER,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker)
);
```

### Data Retention
- **Alert history:** 7 days (auto-cleanup via scheduled job)
- **Scan stats:** 30 days
- **Top performers:** Rolling, updated on each scan

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
  filters?: FilterGroup;        // Optional filters with boolean logic
  orderBy?: OrderBy;            // Optional sorting
  limit?: number;               // Default: 50, max: 1000
  offset?: number;              // For pagination
}

// Supports AND/OR/NOT with 2 levels of nesting max
interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

interface FilterCondition {
  field: string;
  op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between" | "not_between" | "in" | "not_in";
  value: number | string | [number, number] | string[];
  negate?: boolean;  // NOT operator
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
  duration_ms: number;             // Scan duration
}
```

**Example Request:**
```json
{
  "columns": ["name", "close", "volume", "RSI", "MACD.macd", "MACD.signal", "EMA20", "market_cap_basic", "relative_volume_10d_calc"],
  "filters": {
    "operator": "AND",
    "conditions": [
      { "field": "market_cap_basic", "op": "between", "value": [1000000000, 50000000000] },
      {
        "operator": "OR",
        "conditions": [
          { "field": "relative_volume_10d_calc", "op": "gt", "value": 1.5 },
          { "field": "volume", "op": "gt", "value": 10000000 }
        ]
      }
    ]
  },
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
  categories: FieldCategory[];
}

interface Field {
  name: string;
  displayName: string;
  type: "number" | "text" | "percent" | "price" | "time" | "bool";
  category: string;
  timeframes?: string[];  // Available timeframe variants
}

interface FieldCategory {
  name: string;
  displayName: string;
  fields: string[];  // Field names in this category
}
```

#### POST /validate-ticker
Validate a ticker symbol exists.

**Request:**
```json
{ "ticker": "AAPL" }
```

**Response:**
```json
{ "valid": true, "name": "Apple Inc", "exchange": "NASDAQ" }
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
| GET | /api/fields | Proxy to Python service (cached) |
| POST | /api/validate-ticker | Real-time ticker validation |

#### Watchlist Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/watchlists | List all watchlists |
| POST | /api/watchlists | Create watchlist |
| GET | /api/watchlists/:id | Get watchlist with items |
| PUT | /api/watchlists/:id | Update watchlist |
| DELETE | /api/watchlists/:id | Delete watchlist |
| POST | /api/watchlists/:id/items | Add ticker to watchlist |
| PUT | /api/watchlists/:id/items/:id | Update ticker notes/tags |
| DELETE | /api/watchlists/:id/items/:id | Remove ticker |
| POST | /api/watchlists/:id/scan | Scan watchlist tickers |
| POST | /api/watchlists/import | Import watchlist (CSV/JSON/TXT/TV format) |
| GET | /api/watchlists/:id/export | Export watchlist |

#### Screener Config Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/configs | List saved configs (includes presets) |
| POST | /api/configs | Save new config |
| GET | /api/configs/:id | Get config |
| PUT | /api/configs/:id | Update config |
| DELETE | /api/configs/:id | Delete config (prompts if alerts depend on it) |
| POST | /api/configs/:id/run | Run saved config |
| POST | /api/configs/:id/preview | Preview mode (show what alerts WOULD trigger) |

#### Alert Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/alerts | List alert rules |
| POST | /api/alerts | Create alert rule |
| PUT | /api/alerts/:id | Update alert rule |
| DELETE | /api/alerts/:id | Delete alert rule |
| POST | /api/alerts/:id/toggle | Enable/disable |
| GET | /api/alerts/history | Get alert history (7 days) |

#### Preferences Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/preferences | Get all user preferences |
| PUT | /api/preferences/:key | Update preference |
| GET | /api/preferences/shortcuts | Get keyboard shortcuts |
| PUT | /api/preferences/shortcuts | Update keyboard shortcuts |
| GET | /api/preferences/favorites | Get favorite fields |
| PUT | /api/preferences/favorites | Update favorite fields |

#### Stats Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/stats/dashboard | Get dashboard stats (scans, top performers) |
| GET | /api/stats/top-performers | Get top performing tickers |

---

## 6. Custom Momentum/Trending Logic

### Momentum Score Calculation

Runs in TS app as post-processing on screener results.

**Key Decisions:**
- Momentum fields (RSI, MACD, EMA, etc.) are **only fetched when requested** by the user
- Each screener config can have its **own momentum configuration** (override)
- Default momentum config used when no per-screener config exists
- If required fields are missing from API response, **show stock with warning indicator** (incomplete data)
- Momentum formula will be **fully customizable in V2** (add any indicator)

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

// Scoring result includes data completeness indicator
interface MomentumResult {
  score: number;
  breakdown: ScoreBreakdown;
  dataComplete: boolean;      // False if any required field was missing
  missingFields: string[];    // List of missing fields
}
```

### Momentum Score Display
- **Number + color gradient** (0-100 scale)
- Color ranges: Red (0-30) -> Yellow (30-60) -> Green (60-100)

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
  soundEnabled: boolean;
  soundFile?: string;
}
```

### Alert Behavior
- **Cooldown scope:** Per-rule-per-ticker (same rule can't fire for same ticker within cooldown)
- **Notification grouping:** Group by ticker (single notification listing all triggered conditions for that ticker)
- **Sound alerts:** Optional, configurable per alert rule

### Notification Implementation

Browser Push + optional sound:

```typescript
interface AlertNotification {
  ticker: string;
  triggeredRules: {
    ruleName: string;
    conditions: string[];  // Human-readable triggered conditions
  }[];
  data: Record<string, any>;  // Current values
}

// Grouped notification example:
// Title: "NVDA Alert"
// Body: "Momentum Score > 80 (current: 85)\nRSI > 60 (current: 62)"
```

### Preview Mode
- "Test Run" shows what alerts **WOULD** trigger without actually triggering
- Useful for validating alert configurations

---

## 8. Scheduler

### Periodic Scan Configuration

```typescript
interface ScheduledScan {
  id: string;
  name: string;
  enabled: boolean;
  cronExpression: string;  // e.g., "*/5 9-16 * * 1-5" (every 5 min during market hours)
  timezone: string;        // User-selectable timezone
  screenerConfigId?: number;
  watchlistId?: number;
  alertRuleIds: number[];  // Which alerts to check
}
```

### Scheduler Behavior
- **Timezone:** User-selectable in settings (default: America/New_York for market alignment)
- **Overlap handling:** If scan takes longer than interval, **queue next scan** (don't skip or run parallel)
- **Background tabs:** Use **Service Worker** to maintain accurate timing despite browser throttling
- **App must be open:** Scheduled scans only run when app is open (no background daemon for V1)

### Concurrent Scans
- Multiple simultaneous scans allowed but **warn user** about potential rate limiting
- Display warning toast when starting concurrent scan

---

## 9. Frontend / UI / UX Design

> **NOTE:** Detailed UI/UX design will be planned in a separate iteration. This section outlines functional requirements and behavior.

### Theme
- **Light and dark mode** with manual toggle
- Persist theme preference

### Results Table

**Loading & Pagination:**
- **Infinite scroll** for navigating results
- **Chunk loading** for large result sets (load in batches of 100, show progress)
- Display progress indicator during scan (time doesn't matter if progress shown)

**Columns:**
- Fixed default columns (ticker, name, price, change%, volume, market cap)
- **Fully customizable** - user can add/remove any column
- Column selection persisted to database

**Visual Indicators:**
- **Price direction:** Color + percent badge (green/red with +/-X.XX%)
- **Momentum score:** Number + color gradient
- **Incomplete data:** Warning icon for stocks with missing fields

**Interactions:**
- Click ticker to open **detail panel** (TradingView-style local table with all retrieved columns, sortable/filterable)
- No quick-add to watchlist from results (go to watchlist page to add)

**Caching:**
- **Session cache (5 min)** - reuse results if less than 5 min old when navigating away and back

### Filter Builder

**Logic:**
- **Full boolean logic** (AND/OR/NOT)
- **2 levels of nesting max** - e.g., (A AND B) OR (C AND D)
- **Max 20 filters** per scan

**Value Input:**
- Support **both absolute and relative** input modes
- Absolute: exact numbers (> 1000000)
- Relative: shortcuts like "2x", "50%", "above average"
- Toggle between modes per filter

**Presets:**
- **Built-in presets** + user-created templates
- Built-in preset strategies TBD (will be decided during implementation)

### Field Selector
- **Favorites + categories** organization
- Pinned favorite fields at top
- Categorized groups below (Price, Volume, Technical, Fundamental, etc.)
- Search functionality

### Watchlists

**Behavior:**
- Same ticker **CAN exist in multiple** watchlists
- **Notes + tags** supported per ticker
- Invalid/delisted tickers: **Prompt user** to remove when detected during scan

**Import/Export:**
- **Full import/export** support
- Import formats: CSV, JSON, plain text (comma/newline separated), TradingView format
- Export formats: CSV, JSON

### Scan Results Export
- **CSV + JSON + clipboard** (all three options)

### Ticker Validation
- **Real-time validation** as user types
- Show validation status (valid/invalid/checking)

### Keyboard Shortcuts
- **Customizable shortcuts**
- Default shortcuts for common actions (refresh, save, new scan)
- Shortcut cheat sheet accessible via help

### UI State Persistence
- **Full persistence** to database
- Remember: selected columns, sort order, theme, last viewed page, filter configurations

### Error Handling
- **Full technical detail** in error messages
- Show API errors and stack traces for debugging
- Collapsible for cleaner UI when not needed

### Dashboard / Stats
- **Top performers** focus: frequently appearing tickers, highest momentum scores
- Scan activity stats available but secondary

---

## 10. Performance Requirements

### Concerns Addressed
- Scan speed (API dependent)
- UI responsiveness (virtual scrolling, efficient rendering)
- Memory usage (pagination, cleanup)

### Loading Strategy
- **Chunk loading** for large results (batches of 100)
- Show progress indicator during all async operations
- Acceptable scan time: any duration if progress is shown

### Caching
- Session cache (5 min) for scan results
- Field list cached on app load

---

## 11. Development Phases

### Phase 1: Foundation
- [ ] Project setup (monorepo structure, configs)
- [ ] Python service: basic `/scan`, `/fields`, `/validate-ticker` endpoints
- [ ] TS backend: Fastify setup, SQLite connection, schema
- [ ] TS backend: Proxy routes to Python service
- [ ] Verify end-to-end data flow

### Phase 2: Core Features
- [ ] Screener UI: filter builder with AND/OR/NOT, results table
- [ ] Momentum scoring service
- [ ] Watchlist CRUD (backend + UI)
- [ ] Watchlist import/export
- [ ] Save/load screener configs

### Phase 3: Alerts & Scheduling
- [ ] Alert rules CRUD (backend + UI)
- [ ] Browser notification integration
- [ ] Service worker for background timing
- [ ] Optional sound alerts
- [ ] Scheduler service with node-cron
- [ ] Alert history logging (7 day retention)
- [ ] Preview mode for alerts

### Phase 4: Polish
- [ ] UI persistence (columns, preferences, state)
- [ ] Customizable keyboard shortcuts
- [ ] Field favorites and categories
- [ ] Dashboard with top performers stats
- [ ] Dark mode toggle
- [ ] Export (CSV, JSON, clipboard)
- [ ] Error handling improvements
- [ ] Testing

---

## 12. Configuration Files

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

## 13. Environment Variables

### Python Service (.env)

```bash
LOG_LEVEL=info
PORT=8001
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

## 14. Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Hybrid Python + TS | Native library access + type safety |
| Storage | SQLite | Simple, queryable, single file |
| UI Framework | React + Vite | Fast iteration, familiar ecosystem |
| CSS | Tailwind | Utility-first, quick prototyping |
| Notifications | Browser Push + optional sound | Easiest, no external services |
| Scheduler | node-cron + Service Worker | Lightweight, accurate timing in browser |
| Testing | Vitest | Fast, native TS support |
| Timeframes | 4h, daily, weekly | Prototype scope |
| Markets | US equities only | Prototype scope |
| Development setup | Direct (Python + Node) | Docker added later for deployment |
| | | |
| **Data Handling** | | |
| Missing API data | Show with warning indicator | Include stocks but flag incomplete data |
| API failure | Immediate error toast | User retries manually |
| Result caching | Session cache (5 min) | Balance freshness vs performance |
| | | |
| **Alerts** | | |
| Alert operators (V1) | Threshold only (gt/lt/etc.) | Crossing operators deferred to V2 |
| Alert history retention | 7 days | Auto-cleanup older entries |
| Notification grouping | Group by ticker | Single notification per ticker with all conditions |
| Cooldown scope | Per-rule-per-ticker | Granular cooldown control |
| Sound alerts | Optional per rule | User preference |
| | | |
| **Filters** | | |
| Filter logic | AND/OR/NOT (full boolean) | Maximum flexibility |
| Nesting depth | 2 levels max | Balance power vs complexity |
| Max filters | 20 per scan | Prevent overly complex queries |
| Value input | Absolute + relative modes | Support both "1000000" and "2x average" |
| | | |
| **UI/UX** | | |
| Results pagination | Infinite scroll | Smooth browsing experience |
| Large result loading | Chunk loading (100 at a time) | Show progress, manageable memory |
| Ticker click action | Detail panel | TradingView-style expandable view |
| Price direction display | Color + percent badge | Clear visual feedback |
| Momentum score display | Number + color gradient | Simple but informative |
| Theme | Light + dark with toggle | User preference |
| UI state persistence | Full (to database) | Restore complete state on return |
| Error messages | Full technical detail | Debugging-friendly |
| | | |
| **Fields** | | |
| Field organization | Favorites + categories | Quick access + discoverability |
| Momentum fields | Fetch only when requested | Minimize API calls |
| | | |
| **Watchlists** | | |
| Duplicate tickers | Allowed across watchlists | AAPL can be in multiple lists |
| Invalid tickers | Prompt user to remove | User decides cleanup |
| Ticker notes | Notes + tags supported | Rich annotation |
| Ticker input format | Simple symbol (AAPL) | No exchange prefix needed |
| Ticker validation | Real-time as user types | Immediate feedback |
| Import formats | CSV, JSON, TXT, TradingView | Maximum compatibility |
| | | |
| **Screener Configs** | | |
| Momentum configs | Per-screener override | Different strategies per config |
| Filter presets | Built-in + user-created | Templates for common strategies |
| Delete with dependencies | Prompt user | Ask about dependent alerts |
| | | |
| **Scheduler** | | |
| Timezone | User-selectable | Flexibility for different users |
| Scan overlap | Queue next scan | Don't skip or run parallel |
| Background tabs | Service Worker | Accurate timing despite throttling |
| Concurrent scans | Warn but allow | User awareness of rate limits |
| Scheduled scans | App must be open | No background daemon for V1 |
| | | |
| **Other** | | |
| Keyboard shortcuts | Customizable | Power user support |
| Export formats | CSV + JSON + clipboard | Multiple options |
| Preview/test mode | Show what WOULD trigger | Validate configs without triggering |
| Dashboard focus | Top performers | Most actionable insight |

---

## 15. Out of Scope (V2+)

- Multi-user support / authentication
- Production deployment (cloud hosting)
- Historical candle data / backtesting
- **Historical scan data storage** (store all scans for analysis - configurable granularity)
- Intraday timeframes (< 4h)
- Email/Telegram/Discord notifications
- Import shared TradingView screener URLs
- Mobile app
- Real-time streaming updates
- **Offline mode** (view cached results when offline)
- **Crossing alert operators** (crosses_above, crosses_below)
- **Comparison features** (diff between scans, side-by-side)
- **Fully customizable momentum formula** (add any indicator)

---

## 16. References

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
| 0.3 | Jan 2025 | Implementation planning: V1 simplifications, development setup, UI/UX marked for separate planning |
| 1.0 | Jan 2025 | Comprehensive spec after detailed interview: full boolean filter logic, alert grouping/cooldowns, UI persistence, chunk loading, keyboard shortcuts, import/export, service worker, preview mode, stats dashboard, detailed behavior specifications |
