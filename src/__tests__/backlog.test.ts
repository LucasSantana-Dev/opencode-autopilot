import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  loadBacklog,
  saveBacklog,
  getNextTask,
  getActiveTasks,
  promoteNext,
  expireStale,
  genID,
  type Task,
  type Backlog,
} from "../backlog.js"

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: genID(),
    title: "Test task",
    description: "A test task for unit tests",
    directory: "/tmp/test",
    priority: "medium",
    status: "ready",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeBacklog(tasks: Task[], paused = false): Backlog {
  return { tasks, paused, version: 1 }
}

let tmpDir: string
let backlogPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "autopilot-test-"))
  backlogPath = join(tmpDir, "backlog.json")
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("loadBacklog", () => {
  it("returns empty backlog for missing file", () => {
    const b = loadBacklog(join(tmpDir, "missing.json"))
    expect(b.tasks).toEqual([])
    expect(b.paused).toBe(false)
  })

  it("returns empty backlog for invalid JSON", () => {
    const path = join(tmpDir, "bad.json")
    require("fs").writeFileSync(path, "not json")
    const b = loadBacklog(path)
    expect(b.tasks).toEqual([])
  })

  it("loads valid backlog", () => {
    const task = makeTask()
    saveBacklog(backlogPath, makeBacklog([task]))
    const b = loadBacklog(backlogPath)
    expect(b.tasks).toHaveLength(1)
    expect(b.tasks[0].id).toBe(task.id)
  })
})

describe("saveBacklog", () => {
  it("writes valid JSON to disk", () => {
    const backlog = makeBacklog([makeTask()])
    saveBacklog(backlogPath, backlog)
    const raw = JSON.parse(readFileSync(backlogPath, "utf-8"))
    expect(raw.tasks).toHaveLength(1)
    expect(raw.version).toBe(1)
  })
})

describe("getNextTask", () => {
  it("returns undefined for empty backlog", () => {
    expect(getNextTask(makeBacklog([]))).toBeUndefined()
  })

  it("returns undefined when no ready tasks", () => {
    const t = makeTask({ status: "backlog" })
    expect(getNextTask(makeBacklog([t]))).toBeUndefined()
  })

  it("returns the only ready task", () => {
    const t = makeTask({ status: "ready" })
    expect(getNextTask(makeBacklog([t]))?.id).toBe(t.id)
  })

  it("sorts by priority (critical before low)", () => {
    const low = makeTask({ status: "ready", priority: "low", createdAt: 1 })
    const critical = makeTask({ status: "ready", priority: "critical", createdAt: 2 })
    const result = getNextTask(makeBacklog([low, critical]))
    expect(result?.id).toBe(critical.id)
  })

  it("sorts by createdAt when same priority", () => {
    const older = makeTask({ status: "ready", priority: "high", createdAt: 100 })
    const newer = makeTask({ status: "ready", priority: "high", createdAt: 200 })
    const result = getNextTask(makeBacklog([newer, older]))
    expect(result?.id).toBe(older.id)
  })

  it("skips tasks with unmet dependencies", () => {
    const dep = makeTask({ id: "dep", status: "in_progress" })
    const blocked = makeTask({ status: "ready", dependsOn: "dep", priority: "critical" })
    const free = makeTask({ status: "ready", priority: "low" })
    const result = getNextTask(makeBacklog([dep, blocked, free]))
    expect(result?.id).toBe(free.id)
  })

  it("allows tasks when dependency is done", () => {
    const dep = makeTask({ id: "dep", status: "done" })
    const ready = makeTask({ status: "ready", dependsOn: "dep" })
    const result = getNextTask(makeBacklog([dep, ready]))
    expect(result?.id).toBe(ready.id)
  })

  it("allows tasks when dependency does not exist", () => {
    const orphan = makeTask({ status: "ready", dependsOn: "nonexistent" })
    const result = getNextTask(makeBacklog([orphan]))
    expect(result?.id).toBe(orphan.id)
  })
})

describe("getActiveTasks", () => {
  it("returns only in_progress tasks", () => {
    const active = makeTask({ status: "in_progress" })
    const ready = makeTask({ status: "ready" })
    const done = makeTask({ status: "done" })
    const result = getActiveTasks(makeBacklog([active, ready, done]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(active.id)
  })
})

describe("promoteNext", () => {
  it("returns false for missing parent", () => {
    saveBacklog(backlogPath, makeBacklog([]))
    expect(promoteNext(backlogPath, "nonexistent")).toBe(false)
  })

  it("promotes first backlog subtask to ready", () => {
    const sub = makeTask({ id: "sub1", status: "backlog" })
    const parent = makeTask({ id: "parent", subtasks: ["sub1"] })
    saveBacklog(backlogPath, makeBacklog([parent, sub]))

    expect(promoteNext(backlogPath, "parent")).toBe(true)

    const b = loadBacklog(backlogPath)
    expect(b.tasks.find((t) => t.id === "sub1")?.status).toBe("ready")
  })

  it("promotes to review when requiresReview is true", () => {
    const sub = makeTask({ id: "sub1", status: "backlog", requiresReview: true })
    const parent = makeTask({ id: "parent", subtasks: ["sub1"] })
    saveBacklog(backlogPath, makeBacklog([parent, sub]))

    promoteNext(backlogPath, "parent")

    const b = loadBacklog(backlogPath)
    expect(b.tasks.find((t) => t.id === "sub1")?.status).toBe("review")
  })

  it("marks parent done when all subtasks are non-backlog", () => {
    const sub = makeTask({ id: "sub1", status: "done" })
    const parent = makeTask({ id: "parent", subtasks: ["sub1"] })
    saveBacklog(backlogPath, makeBacklog([parent, sub]))

    expect(promoteNext(backlogPath, "parent")).toBe(false)

    const b = loadBacklog(backlogPath)
    expect(b.tasks.find((t) => t.id === "parent")?.status).toBe("done")
  })
})

describe("expireStale", () => {
  it("expires old backlog tasks", () => {
    const old = makeTask({ status: "backlog", createdAt: Date.now() - 100_000 })
    const fresh = makeTask({ status: "backlog", createdAt: Date.now() })
    saveBacklog(backlogPath, makeBacklog([old, fresh]))

    const count = expireStale(backlogPath, 50_000)
    expect(count).toBe(1)

    const b = loadBacklog(backlogPath)
    expect(b.tasks.find((t) => t.id === old.id)?.status).toBe("expired")
    expect(b.tasks.find((t) => t.id === fresh.id)?.status).toBe("backlog")
  })

  it("does not expire non-backlog tasks", () => {
    const old = makeTask({ status: "ready", createdAt: Date.now() - 100_000 })
    saveBacklog(backlogPath, makeBacklog([old]))

    const count = expireStale(backlogPath, 50_000)
    expect(count).toBe(0)
  })

  it("returns 0 for empty backlog", () => {
    saveBacklog(backlogPath, makeBacklog([]))
    expect(expireStale(backlogPath, 1000)).toBe(0)
  })
})

describe("genID", () => {
  it("generates unique IDs", () => {
    const a = genID()
    const b = genID()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^task_/)
  })
})
