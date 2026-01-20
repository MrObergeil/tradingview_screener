# Agent Instructions

**IMPORTANT: Read this file first before doing any work on this codebase.**

## Skills

Check the `skills/` folder for custom skills that extend agent capabilities. **Review applicable skills before starting work.**

### Available Skills & When to Use

| Skill | Use When | Project Relevance |
|-------|----------|-------------------|
| **react-best-practices** | Writing/reviewing React components, optimizing performance, preventing re-renders | **HIGH** - Results table, real-time updates, large datasets |
| **frontend-responsive-ui** | Building layouts, tables, mobile navigation, breakpoint styles | **HIGH** - Mobile support required per spec |
| **frontend-design** | Creating distinctive UI, avoiding generic aesthetics, polish phase | **MEDIUM** - Dashboard design, visual identity |
| **agent-browser** | E2E testing, browser automation, form testing | **LOW** - Phase C testing |
| **read-github-docs** | Looking up library documentation via gitmcp.io | **UTILITY** - As needed |

### Skills by Project Phase

**Phase A (MVP - Current):**
- `frontend-responsive-ui` - Results table must work on mobile
- `react-best-practices` - Optimize table rendering for large result sets

**Phase B (Persistence):**
- `react-best-practices` - Efficient state management with SQLite data

**Phase C (Alerts & Polish):**
- `frontend-design` - Polish UI, create distinctive look
- `agent-browser` - E2E testing of alert flows

### Skill Application Rules

1. **Before creating React components**: Read `react-best-practices/SKILL.md`
   - Use `useCallback` for event handlers passed to children
   - Use `useMemo` for expensive computations
   - Avoid re-renders with proper dependency arrays

2. **Before building layouts**: Read `frontend-responsive-ui/SKILL.md`
   - Start mobile-first (320-375px)
   - Use Tailwind breakpoints: `sm:640px`, `md:768px`, `lg:1024px`
   - Touch targets minimum 44x44px

3. **For UI polish**: Read `frontend-design/SKILL.md`
   - Choose distinctive fonts (avoid Inter, Arial)
   - Commit to a clear aesthetic direction
   - Use CSS variables for theming

```
skills/
├── agent-browser/           # Browser automation CLI
├── frontend-design/         # Distinctive UI patterns
├── frontend-responsive-ui/  # Mobile-first responsive
├── react-best-practices/    # React/Next.js performance (45 rules)
└── read-github-docs/        # GitHub docs via gitmcp.io
```

## Required Reading

Before making ANY changes to this project, you MUST read the following files in order:

1. **`docs/spec_v2.md`** - Full project specification
   - Architecture decisions
   - API contracts
   - Database schema
   - Feature requirements
   - Decision log with rationale

2. **`docs/tv-screener-implementation-plan.md`** - Implementation plan
   - Sprint breakdown with tasks
   - Plan Mode → Build Mode workflow
   - Testing strategy
   - Current progress

3. **`docs/progress.txt`** - Learning log
   - Completed tasks and learnings
   - Gotchas and warnings
   - Decisions made during implementation

## Workflow

This project follows a **Plan Mode → Build Mode** workflow:

### PLAN MODE (Before each task)
- Explain your approach (files to create/modify)
- Get user feedback
- Discuss and iterate until agreed
- **NO CODE EDITS** in this mode

### BUILD MODE (After agreement)
- Implement the agreed approach
- Write tests
- Verify functionality
- **APPEND learnings to `docs/progress.txt`**
- Report completion

## Project Structure

```
tradingview_screener/
├── AGENTS.md                  # This file - read first!
├── skills/                    # Custom skills for agents
│   ├── react-best-practices/  # React performance (45 rules)
│   ├── frontend-responsive-ui/# Mobile-first layouts
│   ├── frontend-design/       # Distinctive UI patterns
│   ├── agent-browser/         # Browser automation
│   └── read-github-docs/      # GitHub docs fetching
├── screener-service/          # Python FastAPI microservice
│   ├── src/
│   │   ├── main.py           # Entry point
│   │   ├── routes.py         # /health, /scan endpoints
│   │   ├── screener.py       # tradingview-screener wrapper
│   │   └── models.py         # Pydantic schemas
│   └── requirements.txt
├── app/                       # TypeScript application
│   ├── src/
│   │   ├── server/           # Fastify backend (port 3000)
│   │   │   ├── index.ts      # Server entry
│   │   │   ├── routes/       # API routes
│   │   │   └── services/     # screenerClient
│   │   └── client/           # React frontend (port 5173)
│   │       ├── App.tsx       # Main app
│   │       ├── components/   # React components
│   │       ├── hooks/        # Custom hooks
│   │       └── api/          # API client
│   └── package.json
└── docs/                      # Documentation
    ├── spec_v2.md            # Full specification
    ├── tv-screener-implementation-plan.md
    ├── progress.txt          # Learning log (append-only)
    └── planner.md            # Planning template
```

## Key Decisions

- **Architecture**: Python (FastAPI) + TypeScript (Fastify/React)
- **Database**: SQLite (added in Phase B, not MVP)
- **MVP**: In-memory first, persistence later
- **Testing**: Tests written per task

## Do NOT

- Skip reading the spec before making changes
- Make changes without entering Plan Mode first
- Overwrite `progress.txt` (append only)
- Implement features not in the current sprint
