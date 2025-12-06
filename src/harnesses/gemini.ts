/**
 * Google Gemini CLI harness
 * Maps universal frontmatter to gemini CLI flags
 */

import { BaseHarness, type RunContext, type RunResult, type HarnessName } from "./types";
import { getHarnessPassthroughArgs, toArray } from "./flags";

/**
 * Keys explicitly handled by this harness (not passed through)
 */
const HANDLED_GEMINI_KEYS = new Set([
  "sandbox",
  "yolo",
  "approval-mode",
  "allowed-tools",
  "extensions",
  "resume",
  "allowed-mcp-server-names",
  "screen-reader",
]);

export class GeminiHarness extends BaseHarness {
  readonly name: HarnessName = "gemini";

  getCommand(): string {
    return "gemini";
  }

  buildArgs(ctx: RunContext): string[] {
    const { frontmatter } = ctx;
    const args: string[] = [];
    const geminiConfig = frontmatter.gemini || {};

    // --- Universal Keys ---

    // Model
    if (frontmatter.model) {
      args.push("--model", this.mapModel(frontmatter.model));
    }

    // Note: interactive mode is handled in run() via --prompt-interactive

    // Session: new unified form takes precedence over deprecated
    const sessionResume = frontmatter.session?.resume ?? frontmatter.resume;
    const sessionContinue = frontmatter.continue;
    if (sessionContinue || sessionResume === true) {
      args.push("--resume", "latest");
    } else if (typeof sessionResume === "string") {
      args.push("--resume", sessionResume);
    }

    // Directory access: dirs (new) or add-dir (deprecated)
    const directories = frontmatter.dirs ?? frontmatter["add-dir"];
    for (const dir of toArray(directories)) {
      args.push("--include-directories", dir);
    }

    // Approval mode: approval (new) or allow-all-tools (deprecated)
    // yolo -> --yolo
    const isYolo = frontmatter.approval === "yolo" ||
                   frontmatter["allow-all-tools"] ||
                   geminiConfig.yolo;
    if (isYolo) {
      args.push("--yolo");
    }

    // Sandbox mode: approval: "sandbox" (new) or gemini.sandbox (specific)
    const isSandbox = frontmatter.approval === "sandbox";
    if (isSandbox || geminiConfig.sandbox) {
      args.push("--sandbox");
    }

    // Tool whitelist: tools.allow (new) or allow-tool (deprecated)
    const toolsAllow = frontmatter.tools?.allow ?? frontmatter["allow-tool"];
    for (const tool of toArray(toolsAllow)) {
      args.push("--allowed-tools", tool);
    }

    // Note: Gemini doesn't support deny-tool

    // Output format: output (new) or output-format (deprecated)
    const outputFormat = frontmatter.output ?? frontmatter["output-format"];
    if (outputFormat) {
      args.push("--output-format", outputFormat);
    }

    // Debug
    if (frontmatter.debug) {
      args.push("--debug");
    }

    // --- Gemini-Specific Keys ---

    // Approval mode (more granular than yolo)
    if (geminiConfig["approval-mode"]) {
      args.push("--approval-mode", String(geminiConfig["approval-mode"]));
    }

    // Gemini-specific allowed tools (in addition to universal)
    for (const tool of toArray(geminiConfig["allowed-tools"] as string | string[])) {
      args.push("--allowed-tools", tool);
    }

    // Extensions
    for (const ext of toArray(geminiConfig.extensions as string | string[])) {
      args.push("--extensions", ext);
    }

    // Resume from gemini-specific (in addition to universal)
    if (geminiConfig.resume && !frontmatter.resume && !frontmatter.continue) {
      args.push("--resume", String(geminiConfig.resume));
    }

    // MCP servers
    for (const server of toArray(geminiConfig["allowed-mcp-server-names"] as string | string[])) {
      args.push("--allowed-mcp-server-names", server);
    }

    // Screen reader
    if (geminiConfig["screen-reader"]) {
      args.push("--screen-reader");
    }

    // --- Passthrough: any gemini-specific keys we didn't handle ---
    args.push(...getHarnessPassthroughArgs(geminiConfig, HANDLED_GEMINI_KEYS));

    // --- CLI passthrough args (highest priority) ---
    args.push(...ctx.passthroughArgs);

    return args;
  }

  /**
   * Gemini uses positional prompt for one-shot, --prompt-interactive for REPL
   */
  async run(ctx: RunContext): Promise<RunResult> {
    const { frontmatter } = ctx;
    const command = this.getCommand();
    const args = this.buildArgs(ctx);

    let finalArgs: string[];
    // interactive: true (or undefined/default) -> --prompt-interactive for REPL
    // interactive: false -> positional prompt (one-shot mode)
    if (frontmatter.interactive === false) {
      // Positional prompt comes at the end (one-shot, exits after)
      finalArgs = [...args, ctx.prompt];
    } else {
      // Interactive REPL mode with initial prompt
      finalArgs = ["--prompt-interactive", ctx.prompt, ...args];
    }

    const proc = Bun.spawn([command, ...finalArgs], {
      stdout: ctx.captureOutput ? "pipe" : "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    let output = "";
    if (ctx.captureOutput && proc.stdout) {
      output = await new Response(proc.stdout).text();
      console.log(output);
    }

    const exitCode = await proc.exited;
    return { exitCode, output };
  }

  /**
   * Map generic model names to Gemini-specific models
   */
  private mapModel(model: string): string {
    const modelMap: Record<string, string> = {
      "gemini": "gemini-3-pro-preview",
      "gemini-pro": "gemini-3-pro-preview",
      "gemini-flash": "gemini-2.5-flash",
      "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini-2.5-flash": "gemini-2.5-flash",
      "gemini-3-pro-preview": "gemini-3-pro-preview",
    };
    return modelMap[model] || model;
  }
}
