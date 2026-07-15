export const meta = {
  name: 'feature-steal-survey',
  description: 'Survey donor repos cloned into /tmp/feature-steal for UI affordances to transplant into the current app',
  whenToUse: 'Invoked by the steal-features skill after it clones donor repos into /tmp/feature-steal. The target app is the current working directory (auto-described unless args.target is passed). Broaden the sweep by cloning more repos, not by editing this script.',
  phases: [
    { title: 'Scout', detail: 'describe the target app; enumerate /tmp/feature-steal, skim each repo, triage' },
    { title: 'Survey', detail: 'one reader per worthwhile repo + a docs sweep' },
    { title: 'Merge', detail: 'dedupe semantic duplicates across sources' },
    { title: 'Verify', detail: 'skeptic per candidate against the target codebase' },
    { title: 'Synthesize', detail: 'ranked shortlist written to the report path' },
  ],
}

const safeArgs = typeof args === 'object' && args !== null ? args : {}
const REPORT_PATH = safeArgs.reportPath || 'feature-steal-report.md'
const CLONE_DIR = safeArgs.cloneDir || '/tmp/feature-steal'
const MAX_SURVEYS = safeArgs.maxSurveys || 16

const TARGET = {
  type: 'object', required: ['product', 'dataAvailable', 'surfaces'],
  properties: {
    product: { type: 'string', description: 'what the app does and for whom, in two or three sentences' },
    dataAvailable: { type: 'string', description: 'the domain data its API/frontend already has access to' },
    surfaces: { type: 'string', description: 'its main UI surfaces (tables, forms, editors, wizards, empty states) that candidates could map onto' },
  } }

const SCOUTED = {
  type: 'object', required: ['repos'],
  properties: { repos: { type: 'array', items: {
    type: 'object', required: ['name', 'path', 'hint', 'worthFullSurvey'],
    properties: {
      name: { type: 'string' },
      path: { type: 'string' },
      hint: { type: 'string', description: 'one or two sentences directing a surveyor at the most transplant-relevant UI areas of this repo' },
      worthFullSurvey: { type: 'boolean', description: 'false for repos with little or no user-facing frontend' },
      reason: { type: 'string', description: 'why it is or is not worth a full survey' },
    } } } } }

const CANDIDATES = {
  type: 'object', required: ['candidates'],
  properties: { candidates: { type: 'array', items: {
    type: 'object', required: ['feature', 'evidence', 'target_surface', 'effort', 'kpi_events', 'rationale'],
    properties: {
      feature: { type: 'string', description: 'short name of the affordance' },
      evidence: { type: 'string', description: 'file paths / doc URLs proving it exists and how it works' },
      target_surface: { type: 'string', description: 'which target-app surface it maps to' },
      effort: { enum: ['S', 'M', 'L'] },
      kpi_events: { type: 'string', description: 'impression/engagement analytics events it would need' },
      rationale: { type: 'string', description: 'why this transplants well' },
      source: { type: 'string' },
    } } } } }

const VERDICT = {
  type: 'object', required: ['keep', 'reason'],
  properties: {
    keep: { type: 'boolean' },
    reason: { type: 'string' },
    adjusted_effort: { enum: ['S', 'M', 'L'] },
    sharpened_mapping: { type: 'string', description: 'refined description of how it lands in the target app' },
  } }

phase('Scout')
const target = safeArgs.target ||
  await agent(`Describe the app in the current working directory as a transplant target. Read CLAUDE.md / AGENTS.md / README.md and skim the src layout (API types, pages, components). Return: product (what it does, for whom), dataAvailable (the domain data its API/frontend already has), surfaces (its main UI surfaces that a transplanted affordance could map onto).`,
    { label: 'describe-target', phase: 'Scout', schema: TARGET })

const RUBRIC = `You are hunting for UI affordances to TRANSPLANT into a target app.
Target app: ${target.product}
Data it already has: ${target.dataAvailable}
UI surfaces to map onto: ${target.surfaces}
A candidate qualifies ONLY if all three hold:
1. It operates on data the target app already has. No new backend service.
2. It is a UI-layer interaction/component pattern (inline actions, previews, popovers, sparklines, wizards, keyboard affordances, empty states, progressive disclosure) — not a data pipeline.
3. It has an obvious engagement metric: you can name the impression + interaction analytics events.
A successful prior example of the genre: one app transplanting another's click-a-template-token-to-preview-its-top-values affordance onto its own table rows.`

const scouted = safeArgs.repos
  ? { repos: safeArgs.repos.map((r) => ({ worthFullSurvey: true, ...r })) }
  : await agent(`Enumerate the repos cloned at ${CLONE_DIR} (one directory each; use Bash ls, then skim each repo's README, plugin.json, and src layout). The transplant target is: ${target.product}\nFor each repo, decide whether it has enough user-facing frontend to be worth a full transplant survey for that target, and write a one-to-two-sentence hint directing a surveyor at its most transplant-relevant UI areas (tables, editors, previews, wizards, empty states). Return every directory you find with worthFullSurvey set accordingly.`,
      { label: 'scout', phase: 'Scout', schema: SCOUTED })

const skippedByScout = scouted.repos.filter((r) => !r.worthFullSurvey)
if (skippedByScout.length) {
  log(`scout skipped ${skippedByScout.length} repo(s): ${skippedByScout.map((r) => r.name).join(', ')}`)
}
let repos = scouted.repos.filter((r) => r.worthFullSurvey)
if (repos.length > MAX_SURVEYS) {
  log(`capping surveys at ${MAX_SURVEYS} of ${repos.length} repos (raise args.maxSurveys to widen)`)
  repos = repos.slice(0, MAX_SURVEYS)
}
log(`surveying ${repos.length} repo(s)`)

phase('Survey')
const repoSurveys = repos.map((r) => () =>
  agent(`${RUBRIC}\n\nSurvey the repo at ${r.path} (${r.name}). ${r.hint}\nRead its pages/components/features directories; look at how users explore, filter, preview, and act on their data. Find the affordances worth stealing. Quality over quantity: return your at-most-8 BEST candidates as structured output; set source to "${r.name}". Evidence must cite real file paths you read.`,
    { label: `survey:${r.name}`, phase: 'Survey', schema: CANDIDATES }))
const docsSurvey = () =>
  agent(`${RUBRIC}\n\nSweep the public web (product docs, release notes / What's New posts, and blog posts for the ecosystem the target app belongs to) for UI affordances that match the rubric. Return your at-most-8 best candidates; set source to "docs-sweep". Evidence must cite URLs.`,
    { label: 'survey:docs', phase: 'Survey', schema: CANDIDATES })

const surveyed = (await parallel([...repoSurveys, docsSurvey])).filter(Boolean)
const all = surveyed.flatMap((s) => s.candidates)
log(`${all.length} raw candidates from ${surveyed.length} sources`)

phase('Merge')
const merged = await agent(`Here are feature-transplant candidates from several source surveys as JSON:\n${JSON.stringify(all)}\n\nMerge TRUE semantic duplicates (same affordance found in multiple repos) into one candidate each, unioning their evidence and listing all sources. Do not drop distinct candidates. Order the result from most to least promising (measurable engagement + low effort + clear fit for this target: ${target.product}). Return the merged list.`,
  { label: 'merge', phase: 'Merge', schema: CANDIDATES })

let toVerify = merged.candidates
if (toVerify.length > 32) {
  log(`capping verification at 32 of ${toVerify.length} candidates (dropping the tail of the merge ranking)`)
  toVerify = toVerify.slice(0, 32)
}

phase('Verify')
const verified = await parallel(toVerify.map((c) => () =>
  agent(`You are a skeptic. Kill weak feature-transplant candidates for the target app, whose codebase is the current working directory — read it as needed (its API type definitions for available data; its components/pages for what already exists). Target: ${target.product}\n\nCandidate: ${JSON.stringify(c)}\n\nKill it (keep=false) ONLY with concrete evidence for at least one of: (1) the target already has this or something equivalent — cite the file; (2) the data it needs does not exist in the target's API surface — cite what is missing from the API types or hooks; (3) it is actually backend-heavy despite appearances — explain the missing service. Otherwise keep it, optionally adjusting effort and sharpening the mapping onto a concrete target surface.`,
    { label: `verify:${c.feature.slice(0, 40)}`, phase: 'Verify', schema: VERDICT })
    .then((v) => ({ ...c, verdict: v }))))

const judged = verified.filter(Boolean)
const survivors = judged.filter((c) => c.verdict.keep)
const killed = judged.filter((c) => !c.verdict.keep)
log(`${survivors.length} survived, ${killed.length} killed`)

phase('Synthesize')
const report = await agent(`Write a terse, decision-ready markdown report: "Features worth stealing".\nTarget app: ${target.product}\n\nSurvivors (verified transplant candidates): ${JSON.stringify(survivors)}\n\nKilled candidates with reasons: ${JSON.stringify(killed.map((c) => ({ feature: c.feature, reason: c.verdict.reason })))}\n\nStructure: (1) top 10 ranked — for each: one-para description, source, target surface, effort, the analytics events it needs, and why it ranks where it does; (2) honorable mentions as one-liners; (3) appendix listing killed candidates with their kill reasons. Rank by: engagement measurability, effort, and strength of fit. American English.\n\nWrite the full report to ${REPORT_PATH} with the Write tool (create the directory if needed), AND return the same markdown as your final output.`,
  { label: 'report', phase: 'Synthesize' })

return { report, reportPath: REPORT_PATH, survivorCount: survivors.length, killedCount: killed.length }
