---
# Generate commit messages from staged changes
# Usage: git diff --staged | md commit.claude.md
model: sonnet
print: true
---

Generate a concise, conventional commit message for the following diff.
Use the format: type(scope): description

Types: feat, fix, docs, style, refactor, test, chore

Keep it under 72 characters.

{{ _stdin }}
