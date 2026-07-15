---
name: code-smells
description: Review the current diff against Martin Fowler's "Bad Smells in Code" baseline — a curated set of ~12 design heuristics (Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest). Each smell is a judgement call, never a hard violation. Use when the user says "code-smells", "check for code smells", or "smell review".
---

# code-smells — Fowler's smell baseline

A design-level read of the change. This is **not** a bug hunt (`/code-review` does that) and **not** a project-convention pass (a per-repo conventions skill does that). It looks for the structural smells from Fowler's *Refactoring* — designs that work but will hurt to live with — and names them so they can be weighed, not enforced.

Two rules govern everything below:

- **The repo overrides.** A documented repo standard always wins. Where the repo endorses something this baseline would flag (e.g. an `AGENTS.md` that prescribes view-model resolvers, a house pattern for delegation), suppress the smell. Read `CLAUDE.md` / `AGENTS.md` and any local conventions before judging.
- **Always a judgement call.** Every finding is a *labelled heuristic* — "possible Feature Envy", "looks like Data Clumps" — never a violation. And, like any standard here, **skip anything tooling already enforces** (lint, formatter, type-checker). Don't restate what eslint would catch.

## Scope

Default to the uncommitted working diff. Resolve scope in this order, and state which you used:

1. If the user named a target (a PR, a branch, specific files), use that.
2. Else if there is an uncommitted diff (`git status --porcelain` non-empty), review `git diff` + staged + untracked source files.
3. Else review this branch vs the main branch: `git diff main...HEAD`.

Match each smell **against the change** — the smell must be visible in (or made worse by) the diff. Read enough surrounding code to judge in context, but don't audit untouched code for pre-existing smells unless the diff amplifies them.

## Steps

1. **Gather the diff** and read enough context to understand each hunk.
2. **Check for repo standards** (`CLAUDE.md`, `AGENTS.md`, local docs). These override the baseline.
3. **Walk the catalog below** against the change. For each candidate, ask: is this real, is it made worse by this diff, and does a repo standard already bless it?
4. **Report** the surviving findings (see Output). If the change is clean, say so — don't manufacture smells.

## The catalog

Each entry reads *what it is* → *how to fix*. Match it against the diff.

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design underneath is murky and that's the real finding.
- **Duplicated Code** — the same logic *shape* appears in more than one hunk or file in the change. → extract the shared shape, call it from both sites.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type and pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch` / `if`-cascade on the same type recurs across the change. → replace with polymorphism, or one shared map both sites read.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split it so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows up.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it and call the real target directly.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

## Output

For each surviving smell:

- **`path:line`** — the labelled smell ("possible Feature Envy") — one line on *why* it reads that way in this diff — the concrete refactor from the catalog.

Order by how much the smell will cost to live with, worst first. Keep each finding short; this is a prompt to weigh a trade-off, not a verdict. End by noting anything you suppressed because a repo standard endorsed it, so the user can see the baseline deferred. Don't edit, commit, or push unless the user asks.
