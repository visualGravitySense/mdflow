import { expect, test, describe } from "bun:test";
import { extractOutput, isValidExtractMode } from "./extract";

describe("extractOutput - json", () => {
  test("extracts JSON from code block", () => {
    const input = `Here is the JSON you asked for:

\`\`\`json
{"version": "1.0.0"}
\`\`\`

Let me know if you need anything else!`;
    const result = extractOutput(input, "json");
    expect(result).toBe('{"version": "1.0.0"}');
  });

  test("extracts JSON from plain code block", () => {
    const input = `\`\`\`
{"key": "value"}
\`\`\``;
    const result = extractOutput(input, "json");
    expect(result).toBe('{"key": "value"}');
  });

  test("extracts raw JSON object", () => {
    const input = `The result is {"status": "ok", "count": 42}`;
    const result = extractOutput(input, "json");
    expect(result).toBe('{"status": "ok", "count": 42}');
  });

  test("extracts JSON array", () => {
    const input = `Here are the items: ["a", "b", "c"]`;
    const result = extractOutput(input, "json");
    expect(result).toBe('["a", "b", "c"]');
  });

  test("extracts multiline JSON", () => {
    const input = `\`\`\`json
{
  "name": "test",
  "value": 123
}
\`\`\``;
    const result = extractOutput(input, "json");
    expect(JSON.parse(result)).toEqual({ name: "test", value: 123 });
  });

  test("returns original if no valid JSON", () => {
    const input = "No JSON here, just text.";
    const result = extractOutput(input, "json");
    expect(result).toBe(input);
  });
});

describe("extractOutput - code", () => {
  test("extracts code from fenced block", () => {
    const input = `Here's the code:

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

Hope this helps!`;
    const result = extractOutput(input, "code");
    expect(result).toBe("const x = 1;\nconst y = 2;");
  });

  test("extracts code from plain fenced block", () => {
    const input = `\`\`\`
function hello() {}
\`\`\``;
    const result = extractOutput(input, "code");
    expect(result).toBe("function hello() {}");
  });

  test("extracts indented code block", () => {
    const input = `Some text

    const x = 1;
    const y = 2;

More text`;
    const result = extractOutput(input, "code");
    expect(result).toBe("const x = 1;\nconst y = 2;");
  });

  test("returns original if no code block", () => {
    const input = "Just plain text without code.";
    const result = extractOutput(input, "code");
    expect(result).toBe(input);
  });
});

describe("extractOutput - markdown", () => {
  test("strips conversational prefix", () => {
    const input = `Here's the document you requested:

# Title

Content here.`;
    const result = extractOutput(input, "markdown");
    expect(result).toBe("# Title\n\nContent here.");
  });

  test("strips conversational suffix", () => {
    const input = `# Document

Content

Let me know if you need anything else!`;
    const result = extractOutput(input, "markdown");
    expect(result).toBe("# Document\n\nContent");
  });

  test("handles markdown without conversational wrapper", () => {
    const input = `# Pure Markdown

No wrapper here.`;
    const result = extractOutput(input, "markdown");
    expect(result).toBe(input);
  });
});

describe("extractOutput - raw", () => {
  test("returns content unchanged", () => {
    const input = "Some content with\nmultiple lines";
    const result = extractOutput(input, "raw");
    expect(result).toBe(input);
  });
});

describe("isValidExtractMode", () => {
  test("validates correct modes", () => {
    expect(isValidExtractMode("json")).toBe(true);
    expect(isValidExtractMode("code")).toBe(true);
    expect(isValidExtractMode("markdown")).toBe(true);
    expect(isValidExtractMode("raw")).toBe(true);
  });

  test("rejects invalid modes", () => {
    expect(isValidExtractMode("invalid")).toBe(false);
    expect(isValidExtractMode("")).toBe(false);
    expect(isValidExtractMode("JSON")).toBe(false); // Case sensitive
  });
});
