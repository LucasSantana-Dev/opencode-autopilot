import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { loadConfig } from "../config.js"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "autopilot-config-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig(tmpDir)
    expect(config.maxConcurrent).toBe(2)
    expect(config.dailyTaskLimit).toBe(10)
    expect(config.autoDispatch).toBe(true)
    expect(config.notifications.onComplete).toBe(true)
  })

  it("merges user config with defaults", () => {
    writeFileSync(
      join(tmpDir, "config.json"),
      JSON.stringify({ maxConcurrent: 5, dailyTaskLimit: 20 }),
    )
    const config = loadConfig(tmpDir)
    expect(config.maxConcurrent).toBe(5)
    expect(config.dailyTaskLimit).toBe(20)
    expect(config.pollIntervalMs).toBe(60_000) // default preserved
  })

  it("deep-merges notifications", () => {
    writeFileSync(
      join(tmpDir, "config.json"),
      JSON.stringify({ notifications: { sound: true } }),
    )
    const config = loadConfig(tmpDir)
    expect(config.notifications.sound).toBe(true)
    expect(config.notifications.onComplete).toBe(true) // default preserved
  })

  it("returns defaults for invalid JSON", () => {
    writeFileSync(join(tmpDir, "config.json"), "broken{{{")
    const config = loadConfig(tmpDir)
    expect(config.maxConcurrent).toBe(2)
  })
})
