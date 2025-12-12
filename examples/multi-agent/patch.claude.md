---
# The Patcher - fixes vulnerabilities identified by audit
# Usage: md audit.claude.md src/api/user.ts | md patch.claude.md src/api/user.ts
model: sonnet
print: true
---
Here is the source file:
!`cat {{ _1 }}`

Here is the security audit:
{{ _stdin }}

If the audit is "CLEAN", output the original file.
Otherwise, rewrite the code to fix the specific vulnerabilities listed.
Output ONLY the code.
