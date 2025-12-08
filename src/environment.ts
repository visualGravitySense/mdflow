/**
 * SystemEnvironment - Abstraction layer for system-level dependencies
 *
 * This interface allows the AgentRuntime to be tested without side effects
 * by injecting mock implementations for I/O, process control, and file system operations.
 */

/**
 * Abstract interface for system environment dependencies.
 * Allows injection of real or mock implementations for testing.
 */
export interface SystemEnvironment {
  /** Get command line arguments */
  readonly argv: string[];

  /** Environment variables */
  readonly env: Record<string, string | undefined>;

  /** Whether stdin is a TTY (interactive) */
  readonly isStdinTTY: boolean;

  /** Read stdin content (when piped) */
  readStdin(): Promise<string>;

  /** Write to stdout */
  writeStdout(data: string): void;

  /** Write to stderr */
  writeStderr(data: string): void;

  /** Exit the process with a code (only used at the very top level) */
  exit(code: number): never;

  /** Register a signal handler */
  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void;

  /** Register error handler for stdout */
  onStdoutError(handler: (err: NodeJS.ErrnoException) => void): void;

  /** Register error handler for stderr */
  onStderrError(handler: (err: NodeJS.ErrnoException) => void): void;

  /** Prompt user for input (interactive mode) */
  promptInput(message: string): Promise<string>;
}

/**
 * Real implementation of SystemEnvironment using Bun/Node APIs
 */
export class BunSystemEnvironment implements SystemEnvironment {
  get argv(): string[] {
    return process.argv;
  }

  get env(): Record<string, string | undefined> {
    return process.env;
  }

  get isStdinTTY(): boolean {
    return Boolean(process.stdin.isTTY);
  }

  async readStdin(): Promise<string> {
    if (process.stdin.isTTY) {
      return "";
    }

    const { MAX_INPUT_SIZE, exceedsLimit, StdinSizeLimitError } = await import("./limits");

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of process.stdin) {
      totalBytes += chunk.length;
      if (exceedsLimit(totalBytes)) {
        throw new StdinSizeLimitError(totalBytes);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8").trim();
  }

  writeStdout(data: string): void {
    console.log(data);
  }

  writeStderr(data: string): void {
    console.error(data);
  }

  exit(code: number): never {
    process.exit(code);
  }

  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): void {
    process.on(signal, handler);
  }

  onStdoutError(handler: (err: NodeJS.ErrnoException) => void): void {
    process.stdout.on("error", handler);
  }

  onStderrError(handler: (err: NodeJS.ErrnoException) => void): void {
    process.stderr.on("error", handler);
  }

  async promptInput(message: string): Promise<string> {
    const { input } = await import("@inquirer/prompts");
    return input({ message });
  }
}

/**
 * Create the default system environment for production use
 */
export function createSystemEnvironment(): SystemEnvironment {
  return new BunSystemEnvironment();
}
