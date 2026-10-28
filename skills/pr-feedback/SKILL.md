---
name: pr-feedback
description: Assess review feedback on a PR (by URL/number, or the current branch's PR), then optionally address each item with granular commits and reply to each thread. Use when the user says "respond to feedback", "address review comments", "what do you think of the review", or pastes a PR link asking about its feedback.
---

# pr-feedback — Assess and respond to PR review feedback

Given a PR (or the current branch's PR), collect all open review feedback, give the user an
honest assessment of each item, then — only for the items the user picks — fix, commit, push,
and reply.

Use `gh` for all GitHub interactions.

## Phase 1 — Locate the PR and gather feedback

1. If the user gave a URL or number, use it. Otherwise resolve the current branch's PR with
   `gh pr view --json number,url,title,headRefName,baseRefName,state`. If none exists, say so and stop.
2. If reviewing locally, confirm the checkout matches the PR's head branch (`git branch --show-current`,
   `git status`). If it doesn't, fetch file contents via `gh` instead of switching branches uninvited.
3. Gather every feedback source:
   - Inline review comments: `gh api repos/{owner}/{repo}/pulls/{N}/comments --paginate`
   - Reviews (top-level bodies, approvals, change requests): `gh pr view {N} --json reviews`
   - Conversation comments: `gh pr view {N} --json comments`
   - Thread resolution state (only available via GraphQL):
     ```
     gh api graphql -f query='query { repository(owner: "OWNER", name: "REPO") {
       pullRequest(number: N) { reviewThreads(first: 100) { nodes {
         isResolved isOutdated path comments(first: 20) { nodes { databaseId author { login } body } }
       } } } } }'
     ```
4. Build the work list: group inline comments into threads via `in_reply_to_id`. Drop threads that are
   resolved, and threads where the last reply is already from the PR author (already handled). Keep
   outdated threads but flag them — the underlying concern may still apply even if the diff moved.

## Phase 2 — Assess

For each open item, read the current code it refers to (not just the diff hunk in the comment) and form
a genuine judgment:

- **Agree** — the feedback is correct and worth doing. Note the cost (one-liner vs. refactor).
- **Partially agree** — the concern is real but the suggested fix is wrong, or it's right in principle but not worth it here. Say what you'd do instead.
- **Disagree** — the feedback is mistaken (misreads the code, conflicts with project conventions, or the "bug" can't happen). Be ready to prove it with specifics.
- **Already addressed** — a later commit already fixed it; cite the commit.

Present a numbered list to the user: reviewer, file:line, one-line gist of the comment, your verdict,
and your recommendation. Be candid — the user wants your assessment, not deference to the reviewer.
Bot feedback (Copilot, cursor[bot], etc.) gets the same scrutiny; it is frequently plausible-but-wrong,
so verify claims against the code before agreeing.

Then ask the user, per item (AskUserQuestion works well for a handful of items; a compact list for many): **fix + reply**, **reply only** (push back or clarify), or **skip**. Stop and wait — do not start fixing before they choose.

## Phase 3 — Fix

For the accepted items:

1. **One commit per thread.** If two comments touch different parts of the PR, each gets its own commit
   so replies can point at exactly the commit that resolves them. Conventional commit messages.
2. Run the project's quality gates before pushing (ESLint and typecheck via the project's scripts —
   [check](check) `package.json` or the project CLAUDE.md; run relevant tests for changed files). Fix failures.
3. Push once all commits are in. The push must happen **before** replying, so the commit links resolve.

## Phase 4 — Reply

Reply on each thread: `gh api repos/{owner}/{repo}/pulls/{N}/comments -F in_reply_to={COMMENT_ID} -f body=...`
(for review-body or conversation comments, which have no thread, post a PR comment quoting the relevant part).

- **For fixed items**, follow this template — commit SHA as a markdown link, not backticked, and one sentence summarizing the change:

  ```
  Addressed in [abc1234](https://github.com/OWNER/REPO/commit/FULL_SHA). One sentence summarizing the change.
  ```

- **For pushback or clarification**, draft the reply and show it to the user for approval before
  posting — disagreement replies are outward-facing and tone matters. Keep them factual and specific:
  point at code, conventions, or a failing scenario, not opinions.
- Heredoc hygiene: when a reply body contains backticks, use a quoted heredoc (`<<'EOF'`) and do not
  backslash-escape the backticks — the quoting already neutralizes them.
- Leave thread resolution to the reviewer unless the user asks you to resolve threads
  (GraphQL `resolveReviewThread` mutation).

## Phase 5 — Wrap up

- If any addressed feedback came from Copilot, offer to re-request its review. The display name
  "Copilot" silently no-ops; use the bot login:
  `gh api repos/{owner}/{repo}/pulls/{N}/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`
- Summarize: items fixed (with commits), replies posted, items skipped and why, anything the user
  still needs to decide.

## Rules

- Never commit or push before the user has picked which items to address — the assessment phase is read-only.
- Never post a disagreement/pushback reply without showing it to the user first. "Addressed in …" replies for fixes the user approved may post without a second confirmation.
- Report honestly: if a gate fails or a fix doesn't fully cover the comment, say so instead of replying "addressed".
