import { test, expect, describe } from "bun:test";
import { parseBatchManifest, formatBatchResults, type BatchResult } from "./batch";

describe("parseBatchManifest", () => {
  test("parses simple JSON array", () => {
    const input = `[
      { "agent": "agents/CODER.md", "branch": "feat/api" },
      { "agent": "agents/TEST.md" }
    ]`;
    const jobs = parseBatchManifest(input);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].agent).toBe("agents/CODER.md");
    expect(jobs[0].branch).toBe("feat/api");
    expect(jobs[1].agent).toBe("agents/TEST.md");
  });

  test("parses single object as array", () => {
    const input = `{ "agent": "agents/CODER.md", "vars": { "task": "fix bug" } }`;
    const jobs = parseBatchManifest(input);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].agent).toBe("agents/CODER.md");
    expect(jobs[0].vars).toEqual({ task: "fix bug" });
  });

  test("extracts JSON from markdown code block", () => {
    const input = `Here's the plan:

\`\`\`json
[
  { "agent": "agents/CODER.md", "branch": true }
]
\`\`\`

Let me know if you need changes.`;
    const jobs = parseBatchManifest(input);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].branch).toBe(true);
  });

  test("extracts JSON from code block without json tag", () => {
    const input = `\`\`\`
[{ "agent": "test.md" }]
\`\`\``;
    const jobs = parseBatchManifest(input);
    expect(jobs).toHaveLength(1);
  });

  test("parses job with all fields", () => {
    const input = `[{
      "agent": "agents/CODER.md",
      "branch": "feat/new-feature",
      "vars": { "file": "src/api.ts", "task": "Add endpoint" },
      "model": "sonnet",
      "runner": "claude"
    }]`;
    const jobs = parseBatchManifest(input);
    expect(jobs[0]).toEqual({
      agent: "agents/CODER.md",
      branch: "feat/new-feature",
      vars: { file: "src/api.ts", task: "Add endpoint" },
      model: "sonnet",
      runner: "claude",
    });
  });

  test("throws on missing agent field", () => {
    const input = `[{ "branch": "feat/test" }]`;
    expect(() => parseBatchManifest(input)).toThrow("missing required 'agent' field");
  });

  test("throws on invalid JSON", () => {
    const input = `not valid json`;
    expect(() => parseBatchManifest(input)).toThrow();
  });

  test("throws on non-object manifest", () => {
    const input = `"just a string"`;
    expect(() => parseBatchManifest(input)).toThrow("must be a JSON array or object");
  });
});

describe("formatBatchResults", () => {
  test("formats successful results", () => {
    const results: BatchResult[] = [
      {
        index: 0,
        job: { agent: "agents/CODER.md", branch: "feat/api" },
        output: "Done!",
        exitCode: 0,
        branchName: "feat/api",
        duration: 1000,
      },
    ];
    const xml = formatBatchResults(results);
    expect(xml).toContain('<batch_summary total="1" succeeded="1" failed="0">');
    expect(xml).toContain('status="success"');
    expect(xml).toContain('branch="feat/api"');
    expect(xml).toContain("Done!");
  });

  test("formats failed results", () => {
    const results: BatchResult[] = [
      {
        index: 0,
        job: { agent: "agents/BROKEN.md" },
        output: "",
        exitCode: 1,
        error: "File not found",
      },
    ];
    const xml = formatBatchResults(results);
    expect(xml).toContain('succeeded="0" failed="1"');
    expect(xml).toContain('status="failed"');
    expect(xml).toContain('error="File not found"');
  });

  test("escapes XML entities in output", () => {
    const results: BatchResult[] = [
      {
        index: 0,
        job: { agent: "test.md" },
        output: '<script>alert("xss")</script>',
        exitCode: 0,
      },
    ];
    const xml = formatBatchResults(results);
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).not.toContain("<script>");
  });

  test("includes duration when present", () => {
    const results: BatchResult[] = [
      {
        index: 0,
        job: { agent: "test.md" },
        output: "ok",
        exitCode: 0,
        duration: 5000,
      },
    ];
    const xml = formatBatchResults(results);
    expect(xml).toContain('duration_ms="5000"');
  });
});
