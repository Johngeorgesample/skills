---
name: ready-for-review
description: Final gate before flipping a draft PR to ready for review — fans out code-smells, sandi-metz, one-thing, comment-audit, and name-conditionals to parallel subagents, then merges their findings into one triaged punch list. Use when the user says "ready-for-review", "ready for review", "rfr", "final pass before review", or is about to mark a PR ready.
---

# ready-for-review — The Last Pass Before a Human Reads It

Five review skills, five subagents, one report. The subagents do the reading so this context stays clean; this skill's job is to **resolve the scope once**, dispatch, and merge what comes back into a punch list ordered by what a reviewer would trip on first.

This is a review gate, not a code review for bugs (`/code-review`) and not a project-convention pass (`al-review`). It also does not replace lint/typecheck — the user's own pre-push rule covers those.

## Step 1 — Resolve the scope once

Every one of the five skills resolves its own scope, and each would resolve it independently. That's the failure mode this skill exists to prevent: five agents reviewing five slightly different diffs, or a stacked branch getting diffed against `main` so the parent PR's work shows up as findings here.

Resolve it yourself, before dispatching:

1. If the user named a PR (URL/number), branch, or files, that's the target.
2. Else if the current branch has an open PR, use it — read its title, description, and commit list.
3. Else use the branch diff against its merge base.

Then pin down and write out, explicitly:

- the **base branch** — the PR's actual base, which on a stack is the parent branch, never `main`;
- the **merge-base SHA** (`git merge-base <base> HEAD`) and the exact diff command the agents should run;
- whether there are **uncommitted working-tree changes** to include (`git status --porcelain`);
- the PR's **stated intent** (title / branch name), which `one-thing` needs as its anchor.

State the resolved scope in one line to the user before dispatching, so a wrong target gets caught in seconds rather than after five agent runs.

## Step 2 — Dispatch all five in parallel

One message, five `Agent` calls, so they run concurrently. For each of:

| Skill | SKILL.md |
|---|---|
| `code-smells` | `~/.claude/skills/code-smells/SKILL.md` |
| `sandi-metz` | `~/.claude/skills/sandi-metz/SKILL.md` |
| `one-thing` | `~/.claude/skills/one-thing/SKILL.md` |
| `comment-audit` | `~/.claude/skills/comment-audit/SKILL.md` |
| `name-conditionals` | `~/.claude/skills/name-conditionals/SKILL.md` |

give the subagent a prompt that:

- names the absolute path to that SKILL.md and tells it to **read the file and follow it exactly** — it is the authority, not this skill's summary of it;
- hands over the resolved scope from Step 1 verbatim (base branch, merge-base SHA, diff command, working-tree flag, PR intent) and says **do not re-resolve it**;
- tells it to read the repo's `CLAUDE.md` / `AGENTS.md` first, since every one of the five defers to documented repo standards;
- forbids writes: **report only** — no edits, no commits, no pushes, no PR comments, no `--fix`, regardless of what the skill file says about modes (unless the user passed `--fix`, see below);
- asks for its **report in the skill's own documented format as the entire final message** — no preamble, no "here's what I found", no restating the diff. The report is the return value.

Dispatch all five even when you suspect some will come back empty. A clean result from `comment-audit` is information; guessing that it would be clean is not.

If an agent returns nothing usable (died, or returned prose instead of a report), say so in the output for that section rather than filling the gap yourself. Never write a finding you didn't receive, and never re-run one of the five inline to cover for a failed agent unless the user asks — that defeats the point of the fan-out.

## Step 3 — Merge, don't concatenate

Pasting five reports back to back is the lazy version and reads terribly: the same line shows up four times wearing different hats. A long function full of unnamed compound conditionals with a comment explaining them will legitimately trip `sandi-metz`, `name-conditionals`, and `comment-audit` at once.

So:

- **Collapse by location.** When two or more skills point at the same `file:line`, that's one finding with the strongest framing, and the corroborating skills named in parentheses. Multiple hits are evidence of severity, not of separate problems.
- **Watch for prescriptions that fight.** `comment-audit`'s "simplify instead", `sandi-metz`'s extraction, and `name-conditionals`' named boolean can be three names for one refactor — or genuinely contradictory advice. Reconcile into one recommendation, and if two agents really disagree, present both in a sentence and say which you'd take.
- **Respect every skill's own suppression.** If an agent suppressed a finding because a repo standard endorsed the pattern, it stays suppressed here. Roll those up into the final section so the user can see the baselines deferred.
- **Don't manufacture severity.** These are judgement heuristics. A finding is a prompt to weigh a trade-off; nothing here is a violation.

## Output

Lead with a one-line verdict: **ready to flip**, or **N things to settle first**.

Then, omitting empty sections:

```
## Scope
PR #1969 · base `offer-cards-as-validation-lands` · merge-base a1b2c3d · 6 files, working tree clean

## Verdict
2 things to settle first — the PR is carrying an unrelated cleanup

## Scope check (one-thing)
2 concerns — recommend spinning off the pattern-key refactor as the stack base
  → split plan, merge order

## Fix before review (3)
- src/hooks/use-drop-rules.ts:42 — 14-line body doing gather-then-format (sandi-metz)
  → extract `getCoveredMatchKeys()`; also kills the comment at :39 (comment-audit)
- src/api/index.ts:88 — possible Data Clumps: `(selector, segmentId, dropRate)` travels together in 3 signatures (code-smells)
- src/pages/DropRules.tsx:24 — `!segment && rules.length > 0` (name-conditionals)
  → `const hasUnsegmentedRules`

## Your call (2)
- …one line each, why it's arguable

## Suppressed by repo standard (1)
- src/components/Badge.tsx:24 — AGENTS.md prescribes a view-model resolver here
```

`one-thing` gets its own section, above the line-level findings and never merged into them: a split changes which lines even belong to this PR, so it's the first decision the user makes.

A genuinely clean run is short — the verdict line, the scope line, and one line per skill confirming it came back empty. Don't pad it.

## Then stop

End with offers, and run none of them unprompted:

- apply the mechanical fixes — re-dispatch `comment-audit --fix` and `name-conditionals --fix` to subagents, which apply only the verdicts they'd defend;
- execute the `one-thing` split plan;
- flip the PR to ready (`gh pr ready`).

That last one is outward-facing — it puts the PR in front of teammates and sends notifications. Never run it without an explicit go-ahead in the current turn, and never bundle it into "yes" to one of the other offers.

## `--fix` passthrough

If the user invokes this skill with `--fix`, `comment-audit` and `name-conditionals` run in fix mode in Step 2 (they are the only two that document one) and their sections report what was applied. `code-smells`, `sandi-metz`, and `one-thing` stay report-only always — they propose structural changes that want a human decision. Don't commit or push what `--fix` applied unless asked.
