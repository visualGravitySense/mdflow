---
# The Historian - extracts and organizes commits into a changelog
# Usage: md changelog.claude.md v1.0.0 | md announcement.claude.md
# Or:   md changelog.claude.md HEAD~10
model: sonnet
print: true
---
Analyze these commits and group them into "Features", "Fixes", and "Chore".
Ignore merge commits. Output clean Markdown lists.

!`git log --pretty=format:"%s" {{ _1 }}..HEAD`
