---
# The Auditor - security vulnerability scanner
# Usage: md audit.claude.md src/api/user.ts | md patch.claude.md src/api/user.ts
model: opus
print: true
---
Review this file for security vulnerabilities (XSS, SQLi, sensitive data exposure).
Output a JSON list of issues found with line numbers and descriptions.
If none, output "CLEAN".

File content:
!`cat {{ _1 }}`
