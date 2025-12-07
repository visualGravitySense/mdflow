import { expect, test, describe } from "bun:test";
import { getLogDir, getAgentLogPath, listLogDirs } from "./logger";
import { homedir } from "os";
import { join } from "path";

describe("logger", () => {
  test("getLogDir returns correct path", () => {
    expect(getLogDir()).toBe(join(homedir(), ".markdown-agent", "logs"));
  });

  test("getAgentLogPath generates path based on agent name", () => {
    const path = getAgentLogPath("task.claude.md");
    expect(path).toBe(join(homedir(), ".markdown-agent", "logs", "task-claude", "debug.log"));
  });

  test("getAgentLogPath handles simple filenames", () => {
    const path = getAgentLogPath("review.md");
    expect(path).toBe(join(homedir(), ".markdown-agent", "logs", "review", "debug.log"));
  });

  test("listLogDirs returns array", () => {
    const dirs = listLogDirs();
    expect(Array.isArray(dirs)).toBe(true);
  });
});
