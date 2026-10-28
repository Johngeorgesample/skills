---
name: land-stack
description: Land a stack of GitHub PRs bottom-up. For each PR, run ready-for-review, babysit-pr until green, and post it to Slack with post-pr --send. A native GitHub stack is then merged in one call once every PR is approved, with no rebasing or re-approval; any other stack is merged one PR at a time, rebasing the next PR onto main after each merge. Use when the user says "land the stack", "land-stack", "ship this stack", "merge the stack", or passes a PR that belongs to a stack.
---

# land-stack

Arguments: $ARGUMENTS (optional PR URL or number anywhere in the stack, or `resume`)

Invoking this skill is the user's go-ahead for everything the loop does to the stack's own PRs: committing ready-for-review's fixes, marking them ready, posting them to Slack, merging them once they're approved, and force-pushing a branch with `--force-with-lease` after rebasing it onto `main`. That go-ahead covers no other branch or PR.

## 1. Resolve the stack

1. Start from the PR in the arguments, else the current branch's PR (`gh pr view --json number`).
2. List open PRs once: `gh pr list --state open --limit 200 --json number,url,title,headRefName,baseRefName,isDraft`.
3. Walk down: follow `baseRefName` to the PR whose `headRefName` matches it, until the base is the default branch (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`).
4. Walk up: find the open PRs whose `baseRefName` is the current head. If a branch has more than one child, the stack is a tree. Ask which path to land.
5. Order the PRs bottom (base is `main`) to top.
6. Check whether it's a native GitHub stack: `gh api -H "X-GitHub-Api-Version: 2026-03-10" repos/<owner/repo>/pulls/<n> -q .stack` for each PR. It's native when every PR returns a non-null `stack` with the same `id`. Native stacks land with section 2. Anything else, including a mix, lands with section 3.

### State file

Keep state at `$(git rev-parse --git-common-dir)/land-stack/<bottom-pr>.json`. It lives inside `.git`, so it never gets committed. Rewrite it after every transition, because the session can die between steps.

```json
{ "repo": "owner/name", "native": false, "prs": [
  { "number": 140, "branch": "agent/x/TASK-001", "forkPoint": null, "posted": false, "slackLink": null, "feedbackSince": null, "status": "pending", "mergeCommit": null },
  { "number": 141, "branch": "agent/x/TASK-002", "forkPoint": "<sha>", "posted": false, "slackLink": null, "feedbackSince": null, "status": "pending", "mergeCommit": null }
] }
```

Section 3 needs fork points; section 2 doesn't, so leave them `null` for a native stack. For each PR above the bottom one, set `forkPoint` to `git merge-base origin/<branch> origin/<parent-branch>` after a `git fetch`. This is where the branch left its parent. Once the parent has been squash-merged, the commits in `forkPoint..branch` are exactly this PR's own work. Record fork points at discovery time. Afterwards, babysitting and rebasing rewrite the parent, and the original fork point can't be recovered.

Set `feedbackSince` to the PR's `createdAt`. It marks the point after which human review feedback counts as new. Step g moves it forward.

On `resume`, or when a state file already exists for this stack, load it and re-check every PR against GitHub. Skip the merged ones. Don't post a PR that has `posted: true` again.

Show the stack once as one line per PR (`#n title · base · draft/ready · status`), say whether it's native, and confirm it with `AskUserQuestion` before the first PR. After that, don't ask again unless a step below says to stop.

## 2. Native stack: approve everything, then merge once

In a native stack, nothing merges until the whole stack is approved, so no PR's base moves while you work. That removes the rebase-and-re-approve cycle of section 3: don't rebase any branch and don't merge any PR on its own.

1. **Prepare every PR, bottom-up.** For each PR, fetch, check out the branch, and fast-forward it to `origin/<branch>` (if the local branch has diverged, stop and ask). Then run section 3's steps b (ready-for-review), c (babysit-pr) and d (post-pr). Move on to the next PR as soon as this one is posted; don't wait for its review. A push to a lower PR doesn't require touching the PRs above it.
2. **Wait until every PR is approved.** For each PR that isn't approved yet, launch section 3's step e wait script in the background. Handle each exit as in step e's table, except that `APPROVED` means "mark this PR approved and keep waiting on the rest". `FEEDBACK` goes through step g, and step g's push may dismiss that PR's approval; if it does, wait on that PR again. Other PRs keep their approvals.
3. **Merge the stack.** Once every PR is approved, re-check each one with `gh pr view <n> --json reviewDecision,mergeStateStatus,headRefOid` and `gh pr checks <n>`.
   - Every PR must be approved, with all checks passing.
   - If the bottom PR is `BEHIND`, handle it as in section 3's step f, then re-check the whole stack.
   - Any other state that isn't `CLEAN` (a failing check, `BLOCKED` despite the approval, `DIRTY`): stop and report.

   Then merge the top PR (`.stack.position` equals `.stack.size`) with the async merge API, pinned to its approved head. This merges every PR below it too, in order, each as its own squash commit:
   ```bash
   gh api -X PUT -H "X-GitHub-Api-Version: 2026-03-10" repos/<owner/repo>/pulls/<top>/merge-async -f sha=<headRefOid> -f merge_method=squash -f merge_action=direct_merge
   ```
   It returns `202` with a `uuid`. Poll `GET …/pulls/<top>/merge-async/<uuid>` until `status` is `merged` or `failed`.
4. **Confirm.** For every PR, run `gh pr view <n> --json state,mergeCommit -q '"\(.state) \(.mergeCommit.oid[0:8])"'` and record `status: merged` and the merge commit. If any PR isn't merged, stop and report which ones.

Then go to section 4.

## 3. Land each PR, bottom-up (not a native stack)

If a stack branch is already checked out in another worktree (`git worktree list`), work in that worktree rather than checking the branch out here.

Before checking out a branch, the working tree must be clean (`git status --porcelain`). If it isn't, stop and ask.

### a. Sync the branch

- `git fetch origin`, check out the branch, and fast-forward it to `origin/<branch>`. If the local branch has diverged, stop and ask.
- If this PR's parent was merged earlier in this run:
  1. Run `git merge-base --is-ancestor <forkPoint> HEAD` to confirm `forkPoint` is still an ancestor. If it isn't, someone rewrote the branch. Stop and ask.
  2. Run `git rebase --onto origin/main <forkPoint>`. On a conflict, run `git rebase --abort`, then stop and report the conflicting files.
  3. Run the repo's lint and typecheck, using the same commands as babysit-pr's local gates.
  4. Run `git push --force-with-lease origin <branch>`.
  5. Confirm the PR's base is now `main`. GitHub retargets the PR when it deletes the parent branch. If GitHub didn't retarget it, run `gh pr edit <n> --base main`.

### b. ready-for-review

Invoke the `ready-for-review` skill with the PR number and `--fix`. Don't stop to ask about its findings.
- Commit what the comment-audit fixes changed, and what the name-conditionals fixes changed, as one Conventional Commit each (`refactor: apply comment-audit fixes`, `refactor: apply name-conditionals fixes`). babysit-pr pushes them in step c.
- The report-only findings (code-smells, sandi-metz, one-thing) aren't applied. Carry them into the final report under the PR.

Don't use rfr's `gh pr ready` offer. post-pr flips the PR in step d.

### c. babysit-pr

Invoke the `babysit-pr` skill on the checked-out branch. Continue once every check passes and no high-priority AI comments are left open. If babysit escalates something to the user, stop the run there.

On every CI poll, also check once for human review feedback:

```bash
~/.claude/skills/land-stack/wait-for-review.sh <owner/repo> <n> <feedbackSince> 0
```

- **`FEEDBACK <count>`:** stop babysitting and go to step g. Step g brings you back here.
- **`MERGED` or `CLOSED`:** stop and report.
- **`NONE` or `APPROVED`:** keep babysitting.

### d. post-pr

Unless `posted` is already true, wait for Copilot's verdict on the current head before posting. Copilot posts its verdict as a comment that starts with a signal emoji, e.g. "🟢 Approval recommended". Poll `gh pr view <n> --json comments,reviews,headRefOid` for the newest such comment by Copilot (`copilot-pull-request-reviewer[bot]`) that was posted after the head commit's push. If there isn't one, request a review (`gh api repos/<owner/repo>/pulls/<n>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`) and keep waiting. Address as many bot comments as possible before any human looks at the PR: fix or reply to every Copilot and other bot comment, not just the high-priority ones, and re-request Copilot's review after each push. Post only once the latest Copilot review on the current head says "🟢 Approval recommended" or "🔵 Needs a closer look", and no bot comments are left unaddressed. On "🟡 Changes recommended", go back to step c, then wait for a fresh Copilot review on the new head.

Then invoke `post-pr` with `<url> --send`. Record `posted: true` and the message link.

### e. Wait for approval

Run the bundled wait script in the background with `run_in_background`:

```bash
~/.claude/skills/land-stack/wait-for-review.sh <owner/repo> <n> <feedbackSince>
```

Tell the user in one line that #n is waiting on review, then end the turn. The script's exit wakes you, so don't poll it. It prints one status line:

| Status | Action |
|---|---|
| `APPROVED` | Go to step f. |
| `MERGED` | Someone merged it by hand. Record the merge commit and go to the next PR. |
| `FEEDBACK <count>` | Go to step g. |
| `CLOSED` | Stop and report. |
| `TIMEOUT` | Relaunch the script with the same arguments. |

### f. Merge

1. Re-check `gh pr view <n> --json reviewDecision,mergeStateStatus,headRefOid` and `gh pr checks <n>`.
   - **`CLEAN` and approved:** merge.
   - **`BEHIND`:** run `git rebase origin/main`, then lint and typecheck, then `--force-with-lease`. Run babysit-pr again. Go back to step e if the push dismissed the approval.
   - **Anything else** (a failing check, `BLOCKED` despite the approval, `DIRTY`): stop and report.
2. Merge it with `gh pr merge <n> --squash`, unless the repo disallows squash. Don't pass `--delete-branch`: the repo's auto-delete handles the remote branch, and the gh flag also deletes and switches the local branch.
3. Confirm the merge with `gh pr view <n> --json state,mergeCommit -q '"\(.state) \(.mergeCommit.oid[0:8])"'`. Record `status: merged` and the merge commit.

Then start the next PR at step a.

### g. Review feedback

A human review, inline comment or conversation comment arrived after `feedbackSince`. It can arrive during step c or step e.

1. Note the current UTC time (`date -u +%Y-%m-%dT%H:%M:%SZ`). Invoke `pr-feedback` with the PR number, and follow it as written. It shows you its assessment and asks you which items to fix, reply to or skip. It also asks you to approve any pushback reply before posting it. Then it commits, pushes and replies.
2. Once it's done, set `feedbackSince` to the time you noted and save the state file. Using that time means a comment that lands while pr-feedback is running still counts as new.
3. Go back to step c to babysit the pushed commits. Then wait at step e again without reposting, since `posted` is already true. In a native stack, return to section 2's wait instead.

A `CHANGES_REQUESTED` decision stays on the PR until the reviewer approves. The wait script ignores it and watches only for new feedback and for approval.

## 4. Report

When every PR is merged, or the run stops, list each PR on one line: `#n title`, then the merge commit or the reason it stopped, then the Slack message link. Under each PR, list its unapplied ready-for-review findings, if any. If the run stopped, end with the exact step to resume from.

## Rules

- Never merge a PR that isn't approved or has a check that isn't passing. In a native stack, the stack merge counts as merging every PR in it, so every PR must pass both.
- The only allowed force-push is `--force-with-lease` on a stack branch right after rebasing it onto `main`, and lint and typecheck must pass first. Never amend.
- Never post the same PR to Slack twice.
- In section 3, work on one PR at a time. Don't start the next PR's ready-for-review or babysit while the current one is waiting on review, because its base is about to move. In section 2, bases don't move until the stack merges, so prepare every PR before waiting on reviews.
