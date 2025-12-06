/**
 * GitHub Copilot CLI harness
 */

import { BaseHarness, type RunContext, type HarnessName } from "./types";
import { getHarnessPassthroughArgs, toArray } from "./flags";

/**
 * Keys explicitly handled by this harness (not passed through)
 */
const HANDLED_COPILOT_KEYS = new Set([
  "agent",
  "silent",
  "allow-all-paths",
  "stream",
  "banner",
  "no-color",
  "no-custom-instructions",
  "log-level",
]);

export class CopilotHarness extends BaseHarness {
  readonly name: HarnessName = "copilot";

  getCommand(): string {
    return "copilot";
  }

  buildArgs(ctx: RunContext): string[] {
    const { frontmatter } = ctx;
    const args: string[] = [];
    const copilotConfig = frontmatter.copilot || {};

    // --- Universal Keys ---

    // Model
    if (frontmatter.model) {
      args.push("--model", frontmatter.model);
    }

    // Interactive mode handled below with -p vs --interactive

    // Session: new unified form takes precedence over deprecated
    const sessionResume = frontmatter.session?.resume ?? frontmatter.resume;
    const sessionContinue = frontmatter.continue;
    if (sessionContinue || sessionResume === true) {
      args.push("--continue");
    } else if (typeof sessionResume === "string") {
      args.push("--resume", sessionResume);
    }

    // Directory access: dirs (new) or add-dir (deprecated)
    const directories = frontmatter.dirs ?? frontmatter["add-dir"];
    for (const dir of toArray(directories)) {
      args.push("--add-dir", dir);
    }

    // Approval mode: approval (new) or allow-all-tools (deprecated)
    // yolo -> --allow-all-tools
    const isYolo = frontmatter.approval === "yolo" || frontmatter["allow-all-tools"];
    if (isYolo) {
      args.push("--allow-all-tools");
    }

    // Allow all paths (universal)
    if (frontmatter["allow-all-paths"]) {
      args.push("--allow-all-paths");
    }

    // Tool whitelist: tools.allow (new) or allow-tool (deprecated)
    const toolsAllow = frontmatter.tools?.allow ?? frontmatter["allow-tool"];
    for (const tool of toArray(toolsAllow)) {
      args.push("--allow-tool", tool);
    }

    // Tool blacklist: tools.deny (new) or deny-tool (deprecated)
    const toolsDeny = frontmatter.tools?.deny ?? frontmatter["deny-tool"];
    for (const tool of toArray(toolsDeny)) {
      args.push("--deny-tool", tool);
    }

    // MCP config (universal -> --additional-mcp-config)
    for (const config of toArray(frontmatter["mcp-config"])) {
      args.push("--additional-mcp-config", config);
    }

    // Debug (universal -> --log-level debug)
    if (frontmatter.debug) {
      args.push("--log-level", "debug");
    }

    // --- Copilot-Specific Keys ---

    // Agent
    if (copilotConfig.agent) {
      args.push("--agent", String(copilotConfig.agent));
    }

    // Silent: suppress session metadata (default: true for clean piping)
    // Only skip --silent if explicitly set to false
    if (copilotConfig.silent !== false) {
      args.push("--silent");
    }

    // Allow all paths from copilot config
    if (copilotConfig["allow-all-paths"]) {
      args.push("--allow-all-paths");
    }

    // Stream mode
    if (copilotConfig.stream) {
      args.push("--stream", String(copilotConfig.stream));
    }

    // Banner
    if (copilotConfig.banner) {
      args.push("--banner");
    }

    // No color
    if (copilotConfig["no-color"]) {
      args.push("--no-color");
    }

    // No custom instructions
    if (copilotConfig["no-custom-instructions"]) {
      args.push("--no-custom-instructions");
    }

    // Log level (copilot-specific, in addition to universal debug)
    if (copilotConfig["log-level"] && !frontmatter.debug) {
      args.push("--log-level", String(copilotConfig["log-level"]));
    }

    // --- Interactive mode ---
    // interactive: false -> -p (non-interactive, exits after)
    // interactive: true (or undefined) -> --interactive for REPL
    if (frontmatter.interactive === false) {
      args.push("-p");
    } else {
      args.push("--interactive");
    }

    // --- Passthrough: any copilot-specific keys we didn't handle ---
    args.push(...getHarnessPassthroughArgs(copilotConfig, HANDLED_COPILOT_KEYS));

    // --- CLI passthrough args (highest priority) ---
    args.push(...ctx.passthroughArgs);

    return args;
  }
}
