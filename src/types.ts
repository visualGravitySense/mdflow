/** Frontmatter configuration - keys become CLI flags */
export interface AgentFrontmatter {
  /** Named positional arguments to consume from CLI and map to template vars */
  args?: string[];

  /**
   * Environment variables (polymorphic):
   * - Object { KEY: "VAL" }: Sets process.env before execution
   * - Array ["KEY=VAL"] or String "KEY=VAL": Passes as --env flags to command
   */
  env?: Record<string, string> | string[] | string;

  /**
   * Context window limit override (in tokens)
   * If set, overrides the model-based default context limit
   * Useful for custom models or when you want to enforce a specific limit
   */
  context_window?: number;

  /**
   * Lifecycle hook: Command to run before context building
   * Output is prepended to the prompt body
   * Alias: `before`
   */
  pre?: string;

  /**
   * Lifecycle hook: Alias for `pre`
   * Command to run before context building, output prepended to prompt
   */
  before?: string;

  /**
   * Lifecycle hook: Command to run after execution completes
   * Receives exit code via MA_EXIT_CODE env var
   * Alias: `after`
   */
  post?: string;

  /**
   * Lifecycle hook: Alias for `post`
   * Command to run after execution completes
   */
  after?: string;

  /**
   * Positional argument mapping ($1, $2, etc.)
   * Maps positional arguments to CLI flags
   * Example: $1: prompt → body becomes --prompt <body>
   */
  [key: `$${number}`]: string;

  /**
   * Named template variables ($varname)
   * Reads value from --varname CLI flag and makes it available as {{ varname }}
   * Example: $feature_name: → reads --feature_name value → {{ feature_name }}
   */
  [key: `$${string}`]: string | undefined;

  /**
   * All other keys are passed directly as CLI flags to the command.
   * - String values: --key value
   * - Boolean true: --key
   * - Boolean false: (omitted)
   * - Arrays: --key value1 --key value2
   */
  [key: string]: unknown;
}

export interface ParsedMarkdown {
  frontmatter: AgentFrontmatter;
  body: string;
}

export interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
}

/**
 * Structured execution plan returned by dry-run mode
 *
 * Provides complete introspection of what would be executed,
 * enabling direct testing without parsing stdout.
 */
export interface ExecutionPlan {
  /** Type of result: dry-run shows plan, executed shows result, error shows failure */
  type: "dry-run" | "executed" | "error";
  /** The final prompt after all processing (imports, templates, stdin) */
  finalPrompt: string;
  /** The command that would be executed (e.g., "claude", "gemini") */
  command: string;
  /** CLI arguments built from frontmatter and passthrough */
  args: string[];
  /** Environment variables from frontmatter */
  env: Record<string, string>;
  /** Estimated token count for the final prompt */
  estimatedTokens: number;
  /** The parsed and merged frontmatter configuration */
  frontmatter: AgentFrontmatter;
  /** List of files that were imported/resolved (relative paths) */
  resolvedImports: string[];
  /** Template variables that were substituted */
  templateVars: Record<string, string>;
  /** Positional mappings from frontmatter ($1, $2, etc.) */
  positionalMappings: Record<number, string>;
}
