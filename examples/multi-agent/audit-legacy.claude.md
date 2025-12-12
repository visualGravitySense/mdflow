---
# Legacy Code Archaeologist - batch analyze files for deprecated patterns
# Usage: md audit-legacy.claude.md "src/db/**/*.ts"
# Note: Pass a glob pattern in quotes to use mdflow's built-in glob expansion
model: sonnet
print: true
---
I am migrating our database. Check these files for deprecated raw SQL queries.

@./{{ _1 }}

If you find `db.query('SELECT...`, suggest the equivalent Prisma ORM syntax.
If the file is already using Prisma, output "CLEAN".
