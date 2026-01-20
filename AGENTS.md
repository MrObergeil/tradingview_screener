# Agent Instructions

**IMPORTANT: Read this file first before doing any work on this codebase.**

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
├── screener-service/          # Python FastAPI microservice
│   ├── src/
│   └── requirements.txt
├── app/                       # TypeScript application
│   ├── src/
│   │   ├── server/           # Fastify backend
│   │   └── client/           # React frontend
│   └── package.json
└── docs/                      # Documentation
    ├── spec_v2.md            # Full specification
    ├── tv-screener-implementation-plan.md
    ├── progress.txt          # Learning log (append-only)
    ├── spec.md               # Original spec (historical)
    └── planner.md            # Planning template (reference)
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
