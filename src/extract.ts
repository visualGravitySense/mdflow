/**
 * Structured output extraction from LLM responses
 * Enables piping clean output to other Unix tools
 */

export type ExtractMode = "json" | "code" | "markdown" | "raw";

/**
 * Extract structured content from LLM response
 * Returns only the payload, stripping conversational text
 */
export function extractOutput(
  content: string,
  mode: ExtractMode
): string {
  switch (mode) {
    case "json":
      return extractJson(content);
    case "code":
      return extractCode(content);
    case "markdown":
      return extractMarkdown(content);
    case "raw":
    default:
      return content;
  }
}

/**
 * Extract JSON from response
 * Handles both raw JSON and JSON in code blocks
 */
function extractJson(content: string): string {
  // Try to find JSON in code block first
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const potential = codeBlockMatch[1]?.trim() ?? "";
    if (isValidJson(potential)) {
      return potential;
    }
  }

  // Try to find raw JSON object or array
  const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    const potential = jsonMatch[1]?.trim() ?? "";
    if (isValidJson(potential)) {
      return potential;
    }
  }

  // Return original if no JSON found
  return content;
}

/**
 * Extract code from response
 * Returns content from the first code block
 */
function extractCode(content: string): string {
  // Match fenced code blocks (with optional language)
  const match = content.match(/```(?:\w+)?\s*\n([\s\S]*?)\n```/);
  if (match) {
    return match[1]?.trim() ?? "";
  }

  // Try indented code blocks (4 spaces)
  const indentedLines: string[] = [];
  let inCodeBlock = false;

  for (const line of content.split("\n")) {
    if (line.startsWith("    ") || line.startsWith("\t")) {
      inCodeBlock = true;
      indentedLines.push(line.replace(/^(?:    |\t)/, ""));
    } else if (inCodeBlock && line.trim() === "") {
      indentedLines.push("");
    } else if (inCodeBlock) {
      break;
    }
  }

  if (indentedLines.length > 0) {
    return indentedLines.join("\n").trim();
  }

  return content;
}

/**
 * Extract markdown content, removing conversational wrapper
 * Returns content if it looks like markdown, otherwise returns as-is
 */
function extractMarkdown(content: string): string {
  // If content starts with common conversational patterns, try to strip them
  const lines = content.split("\n");
  let startIndex = 0;

  // Skip initial conversational lines
  const skipPatterns = [
    /^(here(?:'s| is)|sure|okay|certainly)/i,
    /^(I|Let me)/,
    /^(The|This|That) (?:is|was|will)/i,
  ];

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]?.trim() ?? "";
    if (line && skipPatterns.some(p => p.test(line))) {
      startIndex = i + 1;
    }
  }

  // Skip trailing conversational lines
  let endIndex = lines.length;
  const endSkipPatterns = [
    /^(Let me know|Feel free|Hope this helps)/i,
    /^(Is there anything else)/i,
  ];

  for (let i = lines.length - 1; i > startIndex; i--) {
    const line = lines[i]?.trim() ?? "";
    if (line && endSkipPatterns.some(p => p.test(line))) {
      endIndex = i;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
}

/**
 * Validate JSON string
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if extract mode is valid
 */
export function isValidExtractMode(mode: string): mode is ExtractMode {
  return ["json", "code", "markdown", "raw"].includes(mode);
}
