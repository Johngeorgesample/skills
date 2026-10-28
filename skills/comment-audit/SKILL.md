---
name: comment-audit
description: Evaluate the comments in the current diff (or named files) and decide which are worth keeping — delete narration, rewrite evidenced whys, propose simplifications that make comments unnecessary. Use when the user says "comment-audit", "audit comments", "are these comments worth keeping", or wants comment cleanup before pushing. Pass --fix to apply deletes/rewrites.
---

# comment-audit — Are These Comments Worth Keeping?

Judge every comment in scope against one question: **does it state a why or a constraint the code cannot show?** A comment that narrates what the next line does, restates a name, or talks to a reviewer instead of the next reader is not worth keeping.

## Scope

1. Default: comments **added or modified** in the current diff — working tree (staged + unstaged) plus the branch diff against its merge base (mind stacked branches — diff against the PR's actual base, not `main`).
2. If the user names files or directories, evaluate **every** comment in them instead.
3. Prune only. Never flag code for *missing* comments — suggesting additions is a different job. The one exception is Tier 3: test names in the diff are in scope, since they carry the same narration.

## Modes

- **Default:** report only (format below). Touch nothing.
- **`--fix`:** apply all delete and rewrite verdicts to the working tree, then print the report of what changed. Simplify-instead refactors are **never** auto-applied — they change code shape and stay proposals.

## Rubric

### Tier 1 — inline comments (`//`, `/* */` inside function bodies or between statements)

Worth keeping only if it states a why or constraint invisible in the code: an ordering requirement, a workaround with its cause, a domain fact, a deliberate deviation from the obvious approach. Everything else — narration, name-restating, "talking to the reviewer" annotations, defensive justifications of correct code — gets deleted.

### Tier 2 — JSDoc/TSDoc on exported symbols

Judged on **contract value beyond the name, signature, and types**. `@example` blocks, `@remarks` about gotchas, parameter semantics the type can't express, and return-value caveats are keepers. A summary that restates the symbol name ("Gets the user's settings" on `getUserSettings`) is flagged like any narration.

### Tier 3 — text that narrates what the code used to do

A change that replaces behavior is described by the new behavior alone. Anything in the diff that only makes sense to a reader who knows the superseded version is narration of history, and git already holds that history. This covers comments ("we no longer lowercase the label"), test names (`it('names the rule from the log line, not the selector')`), and assertions that exist only to prove the old behavior is gone.

Verdicts here: state the new behavior positively — rename the test to what it asserts (`it('names the rule from the log line')`), rewrite the comment to the standing constraint, or delete it. Drop an assertion only when its sole job was the contrast; an assertion that pins a real invariant stays, restated in its own terms. Under `--fix`, apply renames and comment edits; leave assertion removals as proposals.

### Preset rulings (no judgment call)

| Class | Verdict |
|---|---|
| Commented-out code | Delete — git history keeps it |
| Section-divider banners (`// ── helpers ──`) | Delete |
| Comment or test name defined against the behavior it replaced ("not X anymore", "instead of Y") | Rewrite to the new behavior alone |
| Comment restating what the construct already declares ("stands in for the real module" above a `jest.mock`, "this is a test" above a `describe`) | Delete |
| `eslint-disable` / `@ts-expect-error` justifications | Keep — they state a constraint |
| TODO/FIXME with an issue link or concrete trigger ("remove after #1234") | Keep |
| TODO/FIXME without one | Delete |

### Doubt policy: lean delete

When a comment is ambiguous between narration and constraint, resolve toward **delete**. Do not manufacture a constraint reading to save a comment. `--fix` applies every verdict — there is no borderline lane.

## Verdicts

- **Delete** — fails the rubric.
- **Rewrite** — the comment gestures at a real why ("needed for Safari") **and the true why is establishable from evidence**: the surrounding code, the diff, `git blame` + the blamed PR/commit message, or a linked issue. The finding must cite its source. No evidence → this is a Delete; **never invent a reason that sounds right.**
- **Simplify instead** — the comment exists to explain confusing code. Propose the concrete refactor that makes it unnecessary (usually a named extraction: "extract `isExpiredToken()` and drop the comment"). Proposal only, even under `--fix`.
- **Keep** — silent in the report, except a JSDoc keeper worth calling out as a model.

Honor the project's own comment conventions (CLAUDE.md / AGENTS.md) when they add constraints on top of this rubric.

## Report format

Group by verdict, one line per finding: clickable `file:line` — the comment (truncated) — one-sentence reason. Omit empty sections. Keeps stay silent.

```
## Delete (4)
- src/utils/foo.ts:42 — “// increment the counter” — narrates the code
- src/api/bar.ts:17 — “// ── helpers ──” — divider

## Rewrite (2)
- src/hooks/baz.ts:88 — “// needed for Safari” → “// Safari fires blur before click; debounce keeps the menu open” (per blame: PR #412)
- src/…/Foo.test.tsx:31 — `it('names the rule from the log line, not the selector')` → `it('names the rule from the log line')` — defined against the replaced behavior

## Simplify instead (1)
- src/utils/foo.ts:103 — comment explains the branch; extract isExpiredToken() and drop it
```

With `--fix`, end with a one-line diff stat of what was applied.
