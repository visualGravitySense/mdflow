# RFC: Universal Key Naming Discussion

Vote on naming alternatives for universal frontmatter keys.

---

## 1. Execution Mode (REPL vs Run-Once)

**Current**: `interactive: true/false`

| Option | Example | Pros | Cons |
|--------|---------|------|------|
| `interactive` | `interactive: false` | Clear, matches CLI flags | Inverted logic ("false" = script mode) |
| `mode` | `mode: script` or `mode: repl` | Explicit values | Generic name |
| `repl` | `repl: false` | Short | Less intuitive |
| `one-shot` | `one-shot: true` | Describes behavior | Hyphenated |
| `persist` | `persist: false` | Describes session behavior | Ambiguous |

**Question**: Should the default be interactive (REPL) or non-interactive (script)?

---

## 2. Full Auto / God Mode / YOLO

**Current**: `allow-all-tools: true`

This is the most confusing one. Different CLIs have different levels:

| CLI | "Safer" Auto | "Dangerous" Full YOLO |
|-----|--------------|----------------------|
| Claude | - | `--dangerously-skip-permissions` |
| Codex | `--full-auto` (sandboxed) | `--dangerously-bypass-approvals-and-sandbox` |
| Gemini | - | `--yolo` |
| Copilot | - | `--allow-all-tools` |

**Should we have TWO levels?**

### Option A: Single flag (current)
| Name | Example |
|------|---------|
| `allow-all-tools` | `allow-all-tools: true` |
| `auto-approve` | `auto-approve: true` |
| `yolo` | `yolo: true` |
| `unattended` | `unattended: true` |
| `headless` | `headless: true` |

### Option B: Two levels
| Safe Auto | Dangerous YOLO |
|-----------|----------------|
| `auto: true` | `yolo: true` |
| `auto-approve: true` | `dangerous: true` |
| `unattended: true` | `no-sandbox: true` |
| `trust: auto` | `trust: full` |

### Option C: Single enum
```yaml
approval: ask        # default - ask before tools
approval: auto       # auto-approve but sandboxed (Codex --full-auto)
approval: yolo       # bypass everything
```

**Recommendation**: Option C gives explicit control without boolean confusion.

---

## 3. Tool Whitelist/Blacklist

**Current**: `allow-tool` / `deny-tool`

| Option | Allow | Deny |
|--------|-------|------|
| Current | `allow-tool: [...]` | `deny-tool: [...]` |
| Alt 1 | `tools-allow: [...]` | `tools-deny: [...]` |
| Alt 2 | `whitelist: [...]` | `blacklist: [...]` |
| Alt 3 | `permit: [...]` | `block: [...]` |
| Alt 4 | `enable-tools: [...]` | `disable-tools: [...]` |

**Or nested:**
```yaml
tools:
  allow: [read, write]
  deny: [shell]
```

---

## 4. Directory Access

**Current**: `add-dir`

| Option | Example | Notes |
|--------|---------|-------|
| `add-dir` | `add-dir: ./src` | Matches Claude/Copilot/Codex |
| `include-dir` | `include-dir: ./src` | Matches Gemini |
| `dirs` | `dirs: [./src]` | Short |
| `workspace` | `workspace: [./src]` | Semantic |
| `paths` | `paths: [./src]` | Generic |
| `context-dirs` | `context-dirs: [./src]` | Explicit |

---

## 5. Session Resume

**Current**: `resume` / `continue`

| Option | Resume by ID | Resume Latest |
|--------|--------------|---------------|
| Current | `resume: "abc123"` | `continue: true` |
| Alt 1 | `session: "abc123"` | `session: latest` |
| Alt 2 | `resume: "abc123"` | `resume: true` |
| Alt 3 | `restore: "abc123"` | `restore: latest` |

**Or unified:**
```yaml
session:
  resume: latest  # or session ID
  fork: true      # create new branch
```

---

## 6. MCP Configuration

**Current**: `mcp-config`

| Option | Example |
|--------|---------|
| `mcp-config` | `mcp-config: ./mcp.json` |
| `mcp` | `mcp: ./mcp.json` |
| `mcp-servers` | `mcp-servers: [...]` |
| `tools-config` | `tools-config: ./mcp.json` |

---

## 7. Output Format

**Current**: `output-format`

| Option | Example |
|--------|---------|
| `output-format` | `output-format: json` |
| `output` | `output: json` |
| `format` | `format: json` |
| `emit` | `emit: json` |

---

## 8. Debug Mode

**Current**: `debug`

| Option | Example |
|--------|---------|
| `debug` | `debug: true` |
| `verbose` | `verbose: true` |
| `log-level` | `log-level: debug` |
| `trace` | `trace: true` |

---

## Summary Ballot

Cast your vote by reacting to comments below or commenting with your preferences:

1. **Execution Mode**: `interactive` / `mode` / `repl` / `one-shot` / `persist`
2. **Auto Mode**: Single flag vs Two levels vs Enum
3. **Auto Mode Name**: `allow-all-tools` / `auto-approve` / `yolo` / `approval`
4. **Tool Lists**: `allow-tool` / `tools-allow` / `whitelist` / `permit` / nested
5. **Directory**: `add-dir` / `include-dir` / `dirs` / `workspace` / `paths`
6. **Session**: Current / `session` object / unified `resume`
7. **MCP**: `mcp-config` / `mcp` / `mcp-servers`
8. **Output**: `output-format` / `output` / `format`
9. **Debug**: `debug` / `verbose` / `log-level`
