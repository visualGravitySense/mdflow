---
# Template variables with defaults - CLI flags override
# Usage: md template-args.claude.md
# Override: md template-args.claude.md --_feature_name "Payments" --_target_dir "src/billing"
_feature_name: Authentication
_target_dir: src/features
model: sonnet
print: true
---

Create a new feature called "{{ _feature_name }}" in {{ _target_dir }}.

Include:
- A main module file
- Unit tests
- README documentation
