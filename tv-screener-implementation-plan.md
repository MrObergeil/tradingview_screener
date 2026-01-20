# Plan: TV Screener+ Implementation

**Generated**: January 2025
**Estimated Complexity**: High
**Reference**: spec_v2.md

---

## Workflow: Plan Mode → Build Mode

> **IMPORTANT**: Follow this workflow for EVERY task/step in this plan.

### Before Each Task: PLAN MODE

1. **Enter Plan Mode** - No code edits allowed
2. **Explain the approach**:
   - What files will be created/modified
   - What the implementation will look like
   - Any decisions or trade-offs to consider
3. **Get feedback** from user
4. **Discuss and iterate** until we agree on the approach
5. **Confirm readiness** to proceed

### After Agreement: BUILD MODE

1. **Switch to Build Mode** - Editing enabled
2. **Implement** the agreed-upon approach
3. **Write tests** as specified
4. **Verify** the task works as expected
5. **Report completion** with summary of what was done

### Example Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  PLAN MODE                                                  │
│  "For Task 1.2, I'll create the FastAPI health endpoint.    │
│   I plan to:                                                │
│   - Create main.py with FastAPI app                         │
│   - Create routes.py with /health endpoint                  │
│   - Return {"status": "ok", "timestamp": "..."}             │
│   Does this approach work for you?"                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    [User Feedback]
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  BUILD MODE                                                 │
│  "Agreed. Switching to build mode..."                       │
│  [Creates files, writes code, runs tests]                   │
│  "Task 1.2 complete. Health endpoint working at :8001"      │
└─────────────────────────────────────────────────────────────┘
```

### Why This Workflow?

- **Prevents wasted effort** - Get alignment before writing code
- **Encourages collaboration** - User input shapes implementation
- **Catches issues early** - Problems found in planning, not debugging
- **Maintains quality** - Deliberate decisions, not rushed code

---

## Overview

Build a TradingView screener wrapper with a Python backend (FastAPI + tradingview-screener library) and TypeScript/React frontend. The implementation follows an MVP-first approach:

1. **Phase A**: Basic API + UI to fetch and display data for specific tickers
2. **Phase B**: Add persistence (SQLite) and core features
3. **Phase C**: Alerts, scheduling, and polish

This plan uses small sprints (2-3 tasks each) with tests per task for rapid iteration.

## Prerequisites

- Python 3.11+ installed
- Node.js 20 LTS installed
- Git configured
- Code editor with TypeScript support
- Basic understanding of FastAPI, React, and the tradingview-screener library

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│                     localhost:5173                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                  Fastify Backend (Node.js)                   │
│                     localhost:3000                           │
│              - Proxy to Python service                       │
│              - Business logic (momentum scoring)             │
│              - SQLite database (Phase B+)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                Python Screener Service (FastAPI)             │
│                     localhost:8001                           │
│              - tradingview-screener wrapper                  │
│              - /scan, /fields, /validate-ticker              │
└─────────────────────────────────────────────────────────────┘
```

---

# PHASE A: MVP - Basic Scanning

Goal: Get data flowing from TradingView API to a visible UI table.

---

## Sprint 1: Project Setup & Python Service Foundation

**Goal**: Set up project structure and get Python service returning data from TradingView API.

**Demo/Validation**:
- Run `curl http://localhost:8001/health` → returns `{"status": "ok"}`
- Run `curl -X POST http://localhost:8001/scan` with test payload → returns stock data

### Task 1.1: Initialize Project Structure

- **Location**: Repository root
- **Description**: Create the monorepo folder structure as defined in spec_v2.md
- **Perceived Complexity**: 2
- **Dependencies**: None
- **Steps**:
  1. Create `screener-service/` directory with `src/` subdirectory
  2. Create `app/` directory with `src/server/` and `src/client/` subdirectories
  3. Create placeholder files: `screener-service/requirements.txt`, `app/package.json`
  4. Create `.gitignore` for Python and Node artifacts
- **Acceptance Criteria**:
  - Folder structure matches spec_v2.md architecture diagram
  - `.gitignore` excludes `__pycache__`, `node_modules`, `.env`, `*.db`
- **Validation**:
  - `tree -L 3` shows correct structure
  - Manual verification of .gitignore contents

### Task 1.2: Implement Python Health Endpoint

- **Location**: `screener-service/src/`
- **Description**: Set up FastAPI with a basic health check endpoint
- **Perceived Complexity**: 2
- **Dependencies**: Task 1.1
- **Steps**:
  1. Create `requirements.txt` with FastAPI, uvicorn, pydantic, python-dotenv
  2. Create `screener-service/src/config.py` with settings (port, log level)
  3. Create `screener-service/src/main.py` with FastAPI app initialization
  4. Create `screener-service/src/routes.py` with `/health` endpoint
  5. Add startup script or instructions to run with uvicorn
- **Acceptance Criteria**:
  - `GET /health` returns `{"status": "ok", "timestamp": "<ISO timestamp>"}`
  - Server starts on port 8001
- **Validation**:
  - Test: `pytest` with test for health endpoint
  - Manual: `curl http://localhost:8001/health`

### Task 1.3: Implement /scan Endpoint with tradingview-screener

- **Location**: `screener-service/src/`
- **Description**: Create the core scan endpoint that queries TradingView
- **Perceived Complexity**: 5
- **Dependencies**: Task 1.2
- **Steps**:
  1. Add `tradingview-screener>=3.0.0` to requirements.txt
  2. Create `screener-service/src/models.py` with Pydantic models (ScanRequest, ScanResponse, Filter)
  3. Create `screener-service/src/screener.py` with wrapper class for tradingview-screener library
  4. Add `POST /scan` route in `routes.py`
  5. Handle basic error cases (invalid fields, API errors)
- **Acceptance Criteria**:
  - `POST /scan` accepts columns, filters, limit, orderBy
  - Returns `{totalCount, results[], timestamp, duration_ms}`
  - Gracefully handles API errors with proper HTTP status codes
- **Validation**:
  - Test: Unit tests for screener wrapper, integration test for /scan
  - Manual: `curl -X POST http://localhost:8001/scan -H "Content-Type: application/json" -d '{"columns": ["name", "close", "volume"], "limit": 5}'`

---

## Sprint 2: TypeScript Backend Setup

**Goal**: Set up Fastify backend that proxies to Python service.

**Demo/Validation**:
- Run `curl http://localhost:3000/api/health` → returns ok
- Run `curl -X POST http://localhost:3000/api/scan` → returns data from Python service

### Task 2.1: Initialize TypeScript/Fastify Project

- **Location**: `app/`
- **Description**: Set up Node.js project with TypeScript and Fastify
- **Perceived Complexity**: 3
- **Dependencies**: Sprint 1 complete
- **Steps**:
  1. Initialize `package.json` with dependencies (fastify, typescript, tsx, @fastify/cors)
  2. Create `tsconfig.json` with strict mode, ES modules
  3. Create `app/src/server/index.ts` with Fastify initialization
  4. Add CORS configuration for local development
  5. Add dev script using `tsx watch`
- **Acceptance Criteria**:
  - `npm run dev:server` starts Fastify on port 3000
  - TypeScript compiles without errors
  - CORS allows requests from localhost:5173
- **Validation**:
  - Test: Basic server startup test
  - Manual: `curl http://localhost:3000` returns response

### Task 2.2: Create Screener Client Service

- **Location**: `app/src/server/services/`
- **Description**: Create service that calls Python screener API
- **Perceived Complexity**: 3
- **Dependencies**: Task 2.1
- **Steps**:
  1. Create `app/src/server/services/screenerClient.ts`
  2. Implement `scan()` method using fetch/ofetch
  3. Implement `getFields()` method
  4. Implement `validateTicker()` method
  5. Add proper TypeScript types for request/response
  6. Handle connection errors gracefully
- **Acceptance Criteria**:
  - Service correctly calls Python API endpoints
  - TypeScript types match API contracts in spec
  - Errors are caught and re-thrown with context
- **Validation**:
  - Test: Mock-based unit tests for screenerClient
  - Integration test with running Python service

### Task 2.3: Create Proxy Routes

- **Location**: `app/src/server/routes/`
- **Description**: Create API routes that proxy to Python service
- **Perceived Complexity**: 2
- **Dependencies**: Task 2.2
- **Steps**:
  1. Create `app/src/server/routes/screener.ts`
  2. Add `POST /api/scan` route
  3. Add `GET /api/fields` route
  4. Add `POST /api/validate-ticker` route
  5. Register routes in main server file
- **Acceptance Criteria**:
  - All routes proxy correctly to Python service
  - Request/response bodies are passed through correctly
  - Errors from Python service are forwarded with appropriate status codes
- **Validation**:
  - Test: Route tests with mocked screenerClient
  - Manual: Full flow test with both services running

---

## Sprint 3: Basic React UI - Ticker Input

**Goal**: Create minimal React UI with ticker input and scan button.

**Demo/Validation**:
- Open browser to localhost:5173
- Enter "AAPL, MSFT" in input field
- Click "Scan" button
- See data appear in browser (console or basic display)

### Task 3.1: Initialize React/Vite Project

- **Location**: `app/src/client/`
- **Description**: Set up React with Vite and Tailwind CSS
- **Perceived Complexity**: 3
- **Dependencies**: Sprint 2 complete
- **Steps**:
  1. Add Vite and React dependencies to package.json
  2. Create `vite.config.ts` with proxy to backend (port 3000)
  3. Create `app/src/client/main.tsx` entry point
  4. Create `app/src/client/App.tsx` with basic structure
  5. Set up Tailwind CSS (tailwind.config.js, postcss.config.js)
  6. Create `app/src/client/styles/index.css` with Tailwind imports
  7. Add `dev:client` script to package.json
- **Acceptance Criteria**:
  - `npm run dev:client` starts Vite on port 5173
  - React app renders "TV Screener+" heading
  - Tailwind classes work (test with a colored div)
  - API proxy to backend works
- **Validation**:
  - Manual: Open localhost:5173, see styled heading
  - Test: Basic component render test with Vitest

### Task 3.2: Create Ticker Input Component

- **Location**: `app/src/client/components/`
- **Description**: Build input component for entering ticker symbols
- **Perceived Complexity**: 3
- **Dependencies**: Task 3.1
- **Steps**:
  1. Create `app/src/client/components/TickerInput.tsx`
  2. Implement text input for comma-separated tickers
  3. Add "Scan" button
  4. Parse input into array of ticker symbols
  5. Add basic validation (non-empty)
  6. Style with Tailwind
- **Acceptance Criteria**:
  - User can enter multiple tickers separated by commas
  - "Scan" button is disabled when input is empty
  - Component emits array of tickers on submit
- **Validation**:
  - Test: Component tests for input handling, button state
  - Manual: Visual verification of styling

### Task 3.3: Create API Client & Connect to Backend

- **Location**: `app/src/client/api/`
- **Description**: Create frontend API client and wire up scan functionality
- **Perceived Complexity**: 3
- **Dependencies**: Task 3.2
- **Steps**:
  1. Create `app/src/client/api/client.ts` with typed fetch wrapper
  2. Implement `scan(tickers, columns)` function
  3. Create `app/src/client/hooks/useScreener.ts` with React Query or simple useState
  4. Connect TickerInput to useScreener hook in App.tsx
  5. Display results in console.log initially
  6. Add loading state indicator
- **Acceptance Criteria**:
  - Clicking "Scan" calls backend API
  - Loading spinner shows during request
  - Results logged to console
  - Errors displayed as alert/toast
- **Validation**:
  - Test: Hook tests with mocked fetch
  - Manual: Full flow test - enter tickers, click scan, see console output

---

## Sprint 4: Results Table Display

**Goal**: Display scan results in a data table with basic columns.

**Demo/Validation**:
- Enter tickers, click Scan
- See results in formatted table with columns: Ticker, Name, Price, Change%, Volume
- Table is scrollable if many results

### Task 4.1: Create Results Table Component

- **Location**: `app/src/client/components/`
- **Description**: Build table component to display scan results
- **Perceived Complexity**: 4
- **Dependencies**: Sprint 3 complete
- **Steps**:
  1. Create `app/src/client/components/ResultsTable.tsx`
  2. Define default columns: ticker, name, close, change%, volume
  3. Implement table header row
  4. Implement data rows with proper formatting (numbers, percentages)
  5. Add price direction indicator (green/red + badge)
  6. Style with Tailwind (borders, hover states)
  7. Handle empty state ("No results")
- **Acceptance Criteria**:
  - Table displays all result rows
  - Numbers are formatted appropriately (commas, decimals)
  - Price change shows color + percent badge
  - Empty state shows helpful message
- **Validation**:
  - Test: Component tests with mock data
  - Manual: Visual verification with real scan results

### Task 4.2: Add Column Sorting

- **Location**: `app/src/client/components/ResultsTable.tsx`
- **Description**: Enable sorting by clicking column headers
- **Perceived Complexity**: 3
- **Dependencies**: Task 4.1
- **Steps**:
  1. Add sortable header component with up/down indicators
  2. Implement client-side sorting logic
  3. Track current sort column and direction in state
  4. Apply sorting to results array before render
  5. Style active sort column
- **Acceptance Criteria**:
  - Clicking column header sorts by that column
  - Clicking again reverses sort direction
  - Sort indicator shows current sort state
- **Validation**:
  - Test: Sorting logic unit tests
  - Manual: Click various columns, verify sort order

### Task 4.3: Add Basic Filters UI

- **Location**: `app/src/client/components/`
- **Description**: Add simple filter inputs for price and volume
- **Perceived Complexity**: 4
- **Dependencies**: Task 4.2
- **Steps**:
  1. Create `app/src/client/components/BasicFilters.tsx`
  2. Add min/max inputs for price
  3. Add min input for volume
  4. Connect filters to scan request
  5. Update API client to include filters in request
  6. Style filter section with Tailwind
- **Acceptance Criteria**:
  - User can set price range (min/max)
  - User can set minimum volume
  - Filters are sent to API and applied server-side
  - Clear filters button resets to defaults
- **Validation**:
  - Test: Filter component tests
  - Manual: Apply filters, verify results match criteria

---

## Sprint 5: Fields Endpoint & Column Selection

**Goal**: Fetch available fields from API and allow column customization.

**Demo/Validation**:
- Open column selector dropdown
- See categorized list of available fields
- Select additional columns (RSI, MACD)
- See new columns appear in results table

### Task 5.1: Implement /fields Endpoint in Python Service

- **Location**: `screener-service/src/`
- **Description**: Create endpoint to list available fields with metadata
- **Perceived Complexity**: 4
- **Dependencies**: Sprint 4 complete
- **Steps**:
  1. Research tradingview-screener library for field enumeration
  2. Create field metadata mapping (name, displayName, type, category)
  3. Group fields into categories (Price, Volume, Technical, Fundamental)
  4. Add `GET /fields` endpoint in routes.py
  5. Cache field list (static data)
- **Acceptance Criteria**:
  - `/fields` returns list of all available fields
  - Each field has name, displayName, type, category
  - Categories are predefined and consistent
- **Validation**:
  - Test: Unit test for fields endpoint
  - Manual: `curl http://localhost:8001/fields | jq`

### Task 5.2: Create Column Selector Component

- **Location**: `app/src/client/components/`
- **Description**: Build dropdown for selecting which columns to display
- **Perceived Complexity**: 5
- **Dependencies**: Task 5.1
- **Steps**:
  1. Create `app/src/client/components/ColumnSelector.tsx`
  2. Fetch fields from API on mount
  3. Group fields by category in dropdown
  4. Implement multi-select with checkboxes
  5. Show selected columns as tags/chips
  6. Add "Reset to defaults" button
  7. Style with Tailwind
- **Acceptance Criteria**:
  - Dropdown shows all available fields grouped by category
  - User can select/deselect columns
  - Selected columns shown as removable chips
  - Default columns pre-selected on load
- **Validation**:
  - Test: Component tests for selection logic
  - Manual: Select various columns, verify UI updates

### Task 5.3: Dynamic Table Columns

- **Location**: `app/src/client/components/ResultsTable.tsx`
- **Description**: Update table to render selected columns dynamically
- **Perceived Complexity**: 3
- **Dependencies**: Task 5.2
- **Steps**:
  1. Accept columns prop in ResultsTable
  2. Update API call to request selected columns
  3. Render only selected columns in table
  4. Handle columns with nested data (e.g., MACD.macd)
  5. Format different field types appropriately
- **Acceptance Criteria**:
  - Table renders exactly the selected columns
  - API requests only selected columns
  - All field types display correctly
- **Validation**:
  - Test: Table render tests with various column configs
  - Manual: Change columns, verify table updates

---

# PHASE B: Persistence & Core Features

Goal: Add database persistence and implement watchlists, saved configs.

**NOTE**: This phase begins after Phase A is working and validated.

---

## Sprint 6: SQLite Setup & Schema

**Goal**: Set up SQLite database with initial schema.

**Demo/Validation**:
- Database file created at configured path
- Tables exist and can be queried
- Basic CRUD operations work

### Task 6.1: Set Up better-sqlite3

- **Location**: `app/src/server/db/`
- **Description**: Initialize SQLite database connection
- **Perceived Complexity**: 3
- **Dependencies**: Phase A complete
- **Steps**:
  1. Add better-sqlite3 to dependencies
  2. Create `app/src/server/db/index.ts` with connection setup
  3. Create database file in configurable location
  4. Add connection pooling/singleton pattern
  5. Add graceful shutdown handling
- **Acceptance Criteria**:
  - Database connection established on server start
  - Database file created if not exists
  - Connection properly closed on shutdown
- **Validation**:
  - Test: Database connection tests
  - Manual: Verify .db file created

### Task 6.2: Create Database Schema

- **Location**: `app/src/server/db/`
- **Description**: Implement schema from spec_v2.md
- **Perceived Complexity**: 4
- **Dependencies**: Task 6.1
- **Steps**:
  1. Create `app/src/server/db/schema.ts` with table definitions
  2. Implement tables: watchlists, watchlist_items, watchlist_item_tags
  3. Implement tables: screener_configs, user_preferences
  4. Implement tables: favorite_fields, keyboard_shortcuts
  5. Add migration system (simple version tracking)
  6. Run migrations on startup
- **Acceptance Criteria**:
  - All tables created per spec schema
  - Foreign keys properly configured
  - Migrations run automatically
- **Validation**:
  - Test: Schema creation tests
  - Manual: `sqlite3 tvscreener.db ".tables"`

### Task 6.3: Create Base Repository Pattern

- **Location**: `app/src/server/db/`
- **Description**: Create reusable database access patterns
- **Perceived Complexity**: 3
- **Dependencies**: Task 6.2
- **Steps**:
  1. Create `app/src/server/db/repositories/base.ts` with CRUD helpers
  2. Implement findById, findAll, create, update, delete methods
  3. Add TypeScript generics for type safety
  4. Handle common errors (not found, constraint violations)
- **Acceptance Criteria**:
  - Base repository provides typed CRUD operations
  - Errors are wrapped with helpful messages
  - Transactions supported
- **Validation**:
  - Test: Repository unit tests with test database

---

## Sprint 7: Watchlist Backend

**Goal**: Implement watchlist CRUD API endpoints.

**Demo/Validation**:
- Create watchlist via API
- Add tickers to watchlist
- Retrieve watchlist with items
- Delete watchlist

### Task 7.1: Watchlist Repository

- **Location**: `app/src/server/db/repositories/`
- **Description**: Create watchlist data access layer
- **Perceived Complexity**: 3
- **Dependencies**: Sprint 6 complete
- **Steps**:
  1. Create `app/src/server/db/repositories/watchlist.ts`
  2. Implement CRUD for watchlists table
  3. Implement CRUD for watchlist_items
  4. Implement tag management for items
  5. Add method to get watchlist with all items and tags
- **Acceptance Criteria**:
  - All watchlist operations work correctly
  - Items include notes and tags
  - Cascading deletes work
- **Validation**:
  - Test: Repository tests with test database

### Task 7.2: Watchlist API Routes

- **Location**: `app/src/server/routes/`
- **Description**: Create REST endpoints for watchlist management
- **Perceived Complexity**: 4
- **Dependencies**: Task 7.1
- **Steps**:
  1. Create `app/src/server/routes/watchlist.ts`
  2. Implement all routes per spec (GET, POST, PUT, DELETE)
  3. Add input validation with Zod or similar
  4. Handle errors with appropriate HTTP codes
  5. Register routes in main server
- **Acceptance Criteria**:
  - All endpoints match spec_v2.md API contract
  - Input validation rejects invalid requests
  - Errors return proper status codes and messages
- **Validation**:
  - Test: Route integration tests
  - Manual: Test all endpoints with curl/Postman

### Task 7.3: Watchlist Import/Export

- **Location**: `app/src/server/routes/watchlist.ts`
- **Description**: Add import and export functionality
- **Perceived Complexity**: 4
- **Dependencies**: Task 7.2
- **Steps**:
  1. Add `POST /api/watchlists/import` endpoint
  2. Implement parsers for CSV, JSON, plain text, TradingView format
  3. Add `GET /api/watchlists/:id/export` endpoint
  4. Support CSV and JSON export formats
  5. Handle duplicate tickers gracefully
- **Acceptance Criteria**:
  - Import accepts all four formats
  - Export produces valid CSV/JSON
  - Duplicate tickers are skipped with warning
- **Validation**:
  - Test: Import/export with sample files
  - Manual: Import a TradingView watchlist export

---

## Sprint 8: Watchlist Frontend

**Goal**: Build UI for managing watchlists.

**Demo/Validation**:
- View list of watchlists
- Create new watchlist
- Add tickers to watchlist
- See ticker notes and tags

### Task 8.1: Watchlist List View

- **Location**: `app/src/client/components/watchlist/`
- **Description**: Create component to display all watchlists
- **Perceived Complexity**: 3
- **Dependencies**: Sprint 7 complete
- **Steps**:
  1. Create `app/src/client/components/watchlist/WatchlistList.tsx`
  2. Fetch watchlists from API
  3. Display as cards with name, description, ticker count
  4. Add "Create New" button
  5. Add click handler to view watchlist details
- **Acceptance Criteria**:
  - All watchlists displayed
  - Card shows summary info
  - Empty state shows helpful message
- **Validation**:
  - Test: Component tests
  - Manual: Visual verification

### Task 8.2: Watchlist Detail View

- **Location**: `app/src/client/components/watchlist/`
- **Description**: Create component to view/edit a single watchlist
- **Perceived Complexity**: 4
- **Dependencies**: Task 8.1
- **Steps**:
  1. Create `app/src/client/components/watchlist/WatchlistDetail.tsx`
  2. Fetch watchlist with items
  3. Display ticker list with notes and tags
  4. Add ticker input with real-time validation
  5. Add inline editing for notes/tags
  6. Add delete ticker button
- **Acceptance Criteria**:
  - Shows all tickers with metadata
  - Can add new tickers
  - Can edit notes and tags inline
  - Can delete tickers
- **Validation**:
  - Test: Component interaction tests
  - Manual: Full CRUD flow test

### Task 8.3: Watchlist Import Modal

- **Location**: `app/src/client/components/watchlist/`
- **Description**: Create modal for importing watchlists
- **Perceived Complexity**: 3
- **Dependencies**: Task 8.2
- **Steps**:
  1. Create `app/src/client/components/watchlist/ImportModal.tsx`
  2. Add file upload dropzone
  3. Add text paste area
  4. Auto-detect format
  5. Show preview of tickers to import
  6. Submit import and show results
- **Acceptance Criteria**:
  - Can upload file or paste text
  - Shows preview before import
  - Reports success/failures after import
- **Validation**:
  - Test: Modal interaction tests
  - Manual: Import various formats

---

## Sprint 9: Screener Config Persistence

**Goal**: Save and load screener configurations.

### Task 9.1: Screener Config Repository & Routes

- **Location**: `app/src/server/`
- **Description**: Backend for saving screener configs
- **Perceived Complexity**: 3
- **Dependencies**: Sprint 6 complete
- **Steps**:
  1. Create `app/src/server/db/repositories/screenerConfig.ts`
  2. Create `app/src/server/routes/config.ts`
  3. Implement CRUD endpoints per spec
  4. Add `POST /api/configs/:id/run` to execute saved config
- **Acceptance Criteria**:
  - Configs saved with name, description, filters, columns
  - Configs can be retrieved and executed
- **Validation**:
  - Test: Repository and route tests

### Task 9.2: Save/Load Config UI

- **Location**: `app/src/client/components/`
- **Description**: UI for managing saved configurations
- **Perceived Complexity**: 4
- **Dependencies**: Task 9.1
- **Steps**:
  1. Add "Save Config" button to screener page
  2. Create save modal with name/description inputs
  3. Add config selector dropdown to load saved configs
  4. Populate filters/columns when config loaded
  5. Add delete config option
- **Acceptance Criteria**:
  - Current filters/columns can be saved
  - Saved configs appear in dropdown
  - Loading config populates the form
- **Validation**:
  - Test: UI interaction tests
  - Manual: Save, reload page, load config

---

## Sprint 10: User Preferences Persistence

**Goal**: Persist UI state across sessions.

### Task 10.1: Preferences Backend

- **Location**: `app/src/server/`
- **Description**: API for storing user preferences
- **Perceived Complexity**: 2
- **Dependencies**: Sprint 6 complete
- **Steps**:
  1. Create preferences repository (key-value store)
  2. Create `GET/PUT /api/preferences/:key` endpoints
  3. Add endpoints for favorite fields and keyboard shortcuts
- **Acceptance Criteria**:
  - Preferences can be stored and retrieved by key
  - Supports JSON values
- **Validation**:
  - Test: API tests

### Task 10.2: Preferences Frontend Integration

- **Location**: `app/src/client/`
- **Description**: Persist and restore UI state
- **Perceived Complexity**: 4
- **Dependencies**: Task 10.1
- **Steps**:
  1. Create preferences context/store
  2. Save selected columns on change
  3. Save sort preferences on change
  4. Save theme preference on change
  5. Restore all preferences on app load
  6. Add favorite fields functionality
- **Acceptance Criteria**:
  - Column selection persists across sessions
  - Sort order persists
  - Theme persists
  - Favorite fields shown first in selector
- **Validation**:
  - Test: Context tests
  - Manual: Change settings, refresh, verify restored

---

# PHASE C: Alerts, Scheduling & Polish

Goal: Implement alert system, scheduled scans, and polish the UI.

**NOTE**: This phase begins after Phase B is working and validated.

---

## Sprint 11: Alert Rules Backend

### Task 11.1: Alert Rules Repository & Routes
### Task 11.2: Alert Condition Evaluation Service
### Task 11.3: Alert History & Cooldown Tracking

---

## Sprint 12: Alert Rules Frontend

### Task 12.1: Alert Rules List & Form
### Task 12.2: Condition Builder Component
### Task 12.3: Alert History View

---

## Sprint 13: Browser Notifications

### Task 13.1: Notification Permission & Service Worker Setup
### Task 13.2: Push Notification Implementation
### Task 13.3: Optional Sound Alerts

---

## Sprint 14: Scheduler Service

### Task 14.1: Cron-based Scheduler Implementation
### Task 14.2: Scheduled Scan Management UI
### Task 14.3: Scan Queue & Overlap Handling

---

## Sprint 15: Momentum Scoring

### Task 15.1: Momentum Calculation Service
### Task 15.2: Per-Screener Momentum Config
### Task 15.3: Momentum Score Display & Badges

---

## Sprint 16: Advanced Filters

### Task 16.1: Nested AND/OR/NOT Filter Logic
### Task 16.2: Relative Value Input Mode
### Task 16.3: Filter Presets (Built-in + User)

---

## Sprint 17: Results Table Enhancements

### Task 17.1: Infinite Scroll Implementation
### Task 17.2: Chunk Loading with Progress
### Task 17.3: Ticker Detail Panel

---

## Sprint 18: Export & Clipboard

### Task 18.1: CSV Export
### Task 18.2: JSON Export
### Task 18.3: Copy to Clipboard

---

## Sprint 19: UI Polish

### Task 19.1: Dark Mode Implementation
### Task 19.2: Customizable Keyboard Shortcuts
### Task 19.3: Error Handling & Loading States

---

## Sprint 20: Dashboard & Stats

### Task 20.1: Stats Collection (Scan Activity)
### Task 20.2: Top Performers Tracking
### Task 20.3: Dashboard Page with Stats Display

---

## Testing Strategy

### Per-Task Testing
- Each task includes specific tests
- Unit tests for business logic
- Integration tests for API endpoints
- Component tests for UI

### End-of-Sprint Validation
- Manual testing of demo scenario
- Full flow testing with real TradingView data
- Performance check for response times

### Tools
- **Python**: pytest, pytest-asyncio
- **TypeScript/Node**: Vitest
- **React**: Vitest + React Testing Library
- **E2E** (optional): Playwright

---

## Potential Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| TradingView API rate limiting | Scans fail or slow | Implement caching, add backoff logic |
| tradingview-screener library changes | API breaks | Pin version, add integration tests |
| Browser notification permissions denied | Alerts don't work | Graceful fallback to in-app alerts |
| Large result sets cause performance issues | UI freezes | Chunk loading, virtual scrolling |
| SQLite file corruption | Data loss | Regular backups, WAL mode |

---

## Rollback Plan

### Per-Sprint Rollback
- Each sprint is a git branch
- If sprint fails, revert to previous sprint's commit
- Database migrations should be reversible

### Full Rollback
- Keep backup of database before major changes
- Document breaking changes in schema
- Tag releases for easy rollback

---

## Definition of Done

A task is complete when:
1. Code is written and compiles without errors
2. Tests pass (unit, integration as applicable)
3. Manual verification succeeds
4. Code is committed with descriptive message
5. No regressions in existing functionality

A sprint is complete when:
1. All tasks are done
2. Demo/validation checklist passes
3. Code is merged to main branch
4. No critical bugs remain

---

## Next Steps

1. Review and approve this plan
2. Begin Sprint 1: Project Setup & Python Service Foundation
3. Track progress using sprint checklist
4. Demo after each sprint before proceeding
