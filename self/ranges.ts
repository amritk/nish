// Call-site ranges: the bounds proof of `self/bounds.ts`, carried across calls
// (docs/wp15-performance.md §2.4).
//
// Pass 2 proves each body on its own, and there every call is a wall: a
// parameter arrives knowing nothing, and a call drops every array length and
// every path fact, because the callee is not known yet. Once every body is
// checked the whole program is, and this pass reads it for two things.
//
// **What a call can do.** A `CallSummary` per function: the field names it,
// or anything it calls, may store to, and the record types it may store whole
// — or `null`, "anything", for one that calls a builtin handed an array or an
// object (`push` and `pop` are those), `Arena`, a foreign function, an
// instantiation, or stores to a field called `length`. A call with a summary
// resizes no array, so the caller keeps every array length across it, and
// every path whose fields and links the summary leaves alone. A builtin handed
// only numbers, booleans and strings has the empty summary: with no mutable
// module state and no function value, what a call is handed is all it can
// reach (`isInertBuiltin`).
//
// **What a function is entered with.** `EntryFacts` per function, stated
// against its parameters by position: a floor and a `maxIndex` per integer
// parameter, and length facts about a holder read off a parameter —
// `this.v.length >= 6`, `i < this.v.length`. A function takes them only when
// every call to it is one this pass can see, which rules out:
//
//   - a function a host can call with anything (`hostVisible` in
//     `self/visibility.ts`): the entry point, which the runtime calls, and —
//     unless the build is its own final link, with no sidecar, no wasm and no
//     C function declared — an exported function or a method of an exported
//     class, which a C, wasm or N-API host may call. In such a closed-world
//     build `export` only means "importable", every call to an exported
//     function is in the program, and it takes entry facts like any other;
//   - a `hidden` function, which another module's instantiation calls;
//   - a constructor, an instantiation, a lifted arrow and a function taking a
//     compile-time function, whose calls are made from an instantiation's
//     body, which has side tables of its own;
//   - any function called from a place the walk does not reach with a state —
//     an instantiation's body, an arrow's, code after a `return` — which is
//     found by scanning every call in the program, not by trusting the walk to
//     have seen them all, and is given no entry facts (`forced`).
//
// The facts a function is entered with are what every one of its call sites
// proves, joined: the weaker floor, the higher bound, the shorter length, a
// relation only where every site states it. A call site is judged in its
// caller's state once every argument has run, and a fact about the local an
// argument named, or a path read off one, is carried only while nothing
// evaluated after that argument can write it (`siteFacts` in bounds.ts).
//
// Recursion is a fixpoint. A function no reached caller has called yet has no
// entry facts at all — it is not known to run — and each round walks every
// reached body under its current entry facts, collects its call sites, and
// recomputes every entry as the join of the sites seen. An entry can only get
// weaker once it is set, since a new caller adds a site to the join and a
// weaker entry proves less at every site below it, so the rounds end. The last
// round's entries are an invariant of every call the program makes: each
// holds on entry to the first call from outside the candidate set, and each
// site proves it for the next. Only then is a proof recorded: a walk in the
// rounds writes nothing and keeps what it proved aside, and the last walk of
// each body — which was the one under its settled entry, since a changed
// entry marks its body for another — is what gets recorded.
//
// What keeps the cost to what can pay, none of it at the price of a proof
// (docs/ARCHITECTURE.md, the call-site ranges row, has the argument):
//
//   - only a candidate with an access some walk could prove (`isOpenAccess`),
//     or one that calls such a candidate, takes part (`narrowCandidates`), and
//     a body is walked again after the rounds only when it has such an access
//     and a call with a summary, or entry facts;
//   - a round joins again only the entries its walks can have moved, and an
//     empty entry, which stays empty, is not joined again;
//   - a site for a callee entered with nothing, which stays so, is not worked
//     out; a body whose candidate callees are all entered with nothing is not
//     walked for its sites; and a body with nothing open stops walking once it
//     has noted a site for every call to a candidate it makes.
//
// `--range-reference` (`Options.rangeReference`) runs the pass without any of
// that, by the rule #222 shipped, and `tests/run.js` requires the same proofs
// both ways over `self/` and AWFY.
//
// What holds on entry is then subject to every rule in bounds.ts: a parameter
// cannot be assigned, and a path fact is dropped by a store to a field on it,
// a whole-record store that reaches it, and a call whose summary says either.
//
// `--unchecked-indexing` has no check to remove, so the pass does not run and
// the output is what it was. `--threads` changes nothing here. The one thing
// in the language that runs code on other threads is a `nish/threads` region
// (`self/parallel.ts`): its body is called from an instantiation, so it is
// entered knowing nothing; it is held to writing nothing its caller can see,
// and what it allocates lives in the worker's own arena and dies with its
// element, so no worker resizes an array or rebinds a field that another
// thread holds a fact about; and its caller waits at the join. Any
// other call runs on its caller's thread, and a host thread resizing an array
// a Nish function is using is a data race that breaks the facts inside one
// body just as much as across a call.

import {
  BoundsWalk,
  CallSummary,
  EntryFacts,
  NOT_HERE,
  NO_RECORD,
  RangeSite,
  RangeTables,
  callsNothing,
  commitProofs,
  isBoundsAssignment,
  isInertBuiltin,
  isOpenAccess,
  joinEntryFacts,
  parameterLocals,
  recordStoreType,
  sameEntryFacts,
  unwrapBoundsParens,
  walkWithRanges,
} from "./bounds";
import { CheckContext } from "./context";
import { Diagnostic } from "./diagnostics";
import { N_ARROW, N_BINARY, N_CALL, N_INDEX, N_MEMBER, N_NEW, N_UNARY, Node } from "./nodes";
import { CheckedProgram, FunctionSig, Instantiation, ROLE_CONSTRUCTOR } from "./program";
import { Local } from "./symbols";
import { BuildMode, hostVisible } from "./visibility";

/**
 * How many rounds the entry fixpoint may take before it gives up and proves
 * nothing from entry facts at all. Each round either settles or weakens an
 * entry, so the bound is only a guard: `self/` settles in six rounds and
 * `tests/cases/arr_range_call`, whose recursion walks `n` down, in nine.
 */
const ROUND_LIMIT: i32 = 64;

/**
 * One body the pass reads, and what the pass knows about it. `instance` is
 * `null` for a body checked into its module's own tables; the rest is the
 * fixpoint's state for a body that is walked, and unused for an
 * instantiation's, which is only scanned.
 */
class RangeBody {
  ctx: CheckContext;
  sig: FunctionSig;
  body: Node;
  instance: Instantiation | null;
  /** What this body stores by itself and whom it calls (`summarise`). */
  scan: StoreScan;
  /** The facts it is entered with; `null` until a reached caller calls it. */
  entering: EntryFacts | null;
  /** The join of the sites seen this round, which `entering` becomes. */
  joined: EntryFacts | null;
  /** Its call sites, as its last walk found them; `null` before its first. */
  sites: RangeSite[] | null;
  /** Its last walk, whose proofs are kept once its entry has settled. */
  last: BoundsWalk | null;
  /** Whether it takes entry facts at all (`takesEntryFacts`). */
  candidate: boolean;
  /** Whether its entry changed since its last walk. */
  stale: boolean;
  /** Called from a place with no state to judge the call in, so entered knowing nothing. */
  forced: boolean;
  /** Its program's callee table (`RangeTables.calleesOf`). */
  callees: i32[];
  /** Its parameters' locals (`parameterLocals`), found the first time an entry is seeded. */
  params: (Local | null)[] | null;

  constructor(
    ctx: CheckContext,
    sig: FunctionSig,
    body: Node,
    instance: Instantiation | null,
    tables: RangeTables,
    callees: i32[]
  ) {
    this.ctx = ctx;
    this.callees = callees;
    this.params = null;
    this.sig = sig;
    this.body = body;
    this.instance = instance;
    this.scan = new StoreScan(ctx, tables, callees);
    this.entering = null;
    this.joined = null;
    this.sites = null;
    this.last = null;
    this.candidate = false;
    this.stale = true;
    this.forced = false;
  }
}

/**
 * Whether every call to `sig` is one the pass can see: the rules in the
 * header, less the last, which is found by scanning.
 */
const takesEntryFacts = (sig: FunctionSig, mode: BuildMode, isEntry: boolean): boolean =>
  !hostVisible(mode, sig.exported, isEntry) &&
  !sig.hidden &&
  sig.role !== ROLE_CONSTRUCTOR &&
  sig.compileTime.length === 0 &&
  !sig.foreign();

/** The locals `body`'s entry facts are seeded into, found once, and only for a body entered with some. */
const paramsOf = (body: RangeBody, entering: EntryFacts | null): (Local | null)[] => {
  const known = body.params;
  if (known !== null) {
    return known;
  }
  if (entering === null || entering.isEmpty()) {
    return [];
  }
  const params = parameterLocals(body.ctx.program, body.sig, body.body);
  body.params = params;
  return params;
};

/** The walked body `sig` is, or `null` for one with no body here. */
const bodyOf = (tables: RangeTables, bodies: RangeBody[], sig: FunctionSig): RangeBody | null => {
  const at = tables.index.get(sig.name, -1);
  return at >= 0 && at < bodies.length ? bodies[at] : null;
};

/**
 * Prove what call sites guarantee, over every module of a checked program.
 * Runs after pass 3, so every body — every instantiation's included — has its
 * side tables, and before the attribute analysis, which reads the proofs.
 */
export const proveCallSiteRanges = (contexts: CheckContext[], mode: BuildMode, reference: boolean): void => {
  if (contexts.length === 0 || contexts[0].uncheckedIndexing) {
    return;
  }
  const tables = new RangeTables();
  const bodies: RangeBody[] = [];
  const hidden: RangeBody[] = [];
  for (const ctx of contexts) {
    const program = ctx.program;
    if (program.activeInstance !== null) {
      return;
    }
    const callees = tables.calleesOf(program);
    for (const sig of program.functions) {
      const body = sig.body();
      if (body === null || !sig.definedIn(program.source)) {
        continue;
      }
      if (sig.instance !== null) {
        hidden.push(new RangeBody(ctx, sig, body, sig.instance, tables, callees));
      } else if (!sig.lifted) {
        const walked = new RangeBody(ctx, sig, body, null, tables, callees);
        const entryMain = program.entryMain;
        walked.candidate = takesEntryFacts(sig, mode, entryMain !== null && entryMain === sig);
        tables.add(sig, walked.candidate);
        bodies.push(walked);
      }
    }
    for (const info of program.instantiationList) {
      const body = info.sig.body();
      if (body !== null) {
        hidden.push(new RangeBody(ctx, info.sig, body, info, tables, callees));
      }
    }
  }
  const order = summarise(tables, bodies);
  narrowCandidates(tables, bodies, order, reference);

  // A call from a body with no state to judge it in gives its callee nothing.
  for (const body of hidden) {
    const instance = body.instance;
    if (instance !== null) {
      forceCalls(tables, bodies, instance.nodeCallees, body.body);
    }
  }

  const settled = settleEntries(tables, bodies, reference);

  // The entries are settled, and a body's last walk was the one under its
  // settled entry, since every change to an entry marks its body for another
  // walk: those proofs are kept as they are. A body the fixpoint never
  // walked is walked once now, unless pass 2 proved all of it or it has no
  // call with a summary and nothing on entry, when the walk would find what
  // pass 2 did.
  for (const body of bodies) {
    const last = body.last;
    if (settled && last !== null) {
      commitProofs(body.ctx.program, last);
      retractWarnings(body.ctx, last.proved);
      continue;
    }
    const entering: EntryFacts | null = settled && body.candidate ? body.entering : null;
    const known = entering !== null && !entering.isEmpty();
    if (!isOpen(body.scan, reference) || (!body.scan.calls && !known)) {
      continue;
    }
    const walk = walkWithRanges(body.ctx, paramsOf(body, entering), body.body, tables, body.callees, entering, true, -1);
    retractWarnings(body.ctx, walk.proved);
  }
};

/**
 * Keep as candidates only the functions whose entry facts could prove
 * something: one with an access some walk could still prove (`isOpen`), or
 * one that calls such a candidate and could hand its facts on. The rest are
 * entered with nothing, as if a caller had been hidden, which costs no proof —
 * an access `isOpenAccess` turns down keeps its check under every entry — and
 * no walk of a caller that calls nothing else.
 */
const narrowCandidates = (tables: RangeTables, bodies: RangeBody[], order: i32[], reference: boolean): void => {
  const useful: boolean[] = [];
  for (const body of bodies) {
    useful.push(body.candidate && isOpen(body.scan, reference));
  }
  // Usefulness runs from a callee to its callers, so callees go first.
  let changed = true;
  while (changed) {
    changed = false;
    for (const at of order) {
      if (at >= 0 && at < bodies.length && at < useful.length) {
        const body = bodies[at];
        if (body.candidate && !useful[at] && callsUseful(body.scan, useful)) {
          useful[at] = true;
          changed = true;
        }
      }
    }
  }
  let at = 0;
  for (const body of bodies) {
    if (body.candidate && at < useful.length && !useful[at]) {
      body.candidate = false;
      tables.dropCandidate(at);
    }
    at = at + 1;
  }
  for (const body of bodies) {
    body.scan.callsCandidate = callsUseful(body.scan, useful);
  }
};

/**
 * Whether a walk of the body `scan` read could prove more than pass 2 did: it
 * has an access `isOpenAccess` answers for — or, by the reference rule of
 * `--range-reference`, any access pass 2 left checked and any `substring`.
 */
const isOpen = (scan: StoreScan, reference: boolean): boolean => (reference ? scan.openAny : scan.open);

const callsUseful = (scan: StoreScan, useful: boolean[]): boolean => {
  for (const callee of scan.callees) {
    if (callee >= 0 && callee < useful.length && useful[callee]) {
      return true;
    }
  }
  return false;
};

/**
 * The entry fixpoint of the header, answering whether it settled within
 * `ROUND_LIMIT` rounds. A body's `entering` is `null` while nothing reached
 * calls it, and always for one that takes no entry facts.
 *
 * A round joins again only the entries it can have moved: those of the
 * callees of a body it walked, and of a function it forced. Every other
 * callee's sites are the objects the last round joined, in the same order, so
 * its join would come out as the one its `entering` already says.
 */
const settleEntries = (tables: RangeTables, bodies: RangeBody[], reference: boolean): boolean => {
  const touched: boolean[] = [];
  for (const body of bodies) {
    touched.push(body.candidate);
  }
  let rounds = 0;
  let changed = true;
  while (changed) {
    rounds = rounds + 1;
    if (rounds > ROUND_LIMIT) {
      return false;
    }
    changed = false;
    for (const body of bodies) {
      // A body that calls no candidate has no site to find, so the fixpoint
      // never needs to walk it.
      const reached = !body.candidate || body.entering !== null;
      if (reached && body.stale && body.scan.callsCandidate && !reference && !feedsEntry(bodies, body)) {
        // Every candidate it calls is entered knowing nothing already, and
        // an empty entry stays empty, so no site of this body can move one.
        // Its own proofs are left to the walk after the rounds, under the
        // entry it settles on: the last walk it had was under an older one.
        body.stale = false;
        body.last = null;
      } else if (reached && body.stale && body.scan.callsCandidate) {
        const walk = walkWithRanges(
          body.ctx,
          paramsOf(body, body.entering),
          body.body,
          tables,
          body.callees,
          body.entering,
          false,
          reference || body.scan.open ? -1 : candidateCalls(bodies, body)
        );
        touchCallees(touched, body.sites);
        touchCallees(touched, walk.sites);
        body.sites = walk.sites;
        body.last = walk;
        forceUnseen(bodies, body, walk.sites, touched);
        body.stale = false;
      }
    }
    let at = 0;
    for (const body of bodies) {
      if (at < touched.length && touched[at]) {
        body.joined = null;
      }
      at = at + 1;
    }
    for (const body of bodies) {
      const sites = body.sites;
      if (sites === null) {
        continue;
      }
      for (const site of sites) {
        if (site.at >= 0 && site.at < bodies.length && touched[site.at]) {
          // Nothing joined with anything is nothing, so a join that is
          // already empty stays as it is.
          const callee = bodies[site.at];
          const joined = callee.joined;
          if (joined === null) {
            callee.joined = site.facts;
          } else if (reference || !joined.isEmpty()) {
            callee.joined = joinEntryFacts(joined, site.facts);
          }
        }
      }
    }
    at = 0;
    for (const body of bodies) {
      const self = at;
      let moved = false;
      if (at < touched.length && touched[at]) {
        // The reference joins every entry again in every round.
        touched[at] = reference && body.candidate;
        moved = true;
      }
      at = at + 1;
      if (!body.candidate || !moved) {
        continue;
      }
      // A forced function is reached, and entered knowing nothing.
      let next = body.joined;
      if (body.forced) {
        next = new EntryFacts(body.sig.paramNames.length);
      }
      const now = body.entering;
      const same = now !== null && next !== null && sameEntryFacts(now, next);
      if (!same && !(now === null && next === null)) {
        body.entering = next;
        body.stale = true;
        changed = true;
        if (!reference && next !== null && next.isEmpty()) {
          tables.settleEmpty(self, next);
        }
      }
    }
  }
  return true;
};

/**
 * How many calls to a candidate `body` makes. A walk of a body with nothing
 * open proves nothing, and is only after its sites: once it has noted this
 * many, every call it will ever note is noted, and the rest of the body is
 * not walked. A call it cannot reach with a state — after a `return`, inside
 * an arrow — keeps the count from being met, and that walk goes to the end.
 */
const candidateCalls = (bodies: RangeBody[], body: RangeBody): i32 => {
  let count = 0;
  for (const at of body.scan.userCallees) {
    if (at >= 0 && at < bodies.length && bodies[at].candidate) {
      count = count + 1;
    }
  }
  return count;
};

/**
 * Whether a site of `body` could still move an entry: it calls a candidate
 * that no site has reached yet, or one entered knowing something. An entry
 * that is empty stays empty, since the join with an empty site is empty and
 * every entry only weakens.
 */
const feedsEntry = (bodies: RangeBody[], body: RangeBody): boolean => {
  for (const callee of body.scan.callees) {
    if (callee >= 0 && callee < bodies.length && bodies[callee].candidate) {
      const entering = bodies[callee].entering;
      if (entering === null || !entering.isEmpty()) {
        return true;
      }
    }
  }
  return false;
};

const touchCallees = (touched: boolean[], sites: RangeSite[] | null): void => {
  if (sites === null) {
    return;
  }
  for (const site of sites) {
    if (site.at >= 0 && site.at < touched.length) {
      touched[site.at] = true;
    }
  }
};

/**
 * Mark every candidate called in `node`, an instantiation's body: no walk
 * reaches such a call with a state, so its callee's entry facts can only be
 * empty. `callees` is the table the calls were resolved into, the
 * instantiation's own.
 */
const forceCalls = (tables: RangeTables, bodies: RangeBody[], callees: (FunctionSig | null)[], node: Node): void => {
  if (node.kind === N_CALL) {
    const callee = callees[node.id];
    const target: RangeBody | null = callee === null ? null : bodyOf(tables, bodies, callee);
    if (target !== null && target.candidate) {
      target.forced = true;
    }
  }
  for (const child of node.children) {
    forceCalls(tables, bodies, callees, child);
  }
};

/**
 * `forceCalls` for a walked body, over the calls its scan recorded rather than
 * over the tree again: every call to a candidate the walk did not reach with a
 * state — one inside an arrow, or after a `return` — leaves its callee
 * entered knowing nothing.
 */
const forceUnseen = (bodies: RangeBody[], body: RangeBody, seen: RangeSite[], touched: boolean[]): void => {
  // The calls the walk saw are marked in the callee table, by the sign of
  // their entry, for the length of this scan: a search of `seen` per call
  // cost more than the walk that found them.
  const known = body.callees;
  for (const site of seen) {
    const id = site.call.id;
    if (id >= 0 && id < known.length && known[id] > 0) {
      known[id] = -known[id];
    }
  }
  const scan = body.scan;
  let k = 0;
  for (const call of scan.userCalls) {
    const at = k < scan.userCallees.length ? scan.userCallees[k] : -1;
    if (at >= 0 && at < bodies.length && bodies[at].candidate && !bodies[at].forced && !sawCall(known, seen, call)) {
      bodies[at].forced = true;
      if (at < touched.length) {
        touched[at] = true;
      }
    }
    k = k + 1;
  }
  for (const site of seen) {
    const id = site.call.id;
    if (id >= 0 && id < known.length && known[id] < 0) {
      known[id] = -known[id];
    }
  }
};

const sawCall = (known: i32[], seen: RangeSite[], call: Node): boolean => {
  const mark = call.id < known.length ? known[call.id] : 0;
  if (mark !== 0) {
    return mark < 0;
  }
  for (const site of seen) {
    if (site.call === call) {
      return true;
    }
  }
  return false;
};

// ---- Summaries ----------------------------------------------------------------------

/**
 * The call-effect summary of every body, to a fixpoint over the call graph:
 * a function stores what its body stores and what its callees do, and one
 * that may resize an array, or calls anything without a summary, has none.
 */
const summarise = (tables: RangeTables, bodies: RangeBody[]): i32[] => {
  for (const body of bodies) {
    scanStores(body.body, body.scan, false);
  }
  // Callees first, so that a sweep hands a summary on up a whole chain of
  // calls; only a cycle takes a second. The fixpoint is a union, so the order
  // changes how soon it is reached and not what it is.
  const order = calleesFirst(bodies);
  let changed = true;
  while (changed) {
    changed = false;
    for (const next of order) {
      if (next < 0 || next >= bodies.length) {
        continue;
      }
      const scan = bodies[next].scan;
      if (scan.opaque) {
        continue;
      }
      for (const callee of scan.callees) {
        const other: StoreScan | null = callee >= 0 && callee < bodies.length ? bodies[callee].scan : null;
        if (other === null || other.opaque) {
          scan.opaque = true;
          changed = true;
          break;
        }
        if (mergeStrings(scan.fields, other.fields) || mergeNumbers(scan.records, other.records)) {
          changed = true;
        }
      }
    }
  }
  for (const body of bodies) {
    const scan = body.scan;
    scan.calls = scan.inert;
    for (const callee of scan.callees) {
      if (callee >= 0 && callee < bodies.length && !bodies[callee].scan.opaque) {
        scan.calls = true;
      }
    }
  }
  let at = 0;
  for (const body of bodies) {
    if (!body.scan.opaque) {
      const summary = new CallSummary();
      summary.fields = body.scan.fields;
      summary.records = body.scan.records;
      tables.setSummary(at, summary);
    }
    at = at + 1;
  }
  return order;
};

/**
 * Every body's index, each callee before its callers wherever the calls form
 * no cycle: the order a depth-first search over `callees` finishes them in.
 */
const calleesFirst = (bodies: RangeBody[]): i32[] => {
  const order: i32[] = [];
  const seen: boolean[] = [];
  while (seen.length < bodies.length) {
    seen.push(false);
  }
  const stack: i32[] = [];
  const edge: i32[] = [];
  let root = 0;
  while (root < seen.length) {
    if (!seen[root]) {
      seen[root] = true;
      stack.push(root);
      edge.push(0);
    }
    while (stack.length > 0) {
      // `stack` and `edge` move in step: a body, and how many of its callees
      // have been looked at.
      const top = stack.length - 1;
      if (top < 0 || top >= edge.length) {
        break;
      }
      const current = stack[top];
      if (current < 0 || current >= bodies.length) {
        break;
      }
      const callees = bodies[current].scan.callees;
      const k = edge[top];
      if (k >= 0 && k < callees.length) {
        edge[top] = k + 1;
        const callee = callees[k];
        if (callee >= 0 && callee < seen.length && !seen[callee]) {
          seen[callee] = true;
          stack.push(callee);
          edge.push(0);
        }
      } else {
        order.push(current);
        stack.pop();
        edge.pop();
      }
    }
    root = root + 1;
  }
  return order;
};

/** What one body does by itself, and whom it calls. */
class StoreScan {
  /** What `scanStores` reads the body with: its context, the tables, and its program's callee table. */
  ctx: CheckContext;
  tables: RangeTables;
  known: i32[];
  /** The last callee `noteCall` looked up, and what the lookup answered. */
  lastCallee: FunctionSig | null;
  lastAt: i32;
  fields: string[];
  records: i32[];
  /** Indices into the summary table, each once. */
  callees: i32[];
  /** Every call of a function with a body here, in tree order, and that function's index, in step. */
  userCalls: Node[];
  userCallees: i32[];
  /** It may resize an array, or calls something that may: it has no summary. */
  opaque: boolean;
  /**
   * It calls something with a summary — a builtin handed nothing a store can
   * reach, or a function whose summary `summarise` settles — which is the only
   * thing a walk here knows that pass 2 did not, bar entry facts.
   */
  calls: boolean;
  /** It calls a builtin with the empty summary (`isInertBuiltin`). */
  inert: boolean;
  /** It calls a function that takes entry facts (`narrowCandidates`): only then does its walk find call sites. */
  callsCandidate: boolean;
  /** It has an access pass 2 left checked that some walk could prove (`isOpenAccess`): only then can a walk prove more. */
  open: boolean;
  /** It has any access pass 2 left checked, or any `substring` call: `open` as the reference rule reads it. */
  openAny: boolean;

  constructor(ctx: CheckContext, tables: RangeTables, known: i32[]) {
    this.ctx = ctx;
    this.tables = tables;
    this.known = known;
    this.lastCallee = null;
    this.lastAt = -1;
    this.opaque = false;
    this.fields = [];
    this.records = [];
    this.callees = [];
    this.userCalls = [];
    this.userCallees = [];
    this.calls = false;
    this.inert = false;
    this.callsCandidate = false;
    this.open = false;
    this.openAny = false;
  }
}

const scanStores = (node: Node, scan: StoreScan, inArrow: boolean): void => {
  const ctx = scan.ctx;
  const program = ctx.program;
  const kind = node.kind;
  if (kind === N_BINARY) {
    if (isBoundsAssignment(node.text)) {
      noteStore(program, ctx, node.children[0], scan);
    }
  } else if (kind === N_UNARY) {
    if (node.text === "++" || node.text === "--") {
      noteStore(program, ctx, node.children[0], scan);
    }
  } else if (kind === N_INDEX) {
    if (!program.nodeProvenIndex[node.id]) {
      scan.openAny = true;
      // An arrow's accesses are proved in its own lifted body, never in this one's walk.
      if (!scan.open && !inArrow && isOpenAccess(ctx, node)) {
        scan.open = true;
      }
    }
  } else if (kind === N_CALL) {
    if (isBoundedCall(node)) {
      scan.openAny = true;
      if (!scan.open && !inArrow && isOpenAccess(ctx, node)) {
        scan.open = true;
      }
    }
    if (!callsNothing(ctx, node)) {
      noteCall(node, scan);
    }
  } else if (kind === N_NEW) {
    noteCall(node, scan);
  }
  const arrow = inArrow || node.kind === N_ARROW;
  for (const child of node.children) {
    // Nothing a leaf is can store, call or be checked.
    if (child.children.length > 0) {
      scanStores(child, scan, arrow);
    }
  }
};

/** A call or a `new`: whom it calls, recorded in `known` as well, or what a builtin does. */
const noteCall = (node: Node, scan: StoreScan): void => {
  const program = scan.ctx.program;
  const known = scan.known;
  const callee = program.nodeCallees[node.id];
  // A body calls the same function over and over, and the name need only be
  // looked up once in a row.
  let at = -1;
  const last = scan.lastCallee;
  if (callee !== null && last !== null && callee === last) {
    at = scan.lastAt;
  } else if (callee !== null) {
    at = scan.tables.index.get(callee.name, -1);
    scan.lastCallee = callee;
    scan.lastAt = at;
  }
  if (at < 0) {
    if (callee !== null && node.id < known.length) {
      known[node.id] = NOT_HERE;
    }
    if (isInertBuiltin(program, node)) {
      scan.inert = true;
    } else {
      scan.opaque = true;
    }
    return;
  }
  if (node.id < known.length) {
    known[node.id] = at + 1;
  }
  if (node.kind === N_CALL) {
    scan.userCalls.push(node);
    scan.userCallees.push(at);
  }
  if (scan.callees.indexOf(at) < 0) {
    scan.callees.push(at);
  }
};

/** `s.charCodeAt(i)` or `s.substring(a, b)`: a call bounds.ts judges, whatever its receiver turns out to be. */
const isBoundedCall = (call: Node): boolean => {
  const callee = unwrapBoundsParens(call.children[0]);
  return callee.kind === N_MEMBER && (callee.text === "charCodeAt" || callee.text === "substring");
};

const noteStore = (program: CheckedProgram, ctx: CheckContext, target: Node, scan: StoreScan): void => {
  const t = unwrapBoundsParens(target);
  if (t.kind === N_MEMBER) {
    // Nothing assigns an array's `length` today; if anything ever does, it
    // resizes, and a summary is a promise that nothing does.
    if (t.text === "length") {
      scan.opaque = true;
    }
    if (scan.fields.indexOf(t.text) < 0) {
      scan.fields.push(t.text);
    }
  }
  if (t.kind === N_INDEX) {
    const stored = recordStoreType(program, ctx.table, t);
    if (stored !== NO_RECORD && scan.records.indexOf(stored) < 0) {
      scan.records.push(stored);
    }
  }
};

const mergeStrings = (into: string[], from: string[]): boolean => {
  let grew = false;
  for (const item of from) {
    if (into.indexOf(item) < 0) {
      into.push(item);
      grew = true;
    }
  }
  return grew;
};

const mergeNumbers = (into: i32[], from: i32[]): boolean => {
  let grew = false;
  for (const item of from) {
    if (into.indexOf(item) < 0) {
      into.push(item);
      grew = true;
    }
  }
  return grew;
};

// ---- The warnings the new proofs answer ---------------------------------------------

/**
 * Take back the WP15 §8 warning on every access this pass proved: pass 2
 * reported that the check survives, and it no longer does. The warning sits
 * on the index (`checkSurvivingBoundsCheck`), and is the only one there that
 * says an index is not proven.
 */
const retractWarnings = (ctx: CheckContext, proved: Node[]): void => {
  if (proved.length === 0) {
    return;
  }
  const sink = ctx.sink;
  const kept: Diagnostic[] = [];
  for (const warning of sink.warnings) {
    if (!answeredBy(ctx, warning, proved)) {
      kept.push(warning);
    }
  }
  sink.warnings = kept;
};

const answeredBy = (ctx: CheckContext, warning: Diagnostic, proved: Node[]): boolean => {
  if (warning.source !== ctx.program.source || warning.text.indexOf("is not proven to be in range") < 0) {
    return false;
  }
  for (const access of proved) {
    const index = access.kind === N_INDEX ? access.children[1] : access.children[1].children[0];
    if (warning.start === index.start && warning.end === index.end) {
      return true;
    }
  }
  return false;
};
