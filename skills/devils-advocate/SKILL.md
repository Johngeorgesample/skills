---
name: devils-advocate
description: Argue the strongest case against the current approach and for a better alternative — steelman the other side, expose the plan's weakest joints, then give a bottom-line verdict. Use when the user says "devil's advocate", "argue the other side", "poke holes in this", "why might this be wrong", or wants a decision pressure-tested.
---

# devils-advocate — argue the other side

Every other review skill critiques *within* the chosen approach (a per-repo skill checks conventions, `code-smells` checks design, `/code-review` hunts bugs). This one attacks the choice itself: it assumes the current plan is wrong and tries to prove it, then makes the case for a better alternative.

**Honest skeptic, not a contrarian.** Build the strongest real case against the current approach — but if the approach is genuinely right, say so plainly instead of manufacturing objections. A weak, invented objection wastes the user's time and trains them to ignore you. The goal is a *better decision*, not the appearance of dissent.

## Scope

What's under attack, resolved in this order (state which you used):

1. If the user pointed at something specific (a plan, a file, a decision), attack that.
2. Else attack **whatever's on the table** — a plan just proposed, an approach just chosen, or a decision made earlier in this conversation.
3. Else fall back to the uncommitted diff / branch changes and attack the approach they embody.

Read enough of the surrounding code and context to attack the *real* thing, not a caricature of it.

## Method

1. **State the target in one line** — the approach as its author would defend it, at its strongest. If you can't state it fairly, you can't attack it fairly. This is the steelman; get it right before you swing.
2. **Find the weakest joints** — walk the angles below and press on each. Keep the ones where there's a real case.
3. **Offer the alternative** — don't just tear down. Name the concrete approach you'd bet on instead, and why it dominates on the axis that matters here.
4. **Give the verdict** — close with a clear bottom line: **switch**, **keep**, or **it depends on X**. Argue hard, then be honest about where you land.

## Angles of attack

Press on each; surface only the ones that land.

- **Hidden assumptions** — what must be true for this to work? Name the load-bearing assumption and ask what happens when it's false.
- **The cheaper alternative** — is there a simpler/smaller/existing-tool solution that gets 90% of the value for 10% of the cost? Is this reinventing something?
- **Do nothing** — what breaks if we ship *nothing* here? If the answer is "not much," that's the strongest counterargument of all.
- **Cost vs. payoff** — is the complexity, maintenance burden, or new dependency worth what it buys? Who pays the cost, and when?
- **Failure modes** — how does this break in production, at scale, under concurrency, on the unhappy path? What's the blast radius?
- **Reversibility** — is this a one-way door? If we're wrong, how expensive is it to back out? Cheap-to-reverse decisions deserve less agonizing; expensive ones deserve more.
- **Second-order effects** — what does this force *elsewhere*? New coupling, a pattern others will copy, a precedent you'll regret.
- **YAGNI / speculative** — is this solving a problem we actually have, or one we imagine we'll have?
- **Who disagrees** — who is the smartest person who'd push back on this, and what would they say?

## Rules

- **Concede when it's right.** If an angle doesn't land, drop it. If the approach survives every angle, say "this holds up" and explain why — that's a valid, useful outcome.
- **No strawmen.** Attack the approach at its strongest, not a weakened version you can beat.
- **No nitpicks.** Skip anything lint, types, or a formatter would catch, and skip style quibbles. This is about the *decision*, not the diff's surface.
- **Bet, don't hedge.** The value is in committing to a position. End with a real recommendation, not "there are trade-offs either way."

## Output

- **The target** — one line, steelmanned.
- **The case against** — the objections that landed, worst first. Each: the weak joint → why it's a problem → what it costs.
- **The alternative** — the approach you'd back instead, and the axis on which it wins.
- **Verdict** — **switch / keep / depends on X**, in one or two sentences.

Don't edit, commit, or push. This skill argues; it doesn't act.
