import { describe, it, expect } from "bun:test";
import {
  teeStream,
  collectStream,
  pipeToStdout,
  pipeToStderr,
  teeToStdoutAndCollect,
  teeToStderrAndCollect,
} from "./stream";

/**
 * Helper to create a readable stream from a string
 */
function createWebStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(str));
      controller.close();
    },
  });
}

/**
 * Helper to create a readable stream with multiple chunks
 */
function chunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("stream utilities", () => {
  describe("teeStream", () => {
    it("produces two independent streams with identical content", async () => {
      const source = createWebStream("Hello, World!");
      const [streamA, streamB] = teeStream(source);

      // Collect both streams independently
      const [contentA, contentB] = await Promise.all([
        collectStream(streamA),
        collectStream(streamB),
      ]);

      expect(contentA).toBe("Hello, World!");
      expect(contentB).toBe("Hello, World!");
      expect(contentA).toBe(contentB);
    });

    it("handles multiple chunks correctly", async () => {
      const source = chunkedStream(["Hello", ", ", "World", "!"]);
      const [streamA, streamB] = teeStream(source);

      const [contentA, contentB] = await Promise.all([
        collectStream(streamA),
        collectStream(streamB),
      ]);

      expect(contentA).toBe("Hello, World!");
      expect(contentB).toBe("Hello, World!");
    });

    it("handles empty streams", async () => {
      const source = createWebStream("");
      const [streamA, streamB] = teeStream(source);

      const [contentA, contentB] = await Promise.all([
        collectStream(streamA),
        collectStream(streamB),
      ]);

      expect(contentA).toBe("");
      expect(contentB).toBe("");
    });

    it("handles unicode content", async () => {
      const unicodeText = "Hello World! Emoji: \u{1F60A} \u{1F680}";
      const source = createWebStream(unicodeText);
      const [streamA, streamB] = teeStream(source);

      const [contentA, contentB] = await Promise.all([
        collectStream(streamA),
        collectStream(streamB),
      ]);

      expect(contentA).toBe(unicodeText);
      expect(contentB).toBe(unicodeText);
    });
  });

  describe("collectStream", () => {
    it("collects single chunk stream to string", async () => {
      const source = createWebStream("Test content");
      const result = await collectStream(source);
      expect(result).toBe("Test content");
    });

    it("collects multi-chunk stream to string", async () => {
      const source = chunkedStream(["Line 1\n", "Line 2\n", "Line 3"]);
      const result = await collectStream(source);
      expect(result).toBe("Line 1\nLine 2\nLine 3");
    });

    it("handles binary-like content with high bytes", async () => {
      const content = "Binary test: \x00\x01\x02\xFF";
      const source = createWebStream(content);
      const result = await collectStream(source);
      // Note: TextDecoder may replace invalid sequences
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles large content efficiently", async () => {
      const largeContent = "x".repeat(100_000);
      const source = createWebStream(largeContent);
      const result = await collectStream(source);
      expect(result.length).toBe(100_000);
    });
  });

  describe("pipeToStdout", () => {
    it("pipes content to stdout without throwing", async () => {
      const source = createWebStream("stdout test");
      // Should not throw
      await expect(pipeToStdout(source)).resolves.toBeUndefined();
    });

    it("handles empty stream", async () => {
      const source = createWebStream("");
      await expect(pipeToStdout(source)).resolves.toBeUndefined();
    });
  });

  describe("pipeToStderr", () => {
    it("pipes content to stderr without throwing", async () => {
      const source = createWebStream("stderr test");
      await expect(pipeToStderr(source)).resolves.toBeUndefined();
    });
  });

  describe("teeToStdoutAndCollect", () => {
    it("returns collected content while piping to stdout", async () => {
      const content = "Tee test content";
      const source = createWebStream(content);
      const result = await teeToStdoutAndCollect(source);
      expect(result).toBe(content);
    });

    it("handles multi-chunk streams", async () => {
      const source = chunkedStream(["chunk1 ", "chunk2 ", "chunk3"]);
      const result = await teeToStdoutAndCollect(source);
      expect(result).toBe("chunk1 chunk2 chunk3");
    });

    it("handles empty stream", async () => {
      const source = createWebStream("");
      const result = await teeToStdoutAndCollect(source);
      expect(result).toBe("");
    });
  });

  describe("teeToStderrAndCollect", () => {
    it("returns collected content while piping to stderr", async () => {
      const content = "Stderr tee content";
      const source = createWebStream(content);
      const result = await teeToStderrAndCollect(source);
      expect(result).toBe(content);
    });
  });
});

describe("stream teeing integration", () => {
  it("tee produces identical content on both branches with async consumption", async () => {
    const originalContent = "Integration test: line 1\nline 2\nline 3\n";
    const source = createWebStream(originalContent);
    const [displayStream, captureStream] = teeStream(source);

    // Simulate async consumption at different rates
    let displayContent = "";
    let captureContent = "";

    const displayPromise = (async () => {
      const reader = displayStream.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        displayContent += decoder.decode(value, { stream: true });
        // Add small delay to simulate real-world async
        await new Promise((r) => setTimeout(r, 1));
      }
      displayContent += decoder.decode();
    })();

    const capturePromise = (async () => {
      captureContent = await collectStream(captureStream);
    })();

    await Promise.all([displayPromise, capturePromise]);

    expect(displayContent).toBe(originalContent);
    expect(captureContent).toBe(originalContent);
  });
});
