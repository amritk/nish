// The wipes survive `opt -O2`, as CLAUDE.md ("Security") requires of every wipe
// of key material in `std/`. Each area file beside this one (`crypto.js`,
// `tls.js`, `quic.js`, `quic-server.js`) exports `wipeChecks`, a list of groups,
// and each group is one check:
//
// - `name`, the check's name, which a record's Tests list cites by its exact
//   string, so a group keeps its name once it has one. It starts with the area
//   (`<area>: the wipes survive opt -O2 (…)`), and `node tests/run.js <filter>`
//   runs the group when its name or its program's path contains the filter.
// - `program`, the whole program compiled, relative to the repository: every
//   export of a module it imports is emitted, so it need only import the
//   modules whose functions the roots name.
// - `modules`, the pattern a compiled module's text must match to go through
//   `opt -O2` (the modules that define the roots and what they call).
// - `roots`, `[symbol, count]` pairs: after `opt -O2`, `symbol` must reach
//   exactly `count` volatile wipes along every call site `opt` kept (a callee
//   called twice counts twice). A `wipe` is a volatile `llvm.memset` (`i1
//   true`) and a `secureZero` a call to `nish_wipe`, while an ordinary
//   `fill(0)` or loop of stores in their place is neither. The count is exact
//   rather than a floor because `-O2` can duplicate a wipe by inlining it into
//   two branches, and a floor would let one deleted wipe through. A deleted or
//   weakened wipe lowers a count, and so does one the optimiser removes; a wipe
//   added on purpose raises one, and the count in the area file is raised with
//   it.
//
// A group with no roots is not a check. A later area adds its groups to its
// own file; this one and `tests/run.js` do not change for it.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { wipeChecks as crypto } from "./crypto.js"
import { wipeChecks as quic } from "./quic.js"
import { wipeChecks as quicServer } from "./quic-server.js"
import { wipeChecks as tls } from "./tls.js"

/** Every group, area by area. */
const GROUPS = [...crypto, ...tls, ...quic, ...quicServer]

/**
 * Every function `opt -O2` left in the modules of `group.program` that match
 * `group.modules`, by symbol, and the failure to get them ("" when none).
 */
const optimisedBodies = (group, nish, root, dir) => {
  const bodies = new Map()
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const c = spawnSync(nish, [path.join(root, group.program), "-o", `${dir}/`], {
    cwd: root,
    encoding: "utf8",
  })
  let failure = c.status === 0 ? "" : c.stderr
  const modules = c.status === 0 ? fs.readdirSync(dir).filter((f) => f.endsWith(".ll")) : []
  for (const file of modules) {
    const ll = path.join(dir, file)
    if (!group.modules.test(fs.readFileSync(ll, "utf8"))) {
      continue
    }
    const o = spawnSync("opt", ["-O2", "-S", "-mtriple=x86_64-unknown-linux-gnu", ll], { encoding: "utf8" })
    if (o.status !== 0) {
      failure += o.stderr
      continue
    }
    for (const m of o.stdout.matchAll(/^define [^\n]*?@"?([\w.$]+)"?\([\s\S]*?\n\}/gm)) {
      bodies.set(m[1], m[0])
    }
  }
  return { bodies, failure }
}

/** The volatile wipes each symbol of `bodies` reaches, along every call site `opt` kept, as a function of the symbol. */
const wipeCounter = (bodies) => {
  const reached = new Map()
  const wipesUnder = (symbol) => {
    if (reached.has(symbol)) {
      return reached.get(symbol)
    }
    reached.set(symbol, 0) // a recursive call adds nothing
    const body = bodies.get(symbol)
    let count = (body.match(/call void @llvm\.memset[^\n]*i1 true\)|call void @nish_wipe\(/g) || []).length
    for (const m of body.matchAll(/call [^\n]*?@"?([\w.$]+)"?\(/g)) {
      count += bodies.has(m[1]) ? wipesUnder(m[1]) : 0
    }
    reached.set(symbol, count)
    return count
  }
  return wipesUnder
}

/**
 * Runs every group `only` selects, through `tests/run.js`'s own `check`, `skip`
 * and `has`: `nish` is the compiler under test and `buildDir` the run's scratch.
 */
export const runWipeChecks = ({ only, has, check, skip, nish, root, buildDir }) => {
  for (const group of GROUPS) {
    if (group.roots.length === 0 || (only && !group.name.includes(only) && !group.program.includes(only))) {
      continue
    }
    const area = group.name.slice(0, group.name.indexOf(":"))
    if (!has("opt")) {
      skip(`${area}: no opt to show the wipes survive -O2`)
      continue
    }
    const dir = path.join(buildDir, "wipes-o2", path.basename(path.dirname(group.program)))
    const { bodies, failure } = optimisedBodies(group, nish, root, dir)
    const wipesUnder = wipeCounter(bodies)
    const wrong = group.roots
      .map(([symbol, want]) => [symbol, want, bodies.has(symbol) ? wipesUnder(symbol) : null])
      .filter(([, want, got]) => got !== want)
    check(
      group.name,
      failure === "" && wrong.length === 0,
      failure ||
        wrong
          .map(([symbol, want, got]) =>
            got === null
              ? `${symbol}: not in the optimised modules`
              : `${symbol}: ${got} volatile wipes, want exactly ${want}`
          )
          .join("\n")
    )
  }
}
