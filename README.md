# opencode-autopilot

Autonomous task orchestration for OpenCode — centralized backlog, auto-dispatch, session lifecycle, telemetry.

> Stop being the scheduler. Define the work, let the machine manage the queue.

## What It Does

- **Centralized backlog** — One task queue across all projects
- **Auto-dispatch** — Picks next task, creates session, sends prompt
- **Completion monitoring** — Detects when sessions finish, chains next task
- **Session lifecycle** — Auto-cleans stale sessions, tags idle/WIP, compacts for speed
- **Daily limits** — Configurable cap to prevent runaway credit burn
- **Telemetry** — Track dispatched, completed, blocked, tasks/day, avg duration

## Install

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "plugin": ["opencode-autopilot"]
}
```

## Usage

### Create a plan
Type `/plan` in any session — the agent analyzes your project and creates a prioritized backlog.

### Monitor
- `/backlog` — See task statuses
- `/stats` — Telemetry (dispatched, completed, rate, duration)
- `/next` — Force-dispatch next task

### How it works
```
/plan → backlog.json
          ↓
autopilot (every 60s) → picks "ready" task
          ↓
creates session → sends prompt with constraints
          ↓
agent works → goes idle → autopilot marks "done"
          ↓
next task auto-dispatched
```

## Configuration

Create `~/.local/share/opencode/orchestrator/config.json`:

```json
{
  "maxConcurrent": 2,
  "dailyTaskLimit": 10,
  "maxTasksPerPlan": 15,
  "autoDispatch": true,
  "maxSessionsPerProject": 3,
  "compactAfterMessages": 20,
  "notifications": {
    "onComplete": true,
    "onBlocked": true,
    "sound": false
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxConcurrent` | 2 | Max sessions working at once |
| `dailyTaskLimit` | 10 | Max tasks dispatched per day (resets at midnight) |
| `maxTasksPerPlan` | 15 | Max tasks a /plan can create |
| `autoDispatch` | true | Set false to only dispatch via /next |
| `maxSessionsPerProject` | 3 | Auto-prune excess sessions |
| `compactAfterMessages` | 20 | Auto-compact sessions above this |

## Task Constraints

Every dispatched task includes these guardrails in the prompt:
- Stay focused on THIS task only — do not expand scope
- Do not refactor surrounding code unless the task requires it
- Do not add features, tests, or docs beyond what is specified
- Commit with conventional commits after each functional step

## Telemetry

Metrics are stored at `~/.local/share/opencode/orchestrator/metrics.json` and track:
- Tasks dispatched, completed, blocked per day
- Duration per task (dispatch → completion)
- Completion rate
- Daily limit hits
- Breakdown by project

Run `/stats` to see the report.

## Philosophy

This plugin implements the [Task Orchestration pattern](https://github.com/LucasSantana-Dev/ai-dev-toolkit/blob/main/patterns/task-orchestration.md) from the AI Dev Toolkit.

The key insight: **you should define the work and its boundaries, not manage the queue**. The orchestrator handles dispatch, monitoring, and chaining. You handle planning and review.

## License

MIT
