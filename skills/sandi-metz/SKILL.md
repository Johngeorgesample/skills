---
name: sandi-metz
description: Review the changed code for functions longer than ~5 lines and propose named extractions per Sandi Metz's function-length rule — a smell detector, not a hard cap. Use when the user says "sandi metz", "sandi-metz", "function length review", or asks whether a function is too long.
---

# sandi-metz — Function-Length Review

Review functions against the Sandi Metz rule: **aim for ~5 lines or fewer**. A function that needs more is usually doing more than one thing. The rule is a smell detector, not a hard cap — the goal is finding hidden abstractions, never hitting a number.

## Scope

Review only code being touched:

1. If there are working-tree changes: the working diff (staged + unstaged).
2. Otherwise: the branch diff against its merge base (mind stacked branches — diff against the PR's actual base, not `main`).
3. If the user names a file, function, or PR, review that instead.

Never propose refactors to code outside the diff — note a neighboring offender in one line at most, don't redesign it.

## Method

For each function added or modified in scope, count the logic lines in its body, then classify:

**Exempt — over 5 lines but fine as-is.** Don't count these against the budget:
- A single cohesive algorithm that would lose readability if split (splitting forces the reader to jump around to follow one idea).
- A switch/case, lookup-table, or if/else chain that is one flat mapping.
- Config-like literal blocks: JSX markup, object literals, style definitions, schema/options declarations. A literal block reads as data; treat it as roughly one line.
- Test bodies following arrange/act/assert — length there is documentation.

**Finding — a hidden abstraction.** The body does more than one nameable thing: a validation pass then a transformation, gather-then-format, setup entangled with the real work. The tell: you can draw a line through the body and give each side an honest name.

**Judgement call.** Over budget, no clean seam, but worth a sentence on why it's acceptable (or a note that a future change should split it).

## The extraction test

Propose an extraction **only** when the extracted piece has a name describing a real, self-contained responsibility (`resolveWindowOptions`, `buildFilterBody`) — a name a reader would search for. If the best available names are `doFirstHalf`/`handleRest`/`processData`, or the pieces would share tangled local state (3+ values threaded between them), the honest long function wins. Say so explicitly rather than forcing a split.

## Output

One line per clean function is noise — report only exemptions worth defending and findings. For each finding:

- `file:line` — function name, body line count
- Verdict: what the second responsibility is
- The proposed extraction: signature + name, and what stays behind (a sketch, not the full diff)

Then stop. **Do not apply the refactors** unless the user asks — this is a review. When asked to apply: one extraction per commit if committing, and re-run the project's tests/lint/typecheck after.
