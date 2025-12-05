/**
 * Interactive input handling for wizard mode
 * Prompts users for required inputs before AI execution
 */

import { input, confirm, select, password } from "@inquirer/prompts";
import type { InputField } from "./types";
import type { TemplateVars } from "./template";

/**
 * Prompt user for all defined inputs
 * Skips inputs that are already provided via CLI template vars
 */
export async function promptInputs(
  fields: InputField[],
  existingVars: TemplateVars = {}
): Promise<TemplateVars> {
  const results: TemplateVars = { ...existingVars };

  for (const field of fields) {
    // Skip if already provided via CLI
    if (field.name in existingVars) {
      continue;
    }

    const value = await promptField(field);
    results[field.name] = value;
  }

  return results;
}

/**
 * Prompt for a single field based on its type
 */
async function promptField(field: InputField): Promise<string> {
  switch (field.type) {
    case "text":
      return await input({
        message: field.message,
        default: field.default as string | undefined,
      });

    case "password":
      return await password({
        message: field.message,
      });

    case "confirm":
      const confirmed = await confirm({
        message: field.message,
        default: field.default as boolean | undefined,
      });
      return confirmed ? "true" : "false";

    case "select":
      if (!field.choices || field.choices.length === 0) {
        throw new Error(`Select field "${field.name}" requires choices`);
      }
      return await select({
        message: field.message,
        choices: field.choices.map(c => ({ value: c, name: c })),
        default: field.default as string | undefined,
      });

    default:
      throw new Error(`Unknown input type: ${field.type}`);
  }
}

/**
 * Validate that an InputField has required properties
 */
export function validateInputField(field: unknown, index: number): InputField {
  if (typeof field !== "object" || field === null) {
    throw new Error(`Input at index ${index} must be an object`);
  }

  const f = field as Record<string, unknown>;

  if (typeof f.name !== "string" || !f.name) {
    throw new Error(`Input at index ${index} missing required "name" field`);
  }

  if (typeof f.message !== "string" || !f.message) {
    throw new Error(`Input "${f.name}" missing required "message" field`);
  }

  const validTypes = ["text", "confirm", "select", "password"];
  if (typeof f.type !== "string" || !validTypes.includes(f.type)) {
    throw new Error(
      `Input "${f.name}" has invalid type. Must be: ${validTypes.join(", ")}`
    );
  }

  if (f.type === "select" && (!Array.isArray(f.choices) || f.choices.length === 0)) {
    throw new Error(`Select input "${f.name}" requires "choices" array`);
  }

  return {
    name: f.name,
    type: f.type as InputField["type"],
    message: f.message,
    default: f.default as string | boolean | undefined,
    choices: f.choices as string[] | undefined,
  };
}
