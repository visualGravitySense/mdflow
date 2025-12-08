---
model: sonnet
args:
  - target
  - action
---

Please {{ action }} the file at {{ target }}.

{% if verbose %}
Be verbose in your output and explain each step.
{% endif %}

{% if dry_run %}
This is a dry run - do not make actual changes.
{% else %}
Apply changes directly to the files.
{% endif %}
