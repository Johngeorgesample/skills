---
name: one-thing
description: Analyze a PR (or the current branch) for whether it's doing more than one thing, and recommend what to spin off into another PR — with a concrete split plan and merge order. Use when the user says "one-thing", "is this PR doing too much", "should I split this PR", or wants a scope check before pushing.
---

# one-thing — Is this PR one thing?

A PR should do one thing. This skill maps the distinct concerns inside a change, judges whether they belong together, and — when they don't — recommends exactly what to spin off, where each piece goes, and in what order they merge. It is a scope review, not a code review: `/code-review` hunts bugs, `code-smells` judges design; this judges the *unit of change*.

## Scope

Resolve the target in this order, and state which you used:

1. If the user gave a PR URL/number, use it (`gh pr view`, `gh pr diff`).
2. Else if the current branch has an open PR, use that PR.
3. Else review the branch diff against its merge base.

Mind stacked branches: always diff against the PR's actual base branch, not `main`. Reviewing a stack member against `main` makes the parent PR's concerns look like scope creep in this one.

When there's a PR, read its title, description, and commit list — the title/branch name states the PR's *intent*, which anchors the split plan later.

## The test: independence

A PR is doing too many things when it contains **two or more concerns that could each merge, revert, and be reviewed on their own**. Size alone is never a finding — a 900-line single-concern PR passes; a 40-line PR bundling a fix with an unrelated cleanup does not.

The classic shapes to look for:

- a refactor bundled with the behavior change built on it
- a drive-by fix in a file or subsystem the main change has no reason to touch
- a feature plus an opportunistic cleanup that outgrew "tiny"
- two features that happen to share a branch

## Method

1. **Gather** the full diff and the commit list.
2. **Map hunks to concerns.** Read the diff and group hunks/files by the concern they serve. Hunks are the ground truth — concerns often cut across commits, especially after review-fixup commits. Use commit messages as corroborating evidence (a `refactor:` commit sitting next to a `feat:` commit is a strong hint, not proof).
3. **Apply the exemptions** (below) to collapse false concerns back into their parent.
4. **Judge** what survives against the independence test.

## Exemptions — not separate concerns

- **The change's own scaffolding.** Tests, types, mocks, fixtures, docs for the main change. Independent files, not an independent concern — they have no reason to exist without it.
- **Mechanical fallout.** Renames, import updates, signature-change ripples forced by the main change. Wide but not separable.
- **Tiny adjacent cleanups.** A typo fix or dead-import removal in a file the PR already touches for real reasons. Below a few lines, extraction costs the reviewer more than it saves. Reformatting a whole file you touched one line of is *not* tiny — that flags.
- **Small enabling refactors.** Extracting a helper, widening a signature — prep a reviewer reads as part of the feature. But a prerequisite refactor **flags when it dominates**: when it rivals the feature in size or touches files the feature doesn't, it's a reviewable unit in its own right and should be the base of a stack.

## The split plan

When concerns survive:

- **What stays** = the concern the PR title/branch name promises. The PR keeps its identity; everything else is the candidate for extraction.
- **Sequencing by dependency:**
  - Independent concerns → separate PRs off the base branch, mergeable in any order.
  - A prerequisite (e.g. a dominating enabling refactor) → the base of a stack, with this PR rebased onto it (the user works with gh-stack).
- State the recommended merge order explicitly.

## Output

Lead with the verdict in one line: *"cohesive — ship as-is"* or *"N concerns — recommend spinning off X"*. A clean PR gets that one line and nothing more; don't manufacture findings.

For an overloaded PR, follow the verdict with:

1. **Concern map** — each concern named, its files/hunks listed, and the evidence it's independent (could it merge/revert alone? which commits back it?).
2. **Split plan** — what stays, what spins off, stack vs. independent, merge order.
3. **Offers** — offer (never auto-run) to:
   - execute the split: create the branch(es) and move the hunks via cherry-pick or checkout+apply — no interactive rebase;
   - draft a problem-describing issue for the multi-PR work, with `Part of #N` on the constituent PRs.

Never commit, push, or open PRs without an explicit go-ahead.

## Teammate PRs

The analysis always lands in the terminal, never on GitHub. "Your PR is doing three things" is socially loaded feedback — the user decides what to relay and in what words. Do not offer to post it as a PR comment.
