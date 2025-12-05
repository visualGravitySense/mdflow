# md-agent

A CLI tool to create reusable prompts for GitHub Copilot by combining YAML frontmatter with markdown content. Drop `.md` files with frontmatter to run prompts with automatic command execution and output piping.

## Installation

```bash
bun install
# or link locally
bun link
```

## Usage

Run a markdown file with frontmatter:

```bash
md-agent CHECK_ACTIONS.md
md-agent DEMO.md --model gpt-5
md-agent ANALYZE.md --silent --allow-all-tools
```

Pipe content into a prompt:

```bash
git log --oneline | head -10 | md-agent ANALYZE.md
```

## Frontmatter Reference

| Field | Type | Description |
|-------|------|-------------|
| `before` | string \| string[] | Command(s) to run first, output prepended to prompt |
| `after` | string \| string[] | Command(s) to run after copilot response, piped with output |
| `model` | string | AI model (claude-haiku-4.5, claude-opus-4.5, gpt-5, etc.) |
| `agent` | string | Custom agent name |
| `silent` | boolean | Only output response, no stats (default: true) |
| `interactive` | boolean | Start interactive mode |
| `allow-all-tools` | boolean | Auto-approve all tools |
| `allow-all-paths` | boolean | Allow access to any file path |
| `allow-tool` | string | Allow specific tools |
| `deny-tool` | string | Deny specific tools |
| `add-dir` | string | Additional allowed directory |

## Examples

### Basic Example

```markdown
---
model: claude-haiku-4.5
silent: true
---

Summarize this text in one sentence.
```

### With Before Commands

```markdown
---
before: gh run list --limit 5
model: claude-opus-4.5
---

Analyze the CI output above and summarize any failures.
```

### With After Commands

```markdown
---
before: git diff
after: pbcopy
---

Review this code diff and suggest improvements.
```

The copilot output will be piped to `pbcopy` (and other subsequent commands).

### Array Format

```markdown
---
before:
  - git log --oneline -5
  - git status
after:
  - tee commit-message.txt
  - cat commit-message.txt
---

Generate a commit message based on recent changes.
```

## CLI Options

Override frontmatter settings from the command line:

```bash
--model, -m <model>     Override AI model
--agent <agent>         Override custom agent
--silent, -s            Enable silent mode
--no-silent             Disable silent mode
--interactive, -i       Enable interactive mode
--allow-all-tools       Allow all tools
--allow-all-paths       Allow any file path
--allow-tool <pattern>  Allow specific tool
--deny-tool <pattern>   Deny specific tool
--add-dir <dir>         Add directory to allowed list
--help, -h              Show help
```

## How It Works

1. **Parse**: Reads markdown file and extracts YAML frontmatter
2. **Before**: Runs `before` commands, captures output
3. **Build**: Wraps command output in XML tags and prepends to prompt body
4. **Copilot**: Sends prompt to Copilot CLI with frontmatter options
5. **After**: Pipes Copilot response to `after` commands
6. **Exit**: Exits with Copilot's exit code (or first failed `after` command)

### Stdin Support

Piped content is automatically included in the prompt:

```bash
cat file.txt | md-agent PROMPT.md
# Prompt receives: <stdin>file contents</stdin>\n\nPrompt body
```

## Zsh Suffix Alias

Set up a suffix alias to run `.md` files directly by name:

```bash
# Add to your ~/.zshrc
alias -s md='_handle_md'
_handle_md() {
  local file="$1"
  shift

  # Check ~/agents/instructions if file doesn't exist locally
  if [[ ! -f "$file" && -f "$HOME/agents/instructions/$file" ]]; then
    file="$HOME/agents/instructions/$file"
  fi

  # Pass file and any remaining args (--model, --silent, etc.) to handler
  bun run /Users/johnlindquist/agents/src/index.ts "$file" "$@"
}
```

After sourcing your `.zshrc`, run prompts directly:

```bash
# Run a local file
./PROMPT.md

# Run from ~/agents/instructions
ANALYZE.md --model gpt-5
```

## Notes

- If no frontmatter is present, the file is printed as-is
- `before` command output is wrapped in XML tags named after the command (slugified)
- The first `after` command receives Copilot output via stdin
- Default `silent: true` suppresses stats output
