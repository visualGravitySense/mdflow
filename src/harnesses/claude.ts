/**
 * Claude Code CLI harness
 * Maps universal frontmatter to claude CLI flags
 */

import { BaseHarness, type RunContext, type RunResult, type HarnessName } from "./types";
import { getHarnessPassthroughArgs, toArray } from "./flags";

/**
 * Keys explicitly handled by this harness (not passed through)
 */
const HANDLED_CLAUDE_KEYS = new Set([
  "dangerously-skip-permissions",
  "permission-mode",
  "mcp-config",
  "strict-mcp-config",
  "allowed-tools",
  "disallowed-tools",
  "system-prompt",
  "append-system-prompt",
  "betas",
  "fork-session",
  "ide",
]);

/**
 * Map generic model names to Claude-specific models
 */
export function mapClaudeModel(model: string): string {
  const modelMap: Record<string, string> = {
    "sonnet": "sonnet",
    "opus": "opus",
    "haiku": "haiku",
    "claude-sonnet-4": "sonnet",
    "claude-sonnet-4.5": "sonnet",
    "claude-opus-4.5": "opus",
    "claude-haiku-4.5": "haiku",
  };
  return modelMap[model] || model;
}

export class ClaudeHarness extends BaseHarness {
  readonly name: HarnessName = "claude";

  getCommand(): string {
    return "claude";
  }

  buildArgs(ctx: RunContext): string[] {
    const { frontmatter } = ctx;
    const args: string[] = [];
    const claudeConfig = frontmatter.claude || {};

    // --- Universal Keys ---

    // Model
    if (frontmatter.model) {
      args.push("--model", mapClaudeModel(frontmatter.model));
    }

    // Interactive mode: false = -p (print mode, run & exit)
    if (frontmatter.interactive === false) {
      args.push("-p");
    }

    // Session: new unified form takes precedence
    const sessionResume = frontmatter.session?.resume ?? frontmatter.resume;
    const sessionContinue = frontmatter.continue;
    if (sessionContinue || sessionResume === true) {
      args.push("-c");
    } else if (typeof sessionResume === "string") {
      args.push("-r", sessionResume);
    }
    // Fork session (Claude-specific, but can be in universal session config)
    if (frontmatter.session?.fork || claudeConfig["fork-session"]) {
      args.push("--fork-session");
    }

    // Directory access: dirs (new) or add-dir (deprecated)
    const directories = frontmatter.dirs ?? frontmatter["add-dir"];
    for (const dir of toArray(directories)) {
      args.push("--add-dir", dir);
    }

    // Approval mode: approval (new) or allow-all-tools (deprecated)
    const isYolo = frontmatter.approval === "yolo" ||
                   frontmatter["allow-all-tools"] ||
                   claudeConfig["dangerously-skip-permissions"];
    if (isYolo) {
      args.push("--dangerously-skip-permissions");
    }
    // Note: "sandbox" mode doesn't change Claude behavior (no sandboxing in Claude)

    // Tool whitelist: tools.allow (new) or allow-tool (deprecated)
    const toolsAllow = frontmatter.tools?.allow ?? frontmatter["allow-tool"];
    for (const tool of toArray(toolsAllow)) {
      args.push("--allowed-tools", tool);
    }

    // Tool blacklist: tools.deny (new) or deny-tool (deprecated)
    const toolsDeny = frontmatter.tools?.deny ?? frontmatter["deny-tool"];
    for (const tool of toArray(toolsDeny)) {
      args.push("--disallowed-tools", tool);
    }

    // MCP config (universal)
    for (const config of toArray(frontmatter["mcp-config"])) {
      args.push("--mcp-config", config);
    }

    // Output format: output (new) or output-format (deprecated)
    const outputFormat = frontmatter.output ?? frontmatter["output-format"];
    if (outputFormat) {
      args.push("--output-format", outputFormat);
    }

    // Debug
    if (frontmatter.debug === true) {
      args.push("--debug");
    } else if (typeof frontmatter.debug === "string") {
      args.push("--debug", frontmatter.debug);
    }

    // --- Claude-Specific Keys ---

    // Permission mode (more granular than god mode)
    if (claudeConfig["permission-mode"]) {
      args.push("--permission-mode", String(claudeConfig["permission-mode"]));
    }

    // Claude-specific allowed-tools (pattern syntax)
    if (claudeConfig["allowed-tools"]) {
      args.push("--allowed-tools", String(claudeConfig["allowed-tools"]));
    }

    // Claude-specific disallowed-tools
    if (claudeConfig["disallowed-tools"]) {
      args.push("--disallowed-tools", String(claudeConfig["disallowed-tools"]));
    }

    // MCP config from claude-specific (in addition to universal)
    for (const config of toArray(claudeConfig["mcp-config"] as string | string[])) {
      args.push("--mcp-config", config);
    }

    // Strict MCP config
    if (claudeConfig["strict-mcp-config"]) {
      args.push("--strict-mcp-config");
    }

    // System prompt
    if (claudeConfig["system-prompt"]) {
      args.push("--system-prompt", String(claudeConfig["system-prompt"]));
    }

    // Append system prompt
    if (claudeConfig["append-system-prompt"]) {
      args.push("--append-system-prompt", String(claudeConfig["append-system-prompt"]));
    }

    // Beta headers
    for (const beta of toArray(claudeConfig.betas as string | string[])) {
      args.push("--betas", beta);
    }

    // Fork session
    if (claudeConfig["fork-session"]) {
      args.push("--fork-session");
    }

    // IDE integration
    if (claudeConfig.ide) {
      args.push("--ide");
    }

    // --- Passthrough: any claude-specific keys we didn't handle ---
    args.push(...getHarnessPassthroughArgs(claudeConfig, HANDLED_CLAUDE_KEYS));

    // --- CLI passthrough args (highest priority) ---
    args.push(...ctx.passthroughArgs);

    return args;
  }
}