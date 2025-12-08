/**
 * CommandBuilder - Pure functions for constructing command specifications
 *
 * This module separates command construction (pure) from execution (side effects).
 * All functions here are deterministic and testable without mocking process spawning.
 */

import type { AgentFrontmatter } from "./types";
import type { GlobalConfig } from "./config";

/**
 * Specification for a command to be executed
 * Contains all information needed to spawn a process
 */
export interface CommandSpec {
  /** The executable to run (e.g., "claude", "gemini") */
  executable: string;
  /** Command line arguments */
  args: string[];
  /** Environment variables to set (merged with process.env at execution time) */
  env: Record<string, string>;
  /** Working directory for the command */
  cwd: string;
}

/**
 * Keys handled by the system, not passed to the command
 * - args: consumed for template variable mapping
 * - env (when object): sets process.env, not passed as flag
 * - $N patterns: positional mapping, handled specially
 * - pre/before: lifecycle hooks
 * - post/after: lifecycle hooks
 * - context_window: token limit override
 */
const SYSTEM_KEYS = new Set([
  "args",
  "pre",
  "before",
  "post",
  "after",
  "context_window",
]);

/**
 * Check if a key is a positional mapping ($1, $2, etc.)
 */
function isPositionalKey(key: string): boolean {
  return /^\$\d+$/.test(key);
}

/**
 * Convert frontmatter key to CLI flag
 * e.g., "model" -> "--model"
 * e.g., "p" -> "-p"
 */
function toFlag(key: string): string {
  if (key.startsWith("-")) return key;
  if (key.length === 1) return `-${key}`;
  return `--${key}`;
}

/**
 * Build CLI args from frontmatter
 * Each key becomes a flag, values become arguments
 *
 * @param frontmatter - The parsed frontmatter from the markdown file
 * @param templateVars - Set of variable names used in templates (to skip)
 * @returns Array of CLI arguments
 */
export function buildArgsFromFrontmatter(
  frontmatter: AgentFrontmatter,
  templateVars: Set<string>
): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    // Skip system keys
    if (SYSTEM_KEYS.has(key)) continue;

    // Skip positional mappings ($1, $2, etc.) - handled separately
    if (isPositionalKey(key)) continue;

    // Skip named template variable fields ($varname) - consumed for template substitution
    if (key.startsWith("$")) continue;

    // Skip template variables (used for substitution, not passed to command)
    if (templateVars.has(key)) continue;

    // Handle polymorphic env key
    if (key === "env") {
      // Object form: sets process.env, skip here
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        continue;
      }
      // Array/string form: pass as --env flags (fall through)
    }

    // Skip undefined/null/false
    if (value === undefined || value === null || value === false) continue;

    // Boolean true -> just the flag
    if (value === true) {
      args.push(toFlag(key));
      continue;
    }

    // Array -> repeat flag for each value
    if (Array.isArray(value)) {
      for (const v of value) {
        args.push(toFlag(key), String(v));
      }
      continue;
    }

    // String/number -> flag with value
    args.push(toFlag(key), String(value));
  }

  return args;
}

/**
 * Extract positional mappings from frontmatter ($1, $2, etc.)
 * Returns a map of position number to flag name
 */
export function extractPositionalMappings(frontmatter: AgentFrontmatter): Map<number, string> {
  const mappings = new Map<number, string>();

  for (const [key, value] of Object.entries(frontmatter)) {
    if (isPositionalKey(key) && typeof value === "string") {
      const pos = parseInt(key.slice(1), 10);
      mappings.set(pos, value);
    }
  }

  return mappings;
}

/**
 * Extract environment variables to set (from object form of env)
 */
export function extractEnvVars(frontmatter: AgentFrontmatter): Record<string, string> {
  const env = frontmatter.env;
  if (typeof env === "object" && env !== null && !Array.isArray(env)) {
    return env as Record<string, string>;
  }
  return {};
}

/**
 * Apply positional arguments to args array based on mappings
 *
 * @param baseArgs - The base args built from frontmatter
 * @param positionals - Positional arguments (body is $1, additional CLI args are $2+)
 * @param mappings - Map of position number to flag name
 * @returns Final args array with positionals applied
 */
export function applyPositionalArgs(
  baseArgs: string[],
  positionals: string[],
  mappings: Map<number, string>
): string[] {
  const finalArgs = [...baseArgs];

  for (let i = 0; i < positionals.length; i++) {
    const pos = i + 1; // $1 is first positional
    const value = positionals[i];

    if (mappings.has(pos)) {
      // Map to flag: $1: prompt -> --prompt <value>
      const flagName = mappings.get(pos)!;
      finalArgs.push(toFlag(flagName), value);
    } else {
      // Pass as positional argument
      finalArgs.push(value);
    }
  }

  return finalArgs;
}

/**
 * Get command defaults from global config
 */
function getCommandDefaultsFromConfig(
  command: string,
  config: GlobalConfig
): Record<string, unknown> {
  return config.commands?.[command] ?? {};
}

/**
 * Build a complete CommandSpec from frontmatter, body, and configuration
 *
 * This is a pure function that returns a specification object.
 * No side effects - doesn't spawn processes or modify environment.
 *
 * @param command - The command to execute (e.g., "claude")
 * @param frontmatter - Parsed frontmatter from the markdown file
 * @param body - The prompt body text
 * @param positionalArgs - Additional positional arguments from CLI
 * @param templateVars - Set of template variable names (to exclude from args)
 * @param config - Global configuration with command defaults
 * @param cwd - Working directory for command execution
 * @returns CommandSpec ready for execution
 */
export function buildCommand(
  command: string,
  frontmatter: AgentFrontmatter,
  body: string,
  positionalArgs: string[],
  templateVars: Set<string>,
  config: GlobalConfig,
  cwd: string = process.cwd()
): CommandSpec {
  // Apply command defaults from config
  const defaults = getCommandDefaultsFromConfig(command, config);
  const mergedFrontmatter: AgentFrontmatter = { ...defaults, ...frontmatter };

  // Build base args from frontmatter
  const baseArgs = buildArgsFromFrontmatter(mergedFrontmatter, templateVars);

  // Extract positional mappings
  const positionalMappings = extractPositionalMappings(mergedFrontmatter);

  // Build positionals array: body is $1, additional args are $2+
  const positionals = [body, ...positionalArgs];

  // Apply positional arguments
  const finalArgs = applyPositionalArgs(baseArgs, positionals, positionalMappings);

  // Extract environment variables
  const env = extractEnvVars(mergedFrontmatter);

  return {
    executable: command,
    args: finalArgs,
    env,
    cwd,
  };
}

/**
 * Build a CommandSpec without positional argument processing
 * Useful when you want to handle positionals separately
 *
 * @param command - The command to execute
 * @param frontmatter - Parsed frontmatter
 * @param templateVars - Set of template variable names
 * @param config - Global configuration
 * @param cwd - Working directory
 * @returns Partial CommandSpec (args don't include positionals)
 */
export function buildCommandBase(
  command: string,
  frontmatter: AgentFrontmatter,
  templateVars: Set<string>,
  config: GlobalConfig,
  cwd: string = process.cwd()
): CommandSpec {
  // Apply command defaults from config
  const defaults = getCommandDefaultsFromConfig(command, config);
  const mergedFrontmatter: AgentFrontmatter = { ...defaults, ...frontmatter };

  // Build base args from frontmatter
  const args = buildArgsFromFrontmatter(mergedFrontmatter, templateVars);

  // Extract environment variables
  const env = extractEnvVars(mergedFrontmatter);

  return {
    executable: command,
    args,
    env,
    cwd,
  };
}
