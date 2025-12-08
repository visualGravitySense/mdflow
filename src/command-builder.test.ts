/**
 * Tests for CommandBuilder - Pure command construction functions
 *
 * These tests verify argument mapping without process spawning.
 * All tests use simple object comparisons - no mocks needed.
 */

import { describe, it, expect } from "bun:test";
import {
  buildArgsFromFrontmatter,
  extractPositionalMappings,
  extractEnvVars,
  applyPositionalArgs,
  buildCommand,
  buildCommandBase,
  type CommandSpec,
} from "./command-builder";
import type { AgentFrontmatter } from "./types";
import type { GlobalConfig } from "./config";

describe("buildArgsFromFrontmatter", () => {
  describe("string values", () => {
    it("converts string values to --flag value", () => {
      const result = buildArgsFromFrontmatter({ model: "opus" }, new Set());
      expect(result).toEqual(["--model", "opus"]);
    });

    it("handles multiple string values", () => {
      const result = buildArgsFromFrontmatter(
        { model: "opus", output: "json" },
        new Set()
      );
      expect(result).toContain("--model");
      expect(result).toContain("opus");
      expect(result).toContain("--output");
      expect(result).toContain("json");
    });

    it("converts numeric values to strings", () => {
      const result = buildArgsFromFrontmatter({ timeout: 30 }, new Set());
      expect(result).toEqual(["--timeout", "30"]);
    });
  });

  describe("boolean flags", () => {
    it("includes flag for boolean true", () => {
      const result = buildArgsFromFrontmatter({ verbose: true }, new Set());
      expect(result).toEqual(["--verbose"]);
    });

    it("omits flag for boolean false", () => {
      const result = buildArgsFromFrontmatter({ verbose: false }, new Set());
      expect(result).toEqual([]);
    });

    it("handles multiple boolean flags", () => {
      const result = buildArgsFromFrontmatter(
        { verbose: true, debug: false, quiet: true },
        new Set()
      );
      expect(result).toContain("--verbose");
      expect(result).toContain("--quiet");
      expect(result).not.toContain("--debug");
    });

    it("handles dangerously-skip-permissions style flags", () => {
      const result = buildArgsFromFrontmatter(
        { "dangerously-skip-permissions": true },
        new Set()
      );
      expect(result).toEqual(["--dangerously-skip-permissions"]);
    });
  });

  describe("array values", () => {
    it("repeats flag for each array element", () => {
      const result = buildArgsFromFrontmatter(
        { "add-dir": ["./src", "./tests"] },
        new Set()
      );
      expect(result).toEqual([
        "--add-dir", "./src",
        "--add-dir", "./tests",
      ]);
    });

    it("handles single-element arrays", () => {
      const result = buildArgsFromFrontmatter(
        { include: ["*.ts"] },
        new Set()
      );
      expect(result).toEqual(["--include", "*.ts"]);
    });

    it("handles empty arrays", () => {
      const result = buildArgsFromFrontmatter({ include: [] }, new Set());
      expect(result).toEqual([]);
    });

    it("converts array elements to strings", () => {
      const result = buildArgsFromFrontmatter({ ports: [3000, 8080] }, new Set());
      expect(result).toEqual(["--ports", "3000", "--ports", "8080"]);
    });
  });

  describe("single-character flags", () => {
    it("uses single dash for single-char flags", () => {
      const result = buildArgsFromFrontmatter({ p: true }, new Set());
      expect(result).toEqual(["-p"]);
    });

    it("handles multiple single-char flags", () => {
      const result = buildArgsFromFrontmatter(
        { p: true, c: true, v: false },
        new Set()
      );
      expect(result).toContain("-p");
      expect(result).toContain("-c");
      expect(result).not.toContain("-v");
    });

    it("handles single-char flags with values", () => {
      const result = buildArgsFromFrontmatter({ n: 5 }, new Set());
      expect(result).toEqual(["-n", "5"]);
    });
  });

  describe("system keys (skipped)", () => {
    it("skips args key", () => {
      const result = buildArgsFromFrontmatter(
        { args: ["message", "branch"], model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
      expect(result).not.toContain("--args");
    });

    it("skips pre/before lifecycle hooks", () => {
      const result = buildArgsFromFrontmatter(
        { pre: "npm test", before: "lint", model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
      expect(result).not.toContain("--pre");
      expect(result).not.toContain("--before");
    });

    it("skips post/after lifecycle hooks", () => {
      const result = buildArgsFromFrontmatter(
        { post: "cleanup", after: "notify", model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
      expect(result).not.toContain("--post");
      expect(result).not.toContain("--after");
    });

    it("skips context_window", () => {
      const result = buildArgsFromFrontmatter(
        { context_window: 128000, model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
      expect(result).not.toContain("--context_window");
    });
  });

  describe("positional mappings (skipped)", () => {
    it("skips $1 positional mapping", () => {
      const result = buildArgsFromFrontmatter(
        { $1: "prompt", model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
      expect(result).not.toContain("--$1");
      expect(result).not.toContain("prompt");
    });

    it("skips multiple positional mappings", () => {
      const result = buildArgsFromFrontmatter(
        { $1: "prompt", $2: "model", verbose: true },
        new Set()
      );
      expect(result).toEqual(["--verbose"]);
    });

    it("skips named template variable fields ($varname)", () => {
      const result = buildArgsFromFrontmatter(
        { $feature_name: "default", model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
    });
  });

  describe("template variables (skipped)", () => {
    it("skips keys that are template variables", () => {
      const result = buildArgsFromFrontmatter(
        { target: "src/main.ts", model: "opus" },
        new Set(["target"])
      );
      expect(result).toEqual(["--model", "opus"]);
    });

    it("skips multiple template variables", () => {
      const result = buildArgsFromFrontmatter(
        { target: "src/main.ts", message: "hello", model: "opus" },
        new Set(["target", "message"])
      );
      expect(result).toEqual(["--model", "opus"]);
    });
  });

  describe("env key handling", () => {
    it("skips env when it is an object (process.env config)", () => {
      const result = buildArgsFromFrontmatter(
        { env: { HOST: "localhost" }, model: "opus" },
        new Set()
      );
      expect(result).toEqual(["--model", "opus"]);
    });

    it("passes env as --env flags when it is an array", () => {
      const result = buildArgsFromFrontmatter(
        { env: ["HOST=localhost", "PORT=3000"] },
        new Set()
      );
      expect(result).toEqual([
        "--env", "HOST=localhost",
        "--env", "PORT=3000",
      ]);
    });

    it("passes env as --env flag when it is a string", () => {
      const result = buildArgsFromFrontmatter(
        { env: "HOST=localhost" },
        new Set()
      );
      expect(result).toEqual(["--env", "HOST=localhost"]);
    });
  });

  describe("null/undefined handling", () => {
    it("skips undefined values", () => {
      const result = buildArgsFromFrontmatter(
        { model: undefined, verbose: true },
        new Set()
      );
      expect(result).toEqual(["--verbose"]);
    });

    it("skips null values", () => {
      const result = buildArgsFromFrontmatter(
        { model: null, verbose: true },
        new Set()
      );
      expect(result).toEqual(["--verbose"]);
    });
  });

  describe("flags that already have dashes", () => {
    it("preserves flags that already start with --", () => {
      const result = buildArgsFromFrontmatter(
        { "--custom-flag": "value" },
        new Set()
      );
      expect(result).toEqual(["--custom-flag", "value"]);
    });

    it("preserves flags that already start with -", () => {
      const result = buildArgsFromFrontmatter(
        { "-x": true },
        new Set()
      );
      expect(result).toEqual(["-x"]);
    });
  });
});

describe("extractPositionalMappings", () => {
  it("extracts $1 mapping", () => {
    const mappings = extractPositionalMappings({ $1: "prompt" });
    expect(mappings.get(1)).toBe("prompt");
    expect(mappings.size).toBe(1);
  });

  it("extracts multiple mappings", () => {
    const mappings = extractPositionalMappings({
      $1: "prompt",
      $2: "model",
      $3: "output",
    });
    expect(mappings.get(1)).toBe("prompt");
    expect(mappings.get(2)).toBe("model");
    expect(mappings.get(3)).toBe("output");
    expect(mappings.size).toBe(3);
  });

  it("ignores non-positional keys", () => {
    const mappings = extractPositionalMappings({
      $1: "prompt",
      model: "opus",
      verbose: true,
    });
    expect(mappings.size).toBe(1);
    expect(mappings.get(1)).toBe("prompt");
  });

  it("ignores named variable fields ($varname)", () => {
    const mappings = extractPositionalMappings({
      $1: "prompt",
      $feature_name: "default",
    });
    expect(mappings.size).toBe(1);
    expect(mappings.get(1)).toBe("prompt");
  });

  it("returns empty map when no positional mappings", () => {
    const mappings = extractPositionalMappings({
      model: "opus",
      verbose: true,
    });
    expect(mappings.size).toBe(0);
  });

  it("ignores non-string positional values", () => {
    const mappings = extractPositionalMappings({
      $1: 123 as unknown as string,
      $2: "model",
    });
    expect(mappings.size).toBe(1);
    expect(mappings.get(2)).toBe("model");
  });
});

describe("extractEnvVars", () => {
  it("extracts object form of env", () => {
    const env = extractEnvVars({
      env: { HOST: "localhost", PORT: "3000" },
    });
    expect(env).toEqual({ HOST: "localhost", PORT: "3000" });
  });

  it("returns empty object for array form", () => {
    const env = extractEnvVars({
      env: ["HOST=localhost"],
    });
    expect(env).toEqual({});
  });

  it("returns empty object for string form", () => {
    const env = extractEnvVars({
      env: "HOST=localhost",
    });
    expect(env).toEqual({});
  });

  it("returns empty object when no env", () => {
    const env = extractEnvVars({
      model: "opus",
    });
    expect(env).toEqual({});
  });

  it("handles empty env object", () => {
    const env = extractEnvVars({ env: {} });
    expect(env).toEqual({});
  });
});

describe("applyPositionalArgs", () => {
  it("applies unmapped positional as raw argument", () => {
    const result = applyPositionalArgs(
      ["--model", "opus"],
      ["Hello world"],
      new Map()
    );
    expect(result).toEqual(["--model", "opus", "Hello world"]);
  });

  it("maps $1 to flag", () => {
    const mappings = new Map([[1, "prompt"]]);
    const result = applyPositionalArgs(
      ["--model", "opus"],
      ["Hello world"],
      mappings
    );
    expect(result).toEqual(["--model", "opus", "--prompt", "Hello world"]);
  });

  it("maps multiple positionals", () => {
    const mappings = new Map([
      [1, "prompt"],
      [2, "context"],
    ]);
    const result = applyPositionalArgs(
      ["--model", "opus"],
      ["Hello", "world"],
      mappings
    );
    expect(result).toEqual([
      "--model", "opus",
      "--prompt", "Hello",
      "--context", "world",
    ]);
  });

  it("handles mixed mapped and unmapped positionals", () => {
    const mappings = new Map([[1, "prompt"]]);
    const result = applyPositionalArgs(
      ["--model", "opus"],
      ["Hello", "extra"],
      mappings
    );
    expect(result).toEqual([
      "--model", "opus",
      "--prompt", "Hello",
      "extra",
    ]);
  });

  it("handles single-char positional flag mappings", () => {
    const mappings = new Map([[1, "p"]]);
    const result = applyPositionalArgs([], ["prompt text"], mappings);
    expect(result).toEqual(["-p", "prompt text"]);
  });

  it("handles empty positionals", () => {
    const result = applyPositionalArgs(
      ["--model", "opus"],
      [],
      new Map()
    );
    expect(result).toEqual(["--model", "opus"]);
  });

  it("handles empty base args", () => {
    const mappings = new Map([[1, "prompt"]]);
    const result = applyPositionalArgs([], ["Hello"], mappings);
    expect(result).toEqual(["--prompt", "Hello"]);
  });
});

describe("buildCommand", () => {
  const emptyConfig: GlobalConfig = {};
  const cwd = "/test/dir";

  it("builds basic command spec", () => {
    const result = buildCommand(
      "claude",
      { model: "opus" },
      "Hello world",
      [],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.executable).toBe("claude");
    expect(result.args).toContain("--model");
    expect(result.args).toContain("opus");
    expect(result.args).toContain("Hello world");
    expect(result.cwd).toBe(cwd);
    expect(result.env).toEqual({});
  });

  it("applies $1 mapping to body", () => {
    const result = buildCommand(
      "copilot",
      { $1: "prompt", model: "gpt-4" },
      "Hello world",
      [],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.args).toContain("--prompt");
    expect(result.args).toContain("Hello world");
    expect(result.args).toContain("--model");
    expect(result.args).toContain("gpt-4");
    // Body should be passed as --prompt, not raw
    const promptIndex = result.args.indexOf("--prompt");
    expect(result.args[promptIndex + 1]).toBe("Hello world");
  });

  it("includes additional positional args", () => {
    const result = buildCommand(
      "claude",
      {},
      "body",
      ["extra1", "extra2"],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.args).toContain("body");
    expect(result.args).toContain("extra1");
    expect(result.args).toContain("extra2");
  });

  it("maps additional positional args with $2, $3", () => {
    const result = buildCommand(
      "claude",
      { $1: "prompt", $2: "context" },
      "body",
      ["extra context"],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.args).toContain("--prompt");
    expect(result.args).toContain("body");
    expect(result.args).toContain("--context");
    expect(result.args).toContain("extra context");
  });

  it("extracts env vars from frontmatter", () => {
    const result = buildCommand(
      "claude",
      { env: { API_KEY: "secret", DEBUG: "true" } },
      "body",
      [],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.env).toEqual({ API_KEY: "secret", DEBUG: "true" });
  });

  it("applies command defaults from config", () => {
    const config: GlobalConfig = {
      commands: {
        copilot: {
          $1: "prompt",
        },
      },
    };

    const result = buildCommand(
      "copilot",
      {},
      "Hello",
      [],
      new Set(),
      config,
      cwd
    );

    // Default $1: prompt should be applied
    expect(result.args).toContain("--prompt");
    expect(result.args).toContain("Hello");
  });

  it("frontmatter overrides config defaults", () => {
    const config: GlobalConfig = {
      commands: {
        claude: {
          model: "sonnet",
        },
      },
    };

    const result = buildCommand(
      "claude",
      { model: "opus" },
      "body",
      [],
      new Set(),
      config,
      cwd
    );

    expect(result.args).toContain("--model");
    expect(result.args).toContain("opus");
    expect(result.args).not.toContain("sonnet");
  });

  it("skips template variables in args", () => {
    const result = buildCommand(
      "claude",
      { target: "src/main.ts", model: "opus" },
      "Review {{ target }}",
      [],
      new Set(["target"]),
      emptyConfig,
      cwd
    );

    expect(result.args).toContain("--model");
    expect(result.args).toContain("opus");
    expect(result.args).not.toContain("--target");
    expect(result.args).not.toContain("src/main.ts");
  });

  it("handles complex frontmatter", () => {
    const frontmatter: AgentFrontmatter = {
      model: "opus",
      verbose: true,
      debug: false,
      "add-dir": ["./src", "./tests"],
      $1: "prompt",
      env: { NODE_ENV: "test" },
      args: ["message"],
    };

    const result = buildCommand(
      "claude",
      frontmatter,
      "Do the thing",
      [],
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.executable).toBe("claude");
    expect(result.args).toContain("--model");
    expect(result.args).toContain("opus");
    expect(result.args).toContain("--verbose");
    expect(result.args).not.toContain("--debug");
    expect(result.args).toContain("--add-dir");
    expect(result.args).toContain("./src");
    expect(result.args).toContain("./tests");
    expect(result.args).toContain("--prompt");
    expect(result.args).toContain("Do the thing");
    expect(result.env).toEqual({ NODE_ENV: "test" });
    // System keys should not appear
    expect(result.args).not.toContain("--args");
    expect(result.args).not.toContain("--$1");
  });

  it("uses process.cwd() as default cwd", () => {
    const result = buildCommand(
      "claude",
      {},
      "body",
      [],
      new Set(),
      emptyConfig
    );

    expect(result.cwd).toBe(process.cwd());
  });
});

describe("buildCommandBase", () => {
  const emptyConfig: GlobalConfig = {};
  const cwd = "/test/dir";

  it("builds command without positionals", () => {
    const result = buildCommandBase(
      "claude",
      { model: "opus", verbose: true },
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.executable).toBe("claude");
    expect(result.args).toEqual(["--model", "opus", "--verbose"]);
    expect(result.env).toEqual({});
    expect(result.cwd).toBe(cwd);
  });

  it("applies config defaults", () => {
    const config: GlobalConfig = {
      commands: {
        claude: {
          model: "sonnet",
        },
      },
    };

    const result = buildCommandBase(
      "claude",
      {},
      new Set(),
      config,
      cwd
    );

    expect(result.args).toContain("--model");
    expect(result.args).toContain("sonnet");
  });

  it("extracts env vars", () => {
    const result = buildCommandBase(
      "claude",
      { env: { KEY: "value" } },
      new Set(),
      emptyConfig,
      cwd
    );

    expect(result.env).toEqual({ KEY: "value" });
  });
});

describe("CommandSpec interface contract", () => {
  it("spec contains all required fields", () => {
    const spec: CommandSpec = {
      executable: "claude",
      args: ["--model", "opus"],
      env: { KEY: "value" },
      cwd: "/test/dir",
    };

    expect(spec).toHaveProperty("executable");
    expect(spec).toHaveProperty("args");
    expect(spec).toHaveProperty("env");
    expect(spec).toHaveProperty("cwd");
  });

  it("args can be empty array", () => {
    const spec: CommandSpec = {
      executable: "echo",
      args: [],
      env: {},
      cwd: "/",
    };

    expect(spec.args).toEqual([]);
  });

  it("env can be empty object", () => {
    const spec: CommandSpec = {
      executable: "echo",
      args: [],
      env: {},
      cwd: "/",
    };

    expect(spec.env).toEqual({});
  });
});

describe("integration scenarios", () => {
  it("copilot with prompt mapping (common pattern)", () => {
    const config: GlobalConfig = {
      commands: {
        copilot: {
          $1: "prompt",
        },
      },
    };

    const result = buildCommand(
      "copilot",
      { model: "gpt-4" },
      "Explain this code",
      [],
      new Set(),
      config,
      "/project"
    );

    expect(result.executable).toBe("copilot");
    expect(result.args).toContain("--prompt");
    expect(result.args).toContain("Explain this code");
    expect(result.args).toContain("--model");
    expect(result.args).toContain("gpt-4");
  });

  it("claude with multiple add-dir flags", () => {
    const result = buildCommand(
      "claude",
      {
        model: "opus",
        "add-dir": ["./src", "./lib", "./tests"],
        "dangerously-skip-permissions": true,
      },
      "Analyze the codebase",
      [],
      new Set(),
      {},
      "/workspace"
    );

    expect(result.args).toContain("--add-dir");
    const addDirCount = result.args.filter(a => a === "--add-dir").length;
    expect(addDirCount).toBe(3);
    expect(result.args).toContain("./src");
    expect(result.args).toContain("./lib");
    expect(result.args).toContain("./tests");
    expect(result.args).toContain("--dangerously-skip-permissions");
  });

  it("env vars set separately from command flags", () => {
    const result = buildCommand(
      "claude",
      {
        env: { ANTHROPIC_API_KEY: "sk-test", DEBUG: "1" },
        model: "opus",
      },
      "body",
      [],
      new Set(),
      {},
      "/project"
    );

    // Env should be in env object, not in args
    expect(result.env).toEqual({
      ANTHROPIC_API_KEY: "sk-test",
      DEBUG: "1",
    });
    expect(result.args).not.toContain("ANTHROPIC_API_KEY");
    expect(result.args).not.toContain("sk-test");
  });

  it("template variable substitution workflow", () => {
    // Simulates: {{ target }} in body, target provided via args
    const templateVars = new Set(["target"]);

    const result = buildCommand(
      "claude",
      {
        args: ["target"],  // Declares template var (skipped)
        target: "src/app.ts",  // Template var value (skipped)
        model: "opus",
      },
      "Review {{ target }}",  // Body with template (already substituted upstream)
      [],
      templateVars,
      {},
      "/project"
    );

    // target should not appear as a flag
    expect(result.args).not.toContain("--target");
    expect(result.args).not.toContain("src/app.ts");
    // args system key should not appear
    expect(result.args).not.toContain("--args");
    // model should appear
    expect(result.args).toContain("--model");
    expect(result.args).toContain("opus");
  });
});
