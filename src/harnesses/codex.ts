/**
 * OpenAI Codex CLI harness
 * Maps universal frontmatter to codex CLI flags
 */

import { BaseHarness, type RunContext, type RunResult, type HarnessName } from "./types";
import { getHarnessPassthroughArgs, toArray } from "./flags";

/**
 * Keys explicitly handled by this harness (not passed through)
 */
const HANDLED_CODEX_KEYS = new Set([
  "sandbox",
  "approval",
  "full-auto",
  "oss",
  "local-provider",
  "cd",
  "search",
  "image",
  "profile",
]);

export class CodexHarness extends BaseHarness {
  readonly name: HarnessName = "codex";

  getCommand(): string {
    return "codex";
  }

  buildArgs(ctx: RunContext): string[] {
    const { frontmatter } = ctx;
    const args: string[] = [];
    const codexConfig = frontmatter.codex || {};

    // --- Universal Keys ---

    // Model
    if (frontmatter.model) {
      args.push("--model", this.mapModel(frontmatter.model));
    }

    // Note: interactive mode is handled in run() via exec subcommand

    // Directory access: dirs (new) or add-dir (deprecated)
    const directories = frontmatter.dirs ?? frontmatter["add-dir"];
    for (const dir of toArray(directories)) {
      args.push("--add-dir", dir);
    }

    // Approval mode: approval (new) or allow-all-tools (deprecated)
    // yolo -> --full-auto
    const isYolo = frontmatter.approval === "yolo" ||
                   frontmatter["allow-all-tools"] ||
                   codexConfig["full-auto"];
    if (isYolo) {
      args.push("--full-auto");
    }

    // Sandbox mode: approval: "sandbox" (new) or codex.sandbox (specific)
    const isSandbox = frontmatter.approval === "sandbox";
    if (isSandbox && !codexConfig.sandbox) {
      // Default sandbox level for universal approval: "sandbox"
      args.push("--sandbox", "workspace-write");
    }

    // Note: Codex doesn't support allow-tool/deny-tool granularity

    // Debug (Codex doesn't have --debug, but we can try config)
    if (frontmatter.debug) {
      // Codex uses -c config overrides for debug
      args.push("-c", "debug=true");
    }

    // --- Codex-Specific Keys ---

    // Working directory
    if (codexConfig.cd) {
      args.push("--cd", String(codexConfig.cd));
    }

    // Sandbox mode
    if (codexConfig.sandbox) {
      args.push("--sandbox", String(codexConfig.sandbox));
    }

    // Approval policy
    if (codexConfig.approval) {
      args.push("--ask-for-approval", String(codexConfig.approval));
    }

    // OSS mode (local models)
    if (codexConfig.oss) {
      args.push("--oss");
    }

    // Local provider
    if (codexConfig["local-provider"]) {
      args.push("--local-provider", String(codexConfig["local-provider"]));
    }

    // Web search
    if (codexConfig.search) {
      args.push("--search");
    }

    // Image attachments
    for (const img of toArray(codexConfig.image as string | string[])) {
      args.push("--image", img);
    }

    // Profile
    if (codexConfig.profile) {
      args.push("--profile", String(codexConfig.profile));
    }

    // --- Passthrough: any codex-specific keys we didn't handle ---
    args.push(...getHarnessPassthroughArgs(codexConfig, HANDLED_CODEX_KEYS));

    // --- CLI passthrough args (highest priority) ---
    args.push(...ctx.passthroughArgs);

    return args;
  }

  /**
   * For Codex, non-interactive mode uses the exec subcommand
   */
  async run(ctx: RunContext): Promise<RunResult> {
    const { frontmatter } = ctx;
    const command = this.getCommand();
    const args = this.buildArgs(ctx);

    // interactive: false -> use exec subcommand (run & exit)
    const finalArgs = frontmatter.interactive === false
      ? ["exec", ...args, ctx.prompt]
      : [...args, ctx.prompt];

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
   * Map generic model names to Codex-specific models
   */
  private mapModel(model: string): string {
    const modelMap: Record<string, string> = {
      "gpt-5": "gpt-5",
      "gpt-5.1": "gpt-5.1",
      "gpt-5.1-codex": "gpt-5.1-codex",
      "gpt-5.1-codex-mini": "gpt-5.1-codex-mini",
      "gpt-5-mini": "gpt-5-mini",
      "gpt-4.1": "gpt-4.1",
    };
    return modelMap[model] || model;
  }
}
