---
name: steal-features
description: Survey donor repos for UI affordances worth transplanting into the current app, via a multi-agent workflow (~40 agents / ~2M tokens / ~20 min) with adversarial verification against the current codebase. Use when the user says "steal features", "feature steal survey", "what can we steal from <product>", or wants a ranked list of transplantable UX affordances.
---

# steal-features — ranked survey of transplantable UI affordances

Runs a multi-agent survey over donor repos, filters candidates through an adversarial
verification pass against the current repo (the transplant target), and produces a ranked
"features worth stealing" report with pre-specified analytics events per candidate.

The target app is whatever repo the session is in — the workflow describes it automatically
from CLAUDE.md/README/src. Run this from the app you want to steal *for*.

Cost expectation (tell the user before launching if they haven't run it before): roughly
40 agents / ~2M tokens / ~20 minutes at seven donor repos; each additional surveyed repo adds
~50-70k tokens plus its share of verification.

## Phase 1 — Choose and clone donor repos

The workflow surveys **whatever is cloned into `/tmp/feature-steal/`** — a scout agent
enumerates the directory, skims each repo, generates focus hints, and skips repos with no real
frontend. Broadening the sweep means cloning more repos; the script never needs editing.

Pick donors relevant to the target: sibling products in the same suite, the UX-richest apps in
the same org, and the products users compare the target to. For example, for Grafana-ecosystem
targets the public Drilldown apps are proven high-yield donors:

```bash
mkdir -p /tmp/feature-steal && cd /tmp/feature-steal
for r in logs-drilldown metrics-drilldown traces-drilldown profiles-drilldown; do
  [ -d $r ] || git clone --quiet --depth 1 git@github.com:grafana/$r.git &
done; wait
```

Add your org's sibling app repos to the loop as well — often the highest-yield donors of all.
If any are private, keep the repo names out of anything you publish.

Discovery queries for widening (adapt the org):

```bash
gh api "orgs/<org>/repos?per_page=100&sort=pushed" --paginate --jq \
  '.[] | select(.archived|not) | select(.name|test("-app$|drilldown")) | .name' | sort -u
```

Verify each candidate exists with `gh api repos/<org>/<name>` first (repos get renamed;
`explore-logs` became `logs-drilldown`).

**Present the proposed clone list to the user before cloning beyond an established core set** —
sweep breadth is a cost decision. For huge repos (e.g. `grafana/grafana`), sparse-clone only the
relevant feature directories:

```bash
git clone --quiet --depth 1 --filter=blob:none --sparse git@github.com:grafana/grafana.git
git -C grafana sparse-checkout set public/app/features/explore public/app/features/logs
```

Refresh clones older than a week with `git -C /tmp/feature-steal/<r> pull --depth 1`.
Remove directories the user wants excluded — anything present gets scouted.

## Phase 2 — Run the workflow

The workflow script ships with this skill. Invoke it by path (base directory is stated at the
top of this skill's invocation context):

```
Workflow({ scriptPath: "<skill base dir>/feature-steal-survey.js" })
```

It runs in the background; report progress via /workflows if the user asks. The rubric, skeptic
criteria, and report format live in the script — tune them there, not in ad-hoc prompts.
Optional args:

- `{ maxSurveys: N }` — widen the 16-repo survey cap (scout-ranked).
- `{ repos: [{ name, path, hint }] }` — bypass scouting, survey exactly these.
- `{ target: { product, dataAvailable, surfaces } }` — skip target auto-description.
- `{ reportPath: "..." }` — default is `feature-steal-report.md` in the repo root.

The script tolerates args not arriving (a known plumbing failure mode) by falling back to
auto-description and directory scouting.

## Phase 3 — Deliver

The workflow writes the report to the report path (keep it untracked — do not commit it) and
returns the same markdown plus survivor/killed counts.

- Summarize the top 10 for the user as a compact table (feature, source, effort), then flag
  anything notable in the honorable mentions or kill list.
- Offer follow-ups, but do not do them unasked: draft terse GitHub issues for chosen candidates
  (each already names its analytics events), or start implementing one.

## Notes

- The verification pass is the value: survey agents overclaim, and roughly a third of candidates
  die on "already exists" or "data not in the API" evidence. Never skip it to save tokens.
- Candidates must satisfy the transplant rubric (data the target already has; UI-layer only;
  nameable impression/engagement events). If the user asks for backend-inclusive ideas, say the
  rubric excludes them and ask whether to widen it in the workflow script.
