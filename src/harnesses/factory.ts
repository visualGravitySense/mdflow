/**
 * Harness factory - detection and instantiation
 * Determines which harness to use based on:
 * 1. CLI flag (--harness)
 * 2. Frontmatter (harness:)
 * 3. Model heuristic
 * 4. Fallback (copilot for backward compatibility)
 */

import type { AgentFrontmatter } from "../types";
import type { Harness, HarnessName } from "./types";
import { CopilotHarness } from "./copilot";
import { ClaudeHarness } from "./claude";
import { CodexHarness } from "./codex";
import { GeminiHarness } from "./gemini";

/** Model patterns for auto-detection */
const CLAUDE_MODELS = [
  "claude",
  "sonnet",
  "opus",
  "haiku",
];

const CODEX_MODELS = [
  "gpt-",
  "codex",
];

const GEMINI_MODELS = [
  "gemini",
];

/**
 * Create a harness instance by name
 */
export function createHarness(name: HarnessName): Harness {
  switch (name) {
    case "claude":
      return new ClaudeHarness();
    case "codex":
      return new CodexHarness();
    case "copilot":
      return new CopilotHarness();
    case "gemini":
      return new GeminiHarness();
    default:
      throw new Error(`Unknown harness: ${name}`);
  }
}

/** @deprecated Use createHarness instead */
export const createRunner = createHarness;

/**
 * Detect harness from model name
 */
export function detectHarnessFromModel(model: string): HarnessName | null {
  const lowerModel = model.toLowerCase();

  // Check Claude models
  for (const pattern of CLAUDE_MODELS) {
    if (lowerModel.includes(pattern)) {
      return "claude";
    }
  }

  // Check Codex/GPT models
  for (const pattern of CODEX_MODELS) {
    if (lowerModel.includes(pattern)) {
      return "codex";
    }
  }

  // Check Gemini models
  for (const pattern of GEMINI_MODELS) {
    if (lowerModel.includes(pattern)) {
      return "gemini";
    }
  }

  return null;
}

/** @deprecated Use detectHarnessFromModel instead */
export const detectRunnerFromModel = detectHarnessFromModel;

/**
 * Check if a harness binary is available
 */
export async function isHarnessAvailable(name: HarnessName): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", name], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/** @deprecated Use isHarnessAvailable instead */
export const isRunnerAvailable = isHarnessAvailable;

export interface ResolveHarnessOptions {
  /** CLI override (highest priority) */
  cliHarness?: HarnessName;
  /** Parsed frontmatter */
  frontmatter: AgentFrontmatter;
}

/** @deprecated Use ResolveHarnessOptions instead */
export type ResolveRunnerOptions = ResolveHarnessOptions;

/**
 * Helper to determine harness name from options
 */
function determineHarnessName(options: ResolveHarnessOptions): HarnessName {
  const { cliHarness, frontmatter } = options;

  // 1. CLI flag takes highest priority
  if (cliHarness) {
    return cliHarness;
  }

  // 2. Frontmatter explicit harness (support both 'harness' and legacy 'runner')
  const harnessField = (frontmatter as any).harness || frontmatter.runner;
  if (harnessField && harnessField !== "auto") {
    return harnessField;
  }

  // 3. Model heuristic
  if (frontmatter.model) {
    const detected = detectHarnessFromModel(frontmatter.model);
    if (detected) {
      return detected;
    }
  }

  // 4. Fallback to copilot for backward compatibility
  return "copilot";
}

/**
 * Resolve which harness to use based on priority:
 * 1. CLI flag
 * 2. Frontmatter harness field
 * 3. Model heuristic
 * 4. Fallback to copilot
 */
export async function resolveHarness(options: ResolveHarnessOptions): Promise<Harness> {
  const harnessName = determineHarnessName(options);
  return createHarness(harnessName);
}

/** @deprecated Use resolveHarness instead */
export const resolveRunner = resolveHarness;

/**
 * Get harness without async availability check (synchronous version)
 */
export function resolveHarnessSync(options: ResolveHarnessOptions): Harness {
  const harnessName = determineHarnessName(options);
  return createHarness(harnessName);
}

/** @deprecated Use resolveHarnessSync instead */
export const resolveRunnerSync = resolveHarnessSync;

/**
 * List all available harnesses with their availability status
 */
export async function listHarnesses(): Promise<Array<{ name: HarnessName; available: boolean }>> {
  const harnesses: HarnessName[] = ["copilot", "claude", "codex", "gemini"];
  const results = await Promise.all(
    harnesses.map(async (name) => ({
      name,
      available: await isHarnessAvailable(name),
    }))
  );
  return results;
}

/** @deprecated Use listHarnesses instead */
export const listRunners = listHarnesses;
