import { test, expect, describe } from "bun:test";
import { CopilotHarness } from "./copilot";
import { ClaudeHarness } from "./claude";
import { CodexHarness } from "./codex";
import { GeminiHarness } from "./gemini";
import {
  createHarness,
  detectHarnessFromModel,
  resolveHarnessSync,
} from "./factory";
import type { RunContext } from "./types";
import type { AgentFrontmatter } from "../types";

// Legacy aliases for backward-compatible tests
const detectRunnerFromModel = detectHarnessFromModel;
const createRunner = createHarness;
const resolveRunnerSync = resolveHarnessSync;

// Helper to create a minimal RunContext
function makeContext(frontmatter: AgentFrontmatter = {}): RunContext {
  return {
    prompt: "test prompt",
    frontmatter,
    passthroughArgs: [],
    captureOutput: false,
  };
}

describe("CopilotHarness", () => {
  const harness = new CopilotHarness();

  test("has correct name", () => {
    expect(harness.name).toBe("copilot");
  });

  test("returns correct command", () => {
    expect(harness.getCommand()).toBe("copilot");
  });

  test("builds args with model", () => {
    const args = harness.buildArgs(makeContext({ model: "gpt-5" }));
    expect(args).toContain("--model");
    expect(args).toContain("gpt-5");
  });

  test("builds args with agent from copilot config", () => {
    const args = harness.buildArgs(makeContext({
      copilot: { agent: "my-agent" }
    }));
    expect(args).toContain("--agent");
    expect(args).toContain("my-agent");
  });

  // --- New naming: dirs ---
  test("builds args with dirs (new naming)", () => {
    const args = harness.buildArgs(makeContext({ dirs: "/some/dir" }));
    expect(args).toContain("--add-dir");
    expect(args).toContain("/some/dir");
  });

  test("builds args with add-dir (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "add-dir": "/some/dir" }));
    expect(args).toContain("--add-dir");
    expect(args).toContain("/some/dir");
  });

  test("handles array of dirs", () => {
    const args = harness.buildArgs(makeContext({
      dirs: ["/dir1", "/dir2"]
    }));
    expect(args.filter(a => a === "--add-dir")).toHaveLength(2);
    expect(args).toContain("/dir1");
    expect(args).toContain("/dir2");
  });

  // --- New naming: approval ---
  test("builds args with approval: yolo (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "yolo" }));
    expect(args).toContain("--allow-all-tools");
  });

  test("builds args with allow-all-tools (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "allow-all-tools": true }));
    expect(args).toContain("--allow-all-tools");
  });

  // --- New naming: tools ---
  test("builds args with tools.allow (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      tools: { allow: ["tool1", "tool2"] }
    }));
    expect(args.filter(a => a === "--allow-tool")).toHaveLength(2);
    expect(args).toContain("tool1");
    expect(args).toContain("tool2");
  });

  test("builds args with tools.deny (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      tools: { deny: ["bad-tool"] }
    }));
    expect(args).toContain("--deny-tool");
    expect(args).toContain("bad-tool");
  });

  // --- New naming: session ---
  test("builds args with session.resume (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: true }
    }));
    expect(args).toContain("--continue");
  });

  test("builds args with session.resume string (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: "session-123" }
    }));
    expect(args).toContain("--resume");
    expect(args).toContain("session-123");
  });

  test("passes --silent by default (copilot.silent defaults to true)", () => {
    const args = harness.buildArgs(makeContext({}));
    expect(args).toContain("--silent");
  });

  test("does not pass --silent when copilot.silent is explicitly false", () => {
    const args = harness.buildArgs(makeContext({
      copilot: { silent: false }
    }));
    expect(args).not.toContain("--silent");
  });

  test("builds args with interactive mode (default)", () => {
    // interactive: true (or undefined) -> --interactive
    const args = harness.buildArgs(makeContext({}));
    expect(args).toContain("--interactive");
  });

  test("uses -p when interactive is explicitly false", () => {
    const args = harness.buildArgs(makeContext({ interactive: false }));
    expect(args).toContain("-p");
    expect(args).not.toContain("--interactive");
  });

  test("includes passthrough args", () => {
    const ctx = makeContext({});
    ctx.passthroughArgs = ["--verbose", "--debug"];
    const args = harness.buildArgs(ctx);
    expect(args).toContain("--verbose");
    expect(args).toContain("--debug");
  });
});

describe("ClaudeHarness", () => {
  const harness = new ClaudeHarness();

  test("has correct name", () => {
    expect(harness.name).toBe("claude");
  });

  test("returns correct command", () => {
    expect(harness.getCommand()).toBe("claude");
  });

  test("builds args with model", () => {
    const args = harness.buildArgs(makeContext({ model: "opus" }));
    expect(args).toContain("--model");
    expect(args).toContain("opus");
  });

  test("maps claude model names", () => {
    const args = harness.buildArgs(makeContext({ model: "claude-sonnet-4" }));
    expect(args).toContain("--model");
    expect(args).toContain("sonnet");
  });

  // --- New naming: dirs ---
  test("builds args with dirs (new naming)", () => {
    const args = harness.buildArgs(makeContext({ dirs: "/some/dir" }));
    expect(args).toContain("--add-dir");
    expect(args).toContain("/some/dir");
  });

  test("builds args with add-dir (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "add-dir": "/some/dir" }));
    expect(args).toContain("--add-dir");
    expect(args).toContain("/some/dir");
  });

  // --- New naming: approval ---
  test("builds args with approval: yolo (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "yolo" }));
    expect(args).toContain("--dangerously-skip-permissions");
  });

  test("builds args with allow-all-tools (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "allow-all-tools": true }));
    expect(args).toContain("--dangerously-skip-permissions");
  });

  test("builds args with claude-specific dangerously-skip-permissions", () => {
    const args = harness.buildArgs(makeContext({
      claude: { "dangerously-skip-permissions": true }
    }));
    expect(args).toContain("--dangerously-skip-permissions");
  });

  // --- New naming: tools ---
  test("builds args with tools.allow (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      tools: { allow: ["Read", "Write"] }
    }));
    expect(args.filter(a => a === "--allowed-tools")).toHaveLength(2);
    expect(args).toContain("Read");
    expect(args).toContain("Write");
  });

  test("builds args with tools.deny (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      tools: { deny: ["Bash"] }
    }));
    expect(args).toContain("--disallowed-tools");
    expect(args).toContain("Bash");
  });

  // --- New naming: session ---
  test("builds args with session.resume (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: true }
    }));
    expect(args).toContain("-c");
  });

  test("builds args with session.resume string (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: "session-123" }
    }));
    expect(args).toContain("-r");
    expect(args).toContain("session-123");
  });

  // --- New naming: output ---
  test("builds args with output (new naming)", () => {
    const args = harness.buildArgs(makeContext({ output: "json" }));
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  test("builds args with mcp-config", () => {
    const args = harness.buildArgs(makeContext({
      claude: { "mcp-config": "./my-mcp.json" }
    }));
    expect(args).toContain("--mcp-config");
    expect(args).toContain("./my-mcp.json");
  });

  test("handles array of mcp-config", () => {
    const args = harness.buildArgs(makeContext({
      claude: { "mcp-config": ["./mcp1.json", "./mcp2.json"] }
    }));
    expect(args.filter(a => a === "--mcp-config")).toHaveLength(2);
    expect(args).toContain("./mcp1.json");
    expect(args).toContain("./mcp2.json");
  });

  test("builds args with allowed-tools", () => {
    const args = harness.buildArgs(makeContext({
      claude: { "allowed-tools": "Read,Write" }
    }));
    expect(args).toContain("--allowed-tools");
    expect(args).toContain("Read,Write");
  });

  test("uses -p when interactive is false", () => {
    const args = harness.buildArgs(makeContext({ interactive: false }));
    expect(args).toContain("-p");
  });

  test("does not add -p for interactive mode (default)", () => {
    const args = harness.buildArgs(makeContext({}));
    expect(args).not.toContain("-p");
  });

  test("does not add -p when interactive is explicitly true", () => {
    const args = harness.buildArgs(makeContext({ interactive: true }));
    expect(args).not.toContain("-p");
  });

  test("includes passthrough args", () => {
    const ctx = makeContext({});
    ctx.passthroughArgs = ["--verbose"];
    const args = harness.buildArgs(ctx);
    expect(args).toContain("--verbose");
  });
});

describe("CodexHarness", () => {
  const harness = new CodexHarness();

  test("has correct name", () => {
    expect(harness.name).toBe("codex");
  });

  test("returns correct command", () => {
    expect(harness.getCommand()).toBe("codex");
  });

  test("builds args with model", () => {
    const args = harness.buildArgs(makeContext({ model: "gpt-5.1" }));
    expect(args).toContain("--model");
    expect(args).toContain("gpt-5.1");
  });

  // --- New naming: dirs ---
  test("builds args with dirs (new naming)", () => {
    const args = harness.buildArgs(makeContext({ dirs: "/some/dir" }));
    expect(args).toContain("--add-dir");
    expect(args).toContain("/some/dir");
  });

  // --- New naming: approval ---
  test("builds args with approval: yolo (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "yolo" }));
    expect(args).toContain("--full-auto");
  });

  test("builds args with approval: sandbox (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "sandbox" }));
    expect(args).toContain("--sandbox");
    expect(args).toContain("workspace-write");
  });

  test("builds args with allow-all-tools (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "allow-all-tools": true }));
    expect(args).toContain("--full-auto");
  });

  test("builds args with codex sandbox (specific)", () => {
    const args = harness.buildArgs(makeContext({
      codex: { sandbox: "workspace-write" }
    }));
    expect(args).toContain("--sandbox");
    expect(args).toContain("workspace-write");
  });

  test("builds args with codex approval", () => {
    const args = harness.buildArgs(makeContext({
      codex: { approval: "on-failure" }
    }));
    expect(args).toContain("--ask-for-approval");
    expect(args).toContain("on-failure");
  });

  test("builds args with codex full-auto", () => {
    const args = harness.buildArgs(makeContext({
      codex: { "full-auto": true }
    }));
    expect(args).toContain("--full-auto");
  });

  test("builds args with oss mode", () => {
    const args = harness.buildArgs(makeContext({
      codex: { oss: true }
    }));
    expect(args).toContain("--oss");
  });

  test("builds args with local-provider", () => {
    const args = harness.buildArgs(makeContext({
      codex: { "local-provider": "ollama" }
    }));
    expect(args).toContain("--local-provider");
    expect(args).toContain("ollama");
  });

  test("builds args with cd", () => {
    const args = harness.buildArgs(makeContext({
      codex: { cd: "./src" }
    }));
    expect(args).toContain("--cd");
    expect(args).toContain("./src");
  });
});

describe("GeminiHarness", () => {
  const harness = new GeminiHarness();

  test("has correct name", () => {
    expect(harness.name).toBe("gemini");
  });

  test("returns correct command", () => {
    expect(harness.getCommand()).toBe("gemini");
  });

  test("builds args with model", () => {
    const args = harness.buildArgs(makeContext({ model: "gemini-2.5-pro" }));
    expect(args).toContain("--model");
    expect(args).toContain("gemini-2.5-pro");
  });

  test("maps gemini model names", () => {
    const args = harness.buildArgs(makeContext({ model: "gemini-pro" }));
    expect(args).toContain("--model");
    expect(args).toContain("gemini-3-pro-preview");
  });

  // --- New naming: dirs ---
  test("builds args with dirs (new naming)", () => {
    const args = harness.buildArgs(makeContext({ dirs: "/some/dir" }));
    expect(args).toContain("--include-directories");
    expect(args).toContain("/some/dir");
  });

  test("builds args with add-dir (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "add-dir": "/some/dir" }));
    expect(args).toContain("--include-directories");
    expect(args).toContain("/some/dir");
  });

  // --- New naming: approval ---
  test("builds args with approval: yolo (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "yolo" }));
    expect(args).toContain("--yolo");
  });

  test("builds args with approval: sandbox (new naming)", () => {
    const args = harness.buildArgs(makeContext({ approval: "sandbox" }));
    expect(args).toContain("--sandbox");
  });

  test("builds args with allow-all-tools (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "allow-all-tools": true }));
    expect(args).toContain("--yolo");
  });

  test("builds args with gemini-specific yolo", () => {
    const args = harness.buildArgs(makeContext({
      gemini: { yolo: true }
    }));
    expect(args).toContain("--yolo");
  });

  // --- New naming: tools ---
  test("builds args with tools.allow (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      tools: { allow: ["tool1", "tool2"] }
    }));
    expect(args.filter(a => a === "--allowed-tools")).toHaveLength(2);
    expect(args).toContain("tool1");
    expect(args).toContain("tool2");
  });

  // --- New naming: session ---
  test("builds args with session.resume (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: true }
    }));
    expect(args).toContain("--resume");
    expect(args).toContain("latest");
  });

  test("builds args with session.resume string (new naming)", () => {
    const args = harness.buildArgs(makeContext({
      session: { resume: "session-123" }
    }));
    expect(args).toContain("--resume");
    expect(args).toContain("session-123");
  });

  // --- New naming: output ---
  test("builds args with output (new naming)", () => {
    const args = harness.buildArgs(makeContext({ output: "json" }));
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  test("builds args with output-format (deprecated)", () => {
    const args = harness.buildArgs(makeContext({ "output-format": "json" }));
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  test("builds args with approval-mode", () => {
    const args = harness.buildArgs(makeContext({
      gemini: { "approval-mode": "auto_edit" }
    }));
    expect(args).toContain("--approval-mode");
    expect(args).toContain("auto_edit");
  });

  test("builds args with extensions", () => {
    const args = harness.buildArgs(makeContext({
      gemini: { extensions: ["ext1", "ext2"] }
    }));
    expect(args.filter(a => a === "--extensions")).toHaveLength(2);
    expect(args).toContain("ext1");
    expect(args).toContain("ext2");
  });

  test("builds args with mcp server names", () => {
    const args = harness.buildArgs(makeContext({
      gemini: { "allowed-mcp-server-names": ["server1"] }
    }));
    expect(args).toContain("--allowed-mcp-server-names");
    expect(args).toContain("server1");
  });

  test("uses positional prompt when interactive is false", async () => {
    const h = new GeminiHarness();
    // Note: We can't easily test the run() method's finalArgs construction here,
    // but we can verify that buildArgs doesn't add --prompt-interactive flag
    const args = h.buildArgs(makeContext({ interactive: false }));
    // The flag is added in run(), not buildArgs - this just verifies no errors
    expect(args).toBeDefined();
  });
});

describe("detectHarnessFromModel", () => {
  test("detects claude models", () => {
    expect(detectHarnessFromModel("claude-sonnet-4")).toBe("claude");
    expect(detectHarnessFromModel("claude-opus-4.5")).toBe("claude");
    expect(detectHarnessFromModel("claude-haiku-4.5")).toBe("claude");
    expect(detectHarnessFromModel("sonnet")).toBe("claude");
    expect(detectHarnessFromModel("opus")).toBe("claude");
    expect(detectHarnessFromModel("haiku")).toBe("claude");
  });

  test("detects codex/gpt models", () => {
    expect(detectHarnessFromModel("gpt-5")).toBe("codex");
    expect(detectHarnessFromModel("gpt-5.1")).toBe("codex");
    expect(detectHarnessFromModel("gpt-5.1-codex")).toBe("codex");
    expect(detectHarnessFromModel("codex")).toBe("codex");
  });

  test("detects gemini models", () => {
    expect(detectHarnessFromModel("gemini-2.5-pro")).toBe("gemini");
    expect(detectHarnessFromModel("gemini-2.5-flash")).toBe("gemini");
    expect(detectHarnessFromModel("gemini-3-pro-preview")).toBe("gemini");
  });

  test("returns null for unknown models", () => {
    expect(detectHarnessFromModel("unknown-model")).toBeNull();
    expect(detectHarnessFromModel("llama-3")).toBeNull();
  });
});

describe("createHarness", () => {
  test("creates copilot harness", () => {
    const harness = createHarness("copilot");
    expect(harness.name).toBe("copilot");
  });

  test("creates claude harness", () => {
    const harness = createHarness("claude");
    expect(harness.name).toBe("claude");
  });

  test("creates codex harness", () => {
    const harness = createHarness("codex");
    expect(harness.name).toBe("codex");
  });

  test("creates gemini harness", () => {
    const harness = createHarness("gemini");
    expect(harness.name).toBe("gemini");
  });

  test("throws for unknown harness", () => {
    expect(() => createHarness("unknown" as any)).toThrow("Unknown harness");
  });
});

describe("resolveHarnessSync", () => {
  test("uses CLI harness when provided", () => {
    const harness = resolveHarnessSync({
      cliHarness: "claude",
      frontmatter: { runner: "copilot" }
    });
    expect(harness.name).toBe("claude");
  });

  test("uses frontmatter runner when no CLI harness", () => {
    const harness = resolveHarnessSync({
      frontmatter: { runner: "codex" }
    });
    expect(harness.name).toBe("codex");
  });

  test("ignores frontmatter runner:auto", () => {
    const harness = resolveHarnessSync({
      frontmatter: { runner: "auto", model: "sonnet" }
    });
    expect(harness.name).toBe("claude"); // Falls through to model detection
  });

  test("detects harness from model", () => {
    const harness = resolveHarnessSync({
      frontmatter: { model: "gpt-5" }
    });
    expect(harness.name).toBe("codex");
  });

  test("falls back to copilot", () => {
    const harness = resolveHarnessSync({
      frontmatter: {}
    });
    expect(harness.name).toBe("copilot");
  });

  test("falls back to copilot for unknown model", () => {
    const harness = resolveHarnessSync({
      frontmatter: { model: "unknown-model" }
    });
    expect(harness.name).toBe("copilot");
  });
});
