/**
 * IO Streams utilities for stdin abstraction
 *
 * Provides helpers to create IOStreams instances for testing and production use.
 * Enables testing piping scenarios without real shell pipes.
 */

import { Readable, Writable } from "stream";
import type { IOStreams } from "./types";
import { MAX_INPUT_SIZE, StdinSizeLimitError, exceedsLimit } from "./limits";

/**
 * Create the default IO streams using process.stdin/stdout/stderr
 */
export function createDefaultStreams(): IOStreams {
  return {
    stdin: process.stdin.isTTY ? null : process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    isTTY: process.stdin.isTTY ?? false,
  };
}

/**
 * Create a readable stream from a string
 * Useful for testing piped input scenarios
 */
export function stringToStream(content: string): NodeJS.ReadableStream {
  const readable = new Readable({
    read() {
      this.push(Buffer.from(content, "utf-8"));
      this.push(null);
    },
  });
  return readable;
}

/**
 * Create a writable stream that collects output to a string
 * Useful for capturing stdout/stderr in tests
 */
export function createCaptureStream(): { stream: NodeJS.WritableStream; getOutput: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  return {
    stream,
    getOutput: () => Buffer.concat(chunks).toString("utf-8"),
  };
}

/**
 * Create IOStreams for testing with simulated stdin
 *
 * @param stdinContent - Content to simulate as piped stdin (null for TTY mode)
 * @returns IOStreams instance with capture streams for stdout/stderr
 */
export function createTestStreams(stdinContent: string | null = null): {
  streams: IOStreams;
  getStdout: () => string;
  getStderr: () => string;
} {
  const stdout = createCaptureStream();
  const stderr = createCaptureStream();

  return {
    streams: {
      stdin: stdinContent !== null ? stringToStream(stdinContent) : null,
      stdout: stdout.stream,
      stderr: stderr.stream,
      isTTY: stdinContent === null,
    },
    getStdout: stdout.getOutput,
    getStderr: stderr.getOutput,
  };
}

/**
 * Read all content from an input stream with size limit enforcement
 *
 * @param stream - Readable stream to consume
 * @returns Promise resolving to the stream content as a string
 * @throws StdinSizeLimitError if content exceeds MAX_INPUT_SIZE
 */
export async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (exceedsLimit(totalBytes)) {
      throw new StdinSizeLimitError(totalBytes);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf-8").trim();
}

/**
 * Read stdin content from IOStreams
 * Returns empty string if stdin is null (TTY mode)
 *
 * @param streams - IOStreams instance
 * @returns Promise resolving to stdin content or empty string
 */
export async function readStdinFromStreams(streams: IOStreams): Promise<string> {
  if (!streams.stdin) {
    return "";
  }
  return readStream(streams.stdin);
}

/**
 * Check if streams indicate TTY (interactive) mode
 */
export function isInteractive(streams: IOStreams): boolean {
  return streams.isTTY;
}

/**
 * Write to stdout stream
 */
export function writeStdout(streams: IOStreams, content: string): void {
  streams.stdout.write(content);
}

/**
 * Write to stderr stream
 */
export function writeStderr(streams: IOStreams, content: string): void {
  streams.stderr.write(content);
}
