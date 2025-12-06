# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**markdown-agent** (`ma`) is a CLI tool that executes AI agents defined as markdown files. It parses YAML frontmatter for configuration and routes prompts to multiple AI backends (harnesses): Claude, Codex, Copilot, and Gemini.

## Commands

```bash
# Run tests (bail on first failure)
bun test --bail=1

# Run single test file
bun test src/cli.test.ts

# Run a specific test by name
bun test --test-name-pattern "parses model"

# Execute the CLI directly
bun run src/index.ts TASK.md

# Or using the alias
bun run ma TASK.md
```

## Architecture

### Core Flow (`src/index.ts`)
```
.md file → parseFrontmatter() → mergeFrontmatter(cli overrides)
        → expandImports() → substituteTemplateVars()
        → resolveHarness() → harness.run()
        → extractOutput() → runAfterCommands()
```

### Key Modules

- **`harnesses/`** - Multi-backend abstraction layer
  - `types.ts`: `Harness` interface and `BaseHarness` abstract class
  - `factory.ts`: Harness detection (CLI > frontmatter > model heuristic > fallback)
  - `claude.ts`, `codex.ts`, `copilot.ts`, `gemini.ts`: Backend implementations

- **`types.ts`** - Core TypeScript interfaces
  - `AgentFrontmatter`: Universal frontmatter schema with harness-specific escape hatches
  - Harness-specific configs: `ClaudeConfig`, `CodexConfig`, `CopilotConfig`, `GeminiConfig`

- **`schema.ts`** - Zod validation for frontmatter

- **`imports.ts`** - File imports (`@./path.md`) and command inlines (`` !`cmd` ``)

- **`batch.ts`** - Swarm execution via `--run-batch` with git worktree isolation

### Frontmatter Key Hierarchy

The system uses universal keys that map to all backends, with deprecated aliases for backward compatibility:
- `approval: "yolo"` → maps to `--dangerously-skip-permissions` (Claude), `--yolo` (Gemini), etc.
- `tools: { allow: [...], deny: [...] }` → preferred over `allow-tool`/`deny-tool`
- `session: { resume: true }` → preferred over `resume: true` or `continue: true`

Harness-specific escape hatches (`claude:`, `codex:`, `copilot:`, `gemini:`) pass through any flags not yet universally mapped.

### Template System

- `{{ variable }}` syntax in markdown body
- CLI args: `--varname value` (unknown flags become template vars)
- `inputs:` frontmatter for wizard mode (interactive prompts)

## Testing Patterns

Tests use Bun's test runner with `describe`/`it` blocks:

```typescript
import { describe, it, expect } from "bun:test";

describe("parseCliArgs", () => {
  it("parses model flag", () => {
    const result = parseCliArgs(["node", "script", "file.md", "--model", "gpt-4"]);
    expect(result.overrides.model).toBe("gpt-4");
  });
});
```
