---
# Copilot smoke test
# $1 maps the body to --prompt flag (copilot doesn't accept positional)
command: copilot
model: gpt-4.1
$1: prompt
silent: true
---

Say only: "Copilot smoke test passed"
