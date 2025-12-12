---
# Scaffolding - generate components based on existing patterns
# Usage: md scaffold.claude.md "DropdownMenu"
model: sonnet
print: true
---
Read this existing component to understand our pattern:
@./src/components/Button.tsx

Now, generate a new component named **{{ _1 }}**.
It should have:
1. The component file
2. A matching test file
3. A storybook file

Output strictly valid code blocks.
