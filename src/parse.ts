import type { CopilotFrontmatter, ParsedMarkdown, InputField } from "./types";

/**
 * Strip shebang line from content if present
 * Allows markdown files to be executable with #!/usr/bin/env md-agent
 */
export function stripShebang(content: string): string {
  const lines = content.split("\n");
  if (lines[0]?.startsWith("#!")) {
    return lines.slice(1).join("\n");
  }
  return content;
}

/**
 * Parse YAML frontmatter from markdown content
 * Automatically strips shebang line if present
 */
export function parseFrontmatter(content: string): ParsedMarkdown {
  // Strip shebang first
  const strippedContent = stripShebang(content);
  const lines = strippedContent.split("\n");

  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, body: strippedContent };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join("\n").trim();
  const frontmatter = parseYamlSimple(frontmatterLines);

  return { frontmatter, body };
}

/**
 * Get indentation level of a line
 */
function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Parse a YAML value (handles booleans, arrays, strings)
 */
function parseValue(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Inline array: [item1, item2]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(s => s.trim().replace(/^["']|["']$/g, ""));
  }

  // Remove quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Parse YAML for frontmatter with support for nested objects in arrays
 */
function parseYamlSimple(lines: string[]): CopilotFrontmatter {
  const result: Record<string, unknown> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Top-level key: value
    const topMatch = line.match(/^(\S+):\s*(.*)$/);
    if (topMatch) {
      const [, key, value] = topMatch;
      if (!key) {
        i++;
        continue;
      }

      const trimmedValue = value?.trim() ?? "";

      // If value is empty, it's an array or nested object
      if (trimmedValue === "") {
        // Look ahead to determine type
        const nextLine = lines[i + 1];
        if (nextLine && /^\s+-\s*/.test(nextLine)) {
          // It's an array - check if items are objects or strings
          const arrayResult = parseArray(lines, i + 1);
          result[key] = arrayResult.items;
          i = arrayResult.endIndex;
          continue;
        }
      } else {
        // Inline value
        result[key] = parseValue(trimmedValue);
      }
    }

    i++;
  }

  return result as CopilotFrontmatter;
}

/**
 * Parse an array starting at index, handles both string arrays and object arrays
 */
function parseArray(
  lines: string[],
  startIndex: number
): { items: unknown[]; endIndex: number } {
  const items: unknown[] = [];
  let i = startIndex;
  const arrayIndent = getIndent(lines[i] ?? "");

  while (i < lines.length) {
    const line = lines[i]!;
    const lineIndent = getIndent(line);

    // If we've dedented past array level, we're done
    if (line.trim() !== "" && lineIndent < arrayIndent) {
      break;
    }

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Array item marker
    const itemMatch = line.match(/^(\s*)-\s*(.*)$/);
    if (itemMatch && lineIndent === arrayIndent) {
      const [, , inlineValue] = itemMatch;
      const trimmedInline = inlineValue?.trim() ?? "";

      // Check if it's an inline object or has nested properties
      if (trimmedInline === "" || trimmedInline.match(/^\w+:/)) {
        // It's an object - parse nested properties
        const objResult = parseArrayObject(lines, i, arrayIndent);
        items.push(objResult.obj);
        i = objResult.endIndex;
      } else {
        // Simple string value
        items.push(trimmedInline);
        i++;
      }
    } else {
      i++;
    }
  }

  return { items, endIndex: i };
}

/**
 * Parse an object within an array (nested properties)
 */
function parseArrayObject(
  lines: string[],
  startIndex: number,
  arrayIndent: number
): { obj: Record<string, unknown>; endIndex: number } {
  const obj: Record<string, unknown> = {};
  let i = startIndex;
  const line = lines[i]!;

  // Check for inline key on same line as dash
  const inlineMatch = line.match(/^(\s*)-\s*(\w+):\s*(.*)$/);
  if (inlineMatch) {
    const [, , key, value] = inlineMatch;
    if (key) {
      obj[key] = parseValue(value ?? "");
    }
    i++;
  } else {
    // Just a dash, properties follow
    i++;
  }

  // Parse nested properties
  while (i < lines.length) {
    const propLine = lines[i]!;
    const propIndent = getIndent(propLine);

    // If we've dedented to array level or below, we're done with this object
    if (propLine.trim() !== "" && propIndent <= arrayIndent) {
      break;
    }

    // Skip empty lines
    if (propLine.trim() === "") {
      i++;
      continue;
    }

    // Property of the object
    const propMatch = propLine.match(/^\s+(\w+):\s*(.*)$/);
    if (propMatch) {
      const [, key, value] = propMatch;
      if (key) {
        const trimmedValue = value?.trim() ?? "";

        // Check for nested array (like choices)
        if (trimmedValue === "") {
          const nextLine = lines[i + 1];
          if (nextLine && /^\s+-\s*/.test(nextLine)) {
            const nestedArray = parseNestedStringArray(lines, i + 1, propIndent);
            obj[key] = nestedArray.items;
            i = nestedArray.endIndex;
            continue;
          }
        }

        obj[key] = parseValue(trimmedValue);
      }
    }

    i++;
  }

  return { obj, endIndex: i };
}

/**
 * Parse a simple nested string array (for things like choices)
 */
function parseNestedStringArray(
  lines: string[],
  startIndex: number,
  parentIndent: number
): { items: string[]; endIndex: number } {
  const items: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i]!;
    const lineIndent = getIndent(line);

    // If we've dedented past parent level, we're done
    if (line.trim() !== "" && lineIndent <= parentIndent) {
      break;
    }

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Array item
    const itemMatch = line.match(/^\s+-\s*(.*)$/);
    if (itemMatch) {
      const value = itemMatch[1]?.trim() ?? "";
      if (value) {
        items.push(value.replace(/^["']|["']$/g, ""));
      }
    }

    i++;
  }

  return { items, endIndex: i };
}
