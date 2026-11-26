#!/usr/bin/env node
// Whether a release tag's tree already has a green CI run (docs/wp10-ci.md,
// "The release reuses the Release PR's run"). release.yml's `verdict` job runs
// this script and writes `run=<id>` to $GITHUB_OUTPUT when one exists, and
// `run=` otherwise; its `ci` job runs the whole of ci.yml again only on `run=`.
//
// The Release PR's head is the release: release-pr.yml dispatches ci.yml at
// `release/next`, and merging that pull request is what cuts the tag. A
// dispatched run selects every lane and the `runner` job, as the tag's own run
// would. ci.yml's other reads of the ref or event (its concurrency group,
// `cancel-in-progress` and the dispatch's commit status) pick no job or test
// (tests/run.js pins the list). The seed both runs build with is the newest
// release, and only this tag's own release can ship between them. So a run
// of that kind whose commit has the tag commit's tree tested the same bytes. Matching trees rather than commits is what lets a squash merge
// through: its commit is new, but its tree is the head's when `release/next`
// was up to date with `main`. When `main` moved, the trees differ and CI runs.
//
// The rule is fail-closed: any run that is not exactly that kind is passed
// over, and any error writes `run=`, so the full CI runs.
//
//   node scripts/ci-verdict.mjs   # in the `verdict` job (env below)
//
// The environment: GITHUB_REPOSITORY, GITHUB_SHA (the tag's commit),
// GITHUB_TOKEN (with `actions: read`), GITHUB_OUTPUT and, optionally,
// GITHUB_API_URL.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** The branch release-pr.yml pushes and dispatches ci.yml at. */
export const RELEASE_BRANCH = "release/next"

/** How many of the newest green dispatched runs are compared. */
const RUNS_PER_PAGE = 20

/**
 * Whether a workflow run is one this release may stand on: a completed,
 * successful, dispatched run of this repository's ci.yml on `release/next`.
 * A `pull_request` run is scoped and may have skipped lanes, a `push` run on
 * `main` skips `runner`, and a fork's run is not this repository's code.
 *
 * @param {Record<string, any>} run an entry of the list-workflow-runs response
 * @param {string} repo `owner/name`
 * @returns {boolean} whether the run is a candidate
 */
export const eligible = (run, repo) =>
  run !== null &&
  typeof run === "object" &&
  run.path === ".github/workflows/ci.yml" &&
  run.event === "workflow_dispatch" &&
  run.head_branch === RELEASE_BRANCH &&
  run.status === "completed" &&
  run.conclusion === "success" &&
  run.repository?.full_name === repo &&
  run.head_repository?.full_name === repo &&
  typeof run.head_sha === "string" &&
  /^[0-9a-f]{40}$/.test(run.head_sha)

/**
 * The newest candidate run whose commit has `tree`, or null.
 *
 * @param {object} input
 * @param {Record<string, any>[]} input.runs the list-workflow-runs entries, newest first
 * @param {string} input.repo `owner/name`
 * @param {string} input.tree the tag commit's tree
 * @param {(sha: string) => Promise<string>} input.treeOf a commit's tree
 * @returns {Promise<Record<string, any> | null>} the run, or null
 */
export const pickRun = async ({ runs, repo, tree, treeOf }) => {
  if (!/^[0-9a-f]{40}$/.test(tree)) {
    return null
  }
  for (const run of runs) {
    if (eligible(run, repo) && (await treeOf(run.head_sha)) === tree) {
      return run
    }
  }
  return null
}

/**
 * Reads one JSON document from the GitHub API.
 *
 * @param {string} url the endpoint
 * @param {string} token a token that can read the repository's actions
 * @returns {Promise<any>} the parsed body
 */
const getJson = async (url, token) => {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    throw new Error(`GET ${url}: ${res.status}`)
  }
  return res.json()
}

const main = async () => {
  const repo = process.env.GITHUB_REPOSITORY ?? ""
  const sha = process.env.GITHUB_SHA ?? ""
  const token = process.env.GITHUB_TOKEN ?? ""
  const api = process.env.GITHUB_API_URL || "https://api.github.com"
  const out = process.env.GITHUB_OUTPUT
  let found = null
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9a-f]{40}$/.test(sha) || token === "") {
      throw new Error("GITHUB_REPOSITORY, GITHUB_SHA or GITHUB_TOKEN is missing")
    }
    const treeOf = async (commit) => {
      const body = await getJson(`${api}/repos/${repo}/git/commits/${commit}`, token)
      return typeof body?.tree?.sha === "string" ? body.tree.sha : ""
    }
    const tree = await treeOf(sha)
    const branch = encodeURIComponent(RELEASE_BRANCH)
    const listed = await getJson(
      `${api}/repos/${repo}/actions/workflows/ci.yml/runs?branch=${branch}&event=workflow_dispatch&status=success&per_page=${RUNS_PER_PAGE}`,
      token
    )
    const runs = Array.isArray(listed?.workflow_runs) ? listed.workflow_runs : []
    found = await pickRun({ runs, repo, tree, treeOf })
    if (found === null) {
      console.log(`ci-verdict: no green dispatched ci.yml run on ${RELEASE_BRANCH} has tree ${tree}; CI runs`)
    } else {
      console.log(`ci-verdict: run ${found.id} (${found.html_url}) tested tree ${tree} at ${found.head_sha}`)
    }
  } catch (err) {
    console.log(`ci-verdict: ${err.message}; CI runs`)
    found = null
  }
  const id = found !== null && Number.isSafeInteger(found.id) && found.id > 0 ? String(found.id) : ""
  if (out) {
    fs.appendFileSync(out, `run=${id}\n`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Unreachable unless the output write itself fails; let the job go red.
    console.error(err)
    process.exitCode = 1
  })
}
