import { expect, test, describe } from "bun:test";
import { validateInputField } from "./inputs";

describe("validateInputField", () => {
  test("validates a text input", () => {
    const field = validateInputField(
      { name: "branch", type: "text", message: "Which branch?" },
      0
    );
    expect(field.name).toBe("branch");
    expect(field.type).toBe("text");
    expect(field.message).toBe("Which branch?");
  });

  test("validates a confirm input", () => {
    const field = validateInputField(
      { name: "force", type: "confirm", message: "Force push?", default: false },
      0
    );
    expect(field.name).toBe("force");
    expect(field.type).toBe("confirm");
    expect(field.default).toBe(false);
  });

  test("validates a select input with choices", () => {
    const field = validateInputField(
      {
        name: "env",
        type: "select",
        message: "Environment?",
        choices: ["dev", "staging", "prod"],
      },
      0
    );
    expect(field.type).toBe("select");
    expect(field.choices).toEqual(["dev", "staging", "prod"]);
  });

  test("rejects null input", () => {
    expect(() => validateInputField(null, 0)).toThrow(
      "Input at index 0 must be an object"
    );
  });

  test("rejects input without name", () => {
    expect(() =>
      validateInputField({ type: "text", message: "test" }, 0)
    ).toThrow('Input at index 0 missing required "name" field');
  });

  test("rejects input without message", () => {
    expect(() => validateInputField({ name: "test", type: "text" }, 0)).toThrow(
      'Input "test" missing required "message" field'
    );
  });

  test("rejects invalid type", () => {
    expect(() =>
      validateInputField(
        { name: "test", type: "invalid", message: "test" },
        0
      )
    ).toThrow("Input \"test\" has invalid type");
  });

  test("rejects select without choices", () => {
    expect(() =>
      validateInputField(
        { name: "env", type: "select", message: "Env?" },
        0
      )
    ).toThrow('Select input "env" requires "choices" array');
  });
});
