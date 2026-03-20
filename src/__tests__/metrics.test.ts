import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  loadMetrics,
  saveMetrics,
  recordMetric,
  getDispatchedToday,
} from "../metrics.js"

let tmpDir: string
let metricsPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "autopilot-metrics-"))
  metricsPath = join(tmpDir, "metrics.json")
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("loadMetrics", () => {
  it("returns empty metrics for missing file", () => {
    const m = loadMetrics(join(tmpDir, "missing.json"))
    expect(m.events).toEqual([])
    expect(m.startedAt).toBeGreaterThan(0)
  })

  it("returns empty metrics for invalid JSON", () => {
    require("fs").writeFileSync(metricsPath, "bad")
    const m = loadMetrics(metricsPath)
    expect(m.events).toEqual([])
  })
})

describe("recordMetric", () => {
  it("appends event with timestamp", () => {
    recordMetric(metricsPath, {
      type: "dispatched",
      taskID: "t1",
      taskTitle: "Test",
      directory: "/tmp",
      priority: "high",
    })

    const m = loadMetrics(metricsPath)
    expect(m.events).toHaveLength(1)
    expect(m.events[0].type).toBe("dispatched")
    expect(m.events[0].timestamp).toBeGreaterThan(0)
  })

  it("accumulates multiple events", () => {
    const event = {
      type: "dispatched" as const,
      taskID: "t1",
      taskTitle: "Test",
      directory: "/tmp",
      priority: "high",
    }
    recordMetric(metricsPath, event)
    recordMetric(metricsPath, { ...event, type: "completed" })

    const m = loadMetrics(metricsPath)
    expect(m.events).toHaveLength(2)
  })
})

describe("getDispatchedToday", () => {
  it("returns 0 for empty metrics", () => {
    expect(getDispatchedToday(join(tmpDir, "missing.json"))).toBe(0)
  })

  it("counts only today's dispatched events", () => {
    const now = Date.now()
    const yesterday = now - 25 * 60 * 60 * 1000

    saveMetrics(metricsPath, {
      events: [
        { type: "dispatched", taskID: "t1", taskTitle: "A", directory: "/", priority: "high", timestamp: now },
        { type: "dispatched", taskID: "t2", taskTitle: "B", directory: "/", priority: "high", timestamp: now - 1000 },
        { type: "dispatched", taskID: "t3", taskTitle: "C", directory: "/", priority: "high", timestamp: yesterday },
        { type: "completed", taskID: "t1", taskTitle: "A", directory: "/", priority: "high", timestamp: now },
      ],
      startedAt: yesterday,
    })

    expect(getDispatchedToday(metricsPath)).toBe(2)
  })
})
