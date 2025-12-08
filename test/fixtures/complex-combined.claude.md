---
model: opus
max-tokens: 4096
args:
  - feature_name
---

# Feature Implementation: {{ feature_name }}

## Context

This document describes the implementation of the {{ feature_name }} feature.

### Type Definitions

@./imports/types.ts#UserProfile

### Configuration

@./imports/types.ts#DEFAULT_CONFIG

### Helper Content

@./imports/helper.md

## Requirements

{% if strict_mode %}
Running in strict mode - all validations will be enforced.
{% else %}
Running in lenient mode - some validations may be skipped.
{% endif %}

## Reference Lines

Here are lines 4-6 from the reference doc:

@./imports/lines.txt:4-6

## Instructions

Please implement the {{ feature_name }} feature following these guidelines.
