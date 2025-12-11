---
# Example: Using --_varname flags without frontmatter declaration
# Usage: md optional-flags.claude.md --_mode detailed
# Or just: md optional-flags.claude.md (will prompt for _mode)
print: true
---
{% if _mode == "detailed" %}
Provide a detailed, comprehensive analysis.
{% else %}
Provide a brief summary.
{% endif %}

Analyze this codebase.
