import { describe, it, expect } from "vitest"
import { validateTask, formatValidationQuestions } from "../validate.js"

describe("validateTask", () => {
  const validTask = {
    title: "Add rate limiting to API endpoints",
    description:
      "Currently the API has no rate limiting. Add a middleware that returns 429 after 100 requests per minute per IP. This prevents abuse and protects downstream services.",
    scope: {
      files: ["src/middleware/rate-limit.ts"],
      acceptanceCriteria: ["API returns 429 after 100 req/min"],
    },
  }

  it("returns no issues for a well-defined task", () => {
    expect(validateTask(validTask)).toEqual([])
  })

  it("flags missing title", () => {
    const issues = validateTask({ ...validTask, title: "" })
    expect(issues.some((i) => i.field === "title")).toBe(true)
  })

  it("flags short title", () => {
    const issues = validateTask({ ...validTask, title: "Fix bug" })
    expect(issues.some((i) => i.field === "title")).toBe(true)
  })

  it("flags missing description", () => {
    const issues = validateTask({ ...validTask, description: "" })
    expect(issues.some((i) => i.field === "description")).toBe(true)
  })

  it("flags short description", () => {
    const issues = validateTask({ ...validTask, description: "Fix the thing" })
    expect(issues.some((i) => i.field === "description")).toBe(true)
  })

  it("flags vague 'fix bug' without context", () => {
    const issues = validateTask({
      ...validTask,
      description: "Fix bug in the authentication module that needs to be addressed",
    })
    expect(issues.some((i) => i.question.includes("vague"))).toBe(true)
  })

  it("accepts 'fix bug' with context", () => {
    const issues = validateTask({
      ...validTask,
      description:
        "Fix bug in auth module: when session expires the redirect fails because the token is cleared before the redirect URL is computed",
    })
    expect(issues.some((i) => i.question.includes("vague"))).toBe(false)
  })

  it("flags missing file scope for implementation tasks", () => {
    const issues = validateTask({
      ...validTask,
      description:
        "Add a new caching layer that stores API responses in Redis with configurable TTL per endpoint",
      scope: { acceptanceCriteria: ["Cache hit ratio > 80%"] },
    })
    expect(issues.some((i) => i.field === "scope.files")).toBe(true)
  })

  it("flags missing acceptance criteria", () => {
    const issues = validateTask({
      ...validTask,
      scope: { files: ["src/index.ts"] },
    })
    expect(issues.some((i) => i.field === "scope.acceptanceCriteria")).toBe(true)
  })

  it("flags overly broad directory scope", () => {
    const issues = validateTask({
      ...validTask,
      scope: {
        directories: ["."],
        acceptanceCriteria: ["Tests pass"],
      },
    })
    expect(issues.some((i) => i.field === "scope.directories")).toBe(true)
  })
})

describe("formatValidationQuestions", () => {
  it("returns empty string for no issues", () => {
    expect(formatValidationQuestions({ title: "Test" }, [])).toBe("")
  })

  it("formats questions with task title", () => {
    const result = formatValidationQuestions({ title: "My Task" }, [
      { field: "title", question: "Be more specific" },
    ])
    expect(result).toContain("My Task")
    expect(result).toContain("Be more specific")
  })
})
