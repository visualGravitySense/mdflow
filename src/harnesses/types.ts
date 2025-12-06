import type { AgentFrontmatter, CommandResult } from "../types";
import type { ContextFile } from "../context";

/** Supported harness backends */
export type HarnessName = "claude" | "codex" | "copilot" | "gemini";

/** @deprecated Use HarnessName instead */
export type RunnerName = HarnessName;

/** Context passed to harnesses for execution */
export interface RunContext {
  /** The final compiled prompt (with before output, context, stdin) */
  prompt: string;
  /** Parsed and merged frontmatter */
  frontmatter: AgentFrontmatter;
  /** Extra CLI args to pass through */
  passthroughArgs: string[];
  /** Whether to capture output (for after commands, extract, caching) */
  captureOutput: boolean;
}

/** Result from harness execution */
export interface RunResult {
  exitCode: number;
  output: string;
}

/** Harness interface - all backends implement this */
export interface Harness {
  /** Harness identifier */
  readonly name: HarnessName;

  /** Build command arguments from context */
  buildArgs(ctx: RunContext): string[];

  /** Get the command/binary name to execute */
  getCommand(): string;

  /** Execute the harness and return result */
  run(ctx: RunContext): Promise<RunResult>;
}

/** @deprecated Use Harness instead */
export type Runner = Harness;

/** Base harness with shared implementation */
export abstract class BaseHarness implements Harness {
  abstract readonly name: HarnessName;
  abstract buildArgs(ctx: RunContext): string[];
  abstract getCommand(): string;

  async run(ctx: RunContext): Promise<RunResult> {
    const command = this.getCommand();
    const args = this.buildArgs(ctx);

    const proc = Bun.spawn([command, ...args, ctx.prompt], {
      stdout: ctx.captureOutput ? "pipe" : "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    let output = "";
    if (ctx.captureOutput && proc.stdout) {
      output = await new Response(proc.stdout).text();
      // Still print to console so user sees it
      console.log(output);
    }

    const exitCode = await proc.exited;
    return { exitCode, output };
  }
}

/** @deprecated Use BaseHarness instead */
export const BaseRunner = BaseHarness;
