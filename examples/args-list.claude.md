---
# Example: Using _args to get all positional args as a numbered list
# Usage: md args-list.claude.md "apple" "banana" "cherry"
print: true
---
Process these items:
{{ _args }}
