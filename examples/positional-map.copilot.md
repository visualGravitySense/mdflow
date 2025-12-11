---
# Map body to a specific CLI flag using $1
# This passes the body as --prompt <body> instead of as a positional arg
# Usage: md positional-map.copilot.md
$1: prompt
model: gpt-4.1
silent: true
---

Explain this code in simple terms.
