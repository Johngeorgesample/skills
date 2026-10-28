---
name: name-conditionals
description: Find conditionals whose meaning is implicit — compound tests, magic-threshold comparisons, inline predicates — and propose named booleans or predicate functions that say why the branch exists. Use when the user says "name-conditionals", "extract conditionals", "these ifs are unreadable", or wants a readability pass before pushing. Pass --fix to apply the extractions.
---

# name-conditionals — Make the Implicit Idea Explicit

All code already says *what* it does. A conditional is worth extracting when it fails to say *why*. The finding is never "this line has two operators" — it's "a reader has to ask a colleague what this test means".

```js
// 🛑  the reader asks: what do age and karma mean together?
if (account.age < 10.days.ago && account.karma < 5) { … }

// ✅  the answer, written down once
const accountHasHighSpamRisk = account.age < 10.days.ago && account.karma < 5;
if (accountHasHighSpamRisk) { … }
```

## Scope

1. Default: conditionals **added or modified** in the current diff — working tree (staged + unstaged) plus the branch diff against its merge base (mind stacked branches — diff against the PR's actual base, not `main`).
2. If the user names files, functions, or a PR, review those instead.
3. Never redesign untouched code. A neighboring offender gets one line, not a proposal.

## Modes

- **Default:** report only. Touch nothing.
- **`--fix`:** apply the extractions to the working tree, then print the report of what changed. Apply **only** findings whose name you would defend in the report — if a finding lands in the "named it, gained nothing" bucket below, it is not a finding and `--fix` skips it.

## What counts as a candidate

- **Compound tests** — two or more conditions joined by `&&` / `||` that together mean one domain idea.
- **Single tests with a hidden concept** — one comparison whose significance isn't in the expression: a magic threshold (`created_at < 10.days.ago` → `wasRecentlyPublished`), a sentinel value, a status-code range, a length check standing in for a state.
- **Negated compounds** — `!(a || b)`, `!a && !b`. These are where readers misparse most; naming the positive concept usually fixes it.
- **Inline predicates** — the callback body inside `.filter()` / `.some()` / `.every()` / `.find()`, when the callback encodes a domain rule.
- **Render and prop gates** — `{a && b && <Thing/>}` in JSX, or a `disabled=`/`hidden=` expression built from several pieces of state.
- **Repeated tests** — the same expression appearing twice in a file. Repetition is proof the concept exists and deserves a name.

## Exempt — leave these inline

- Null/undefined/empty guards at the top of a function: `if (!data) return null`.
- Type narrowing the compiler needs at the use site (`if (typeof x === 'string')`), where hoisting to a boolean loses the narrowing.
- A test that is already a sentence: `if (isOpen)`, `if (user.isAdmin)`, `if (items.length === 0)`.
- A call to an already-named predicate — `if (canEdit(user) && isDraft(post))` reads fine; don't wrap wrappers.
- Test files. Assertions and arrange blocks are documentation already.
- Loop/condition mechanics: index bounds, `i < len`, retry counters.

## The naming test

An extraction earns its keep only if the name states the **concept**, not the mechanism.

- ✅ `accountHasHighSpamRisk`, `wasRecentlyPublished`, `isOverIngestBudget` — a reader could search for these.
- 🛑 `ageAndKarmaAreLow`, `isSmallAndOld`, `conditionsMet`, `shouldShow`, `isValid` — a transliteration of the operators, or so vague it moves the question rather than answering it.

If the honest best name is in the second list, **say so and leave the code alone**. That's a real outcome: the name won't come because the concept isn't understood yet, and inventing a confident-sounding one is worse than the raw expression. When you can't name it from the code, look for the answer in `git blame` on the line, the blamed PR/commit message, a linked issue, or a nearby comment — and cite that source in the finding. Never invent domain meaning.

## Variable or function?

| Situation | Extract to |
|---|---|
| Used once, depends on local variables | a `const` boolean directly above the branch |
| Used two or more times in the same scope | one `const` above the first use |
| Depends only on one object's own fields | a predicate on/near that object — `isExpired(token)`, or a getter if the language has them |
| Reused across files, pure | an exported predicate in the module that owns the domain type |

Naming: `is…` / `has…` / `was…` / `can…` / `should…` / `…Exceeds…`. Follow the repo's own vocabulary — reuse the domain nouns the code already uses, and any constant/enum objects it compares against, rather than coining synonyms.

**Repo conventions override this file.** Read `CLAUDE.md` / `AGENTS.md` first: they may dictate arrow vs `function`, return-type annotations, `useMemo` policy, or a house pattern for state-dependent props. In React, a plain `const` above the `return` is the default — reach for `useMemo` only when referential identity matters. And where a whole *set* of props varies by state, that's a view-model resolver, not a boolean; leave it to the repo's own review skill.

## Report format

One line per candidate, worst-readability first. Omit empty sections.

```
## Extract (3)
- src/api/account.ts:42 — `account.age < …ago && account.karma < 5`
  → `const accountHasHighSpamRisk` — the pair is the spam heuristic (per PR #412)
- src/pages/Feed.tsx:18 — `created_at < tenDaysAgo`
  → `const wasRecentlyPublished` — threshold is the featured-page window
- src/utils/token.ts:7,31 — same expiry test twice → export `isExpiredToken(token)`

## Named it, gained nothing (1)
- src/state/store.ts:88 — best available name is `isSetAndNotStale`; concept unclear from code or blame — leave inline

## Suppressed by repo standard (1)
- src/components/Badge.tsx:24 — varies four props by state; AGENTS.md prescribes a view-model resolver here
```

## Applying (`--fix`)

- Preserve the expression **character for character**. This is a naming refactor: no De Morgan rewrites, no reordering for short-circuit cost, no folding in a nearby branch. If the logic should also change, report it and leave it.
- Watch evaluation order: hoisting a `const` above the branch evaluates it unconditionally. If either side can throw or is expensive, extract to a function (called at the branch) instead of a variable.
- Place the `const` immediately above its first use; put an exported predicate in the module that owns the type it tests.
- One extraction per commit if committing, and re-run the project's lint / typecheck / tests after. Don't commit or push unless asked.
