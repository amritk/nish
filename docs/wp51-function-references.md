# WP51: References to capture-free top-level functions — designed and measured

**Status: proposed, design only.** Nothing in the compiler, the runtime, `std/`
or the tests changes with this note; every program it measured lives in §12 and
was not committed. [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors are
at `350bad84`. Part of #1348.

Today a function is never a value in Nish. A function-typed *parameter* exists
([LANGUAGE.md](LANGUAGE.md#function-parameters),
[wp23-language-surface.md](wp23-language-surface.md) §6), but only for a
callee the checker can name at the call: each callee is its own instantiation
and the IR holds a direct call. A field, a local, an array element or a return
value of function type is refused. This note asks whether a narrow kind of
function value could be admitted without paying what
[wp28-compatibility-mode.md](wp28-compatibility-mode.md) §7.4 measured a
function value to cost (1.26x to 1.40x for the call, and 8.76x for the escape
proof it forfeits as wp28 recorded it; 1.85x at `350bad84`, §4), measures the
proposed lowering, and recommends one answer.

**The proposal.** The whole program is visible, so for each function signature
the set of top-level functions the program ever stores is closed and known at
compile time, and so is, for each call, the part of it that can reach the
call. A *reference* to a capture-free top-level function is a small
integer **tag** into that set. A call through a reference lowers to a `switch`
over the members that can reach it, with a direct call in each arm. That
`switch` is a function the checker generates and records, with its arms'
calls, before any whole-program pass reads the call graph (§2.4). The
attribute fixpoint, the escape analysis and the call-site ranges then see an
ordinary function with ordinary direct calls, so they take the **join of the
set's facts** instead of giving up; the one premise that needs the record to
hold is the call-site ranges' "no other caller can exist" (§6). Closures —
anything that captures — stay refused, and so does passing a reference across
the C boundary.

## 1. The decision

**Strict, with three stage-1 ship requirements: per-place sets, the
escape-join refusal and a dispatcher with no check in a speed build.**
References to capture-free top-level functions, lowered as a tag and a
`switch` over the members that can reach each call (§2.3), become part of the
strict language: a `docs/LANGUAGE.md` rule, and the negative tests that refuse
them today flip to positive. Closures, `Function` and references across the C
boundary stay refused.

- **What a reference cannot do to a program** (§4.4). A call through a
  reference compiles to the `switch` a program writes by hand today, or is
  refused. It cannot take an object's stack place from the members that keep
  it: a call whose set holds both a member that keeps an argument and one that
  does not is a compile error (§2.2), so case B's 6.4x to 9.1x and 1.5 GB
  (below) cannot be reached through a reference. A speed build's dispatcher
  carries no check, because every check timed cost up to 1.2x to 2.7x
  somewhere; a `--profile debug` build checks the tag and panics outside the
  set (§2.3). No variant leaks: peak memory is 13 MB at 1x, 10x and 100x the
  loop length, and valgrind finds 0 bytes lost, while case B grows from 17 MB
  to 1,528 MB with the loop.
- **What it still costs, as the hand `switch` does** (§3.5, §4.4). A call
  through a set of `K` members costs what a `switch` over `K` arms costs, which
  grows with `K`: 1.0x **direct** up to four on a periodic stream, 1.35x at
  eight, 4.6x at sixteen and 12.4x at thirty-two, and 2.5x to 5.6x on an
  aperiodic stream. A reference adds nothing to that, and that cost is not
  zero; a call whose set grows past eight members gets a `performance`
  warning naming the stores that widened it.

- **The call, by stream** (§3.5). On a **monomorphic** site an indirect call
  measured 0.99x to 1.24x the switch, most of it inside the 21% layout spread
  (§3), and the switch is within ±3% of a direct call for a set of one.
  On a **periodic mixed** stream it measured within ±3% of a direct call and
  3.7x to 4.7x faster than an indirect call for sets of up to four; at eight
  the switch becomes a jump table and costs 1.25x to 1.33x a direct call
  itself, still 3.1x to 3.3x faster than an indirect call (§3.2, §3.3). On an
  **aperiodic** stream the selection itself mispredicts: the switch costs 2.4x
  to 4.5x a direct call, as a hand-written `switch` does. Its edge over an
  indirect call there is 1.28x at K=2 and 1.21x at K=4, both past the band
  but not known to be past that group's own layout spread, which was not
  measured; K=8's 1.07x (3,976 against 3,732 ms, 6.5%) is at the band's
  edge (its copy pair differs by 6.3%), so it is read neither way (§3.4,
  §3.5).
- **The escape proof** survives the dispatched call when every member of the
  set keeps the object local (§4, case A). When one member does not, every
  call of the set loses it: 6.4x to 9.1x a direct call and 1.5 GB in the
  spike (case B). When the
  escaping member is in the program but not in the hot call's set, the hot
  call keeps it: case C, the program a per-place pass produces, keeps `P` an
  `alloca` and 12 MB at 1.40x to 2.02x a direct call. C is not shown to cost
  what A does: it is 0.95x to 1.37x A, past its run's band in three of six
  readings, for a reason not known (§4.3).
- **Why strict holds, with per-place sets.** A hand-written `switch` joins
  only its own arms; a dispatcher with one set per signature joins every
  member of that signature, so a program rewritten from a `switch` to
  references could get slower (case B, §4). Per-place sets (§2.3) give each
  local, parameter, field declaration, array or `Map` element type and
  function return its own set. The invariant that definition gives: **no
  program is slower than the same program written with `i32` tags, whose
  hand `switch` at each call covers every member stored into the same
  declaration or element type** — the switch a hand program storing tags in
  the same declarations must write. Case C measures that program. What the
  definition does not cover — two arrays of one element type, two objects of
  one class, a parameter's callers, flow — is listed in §10. The pass is
  unbuilt, so stage 1 does not ship without it and without case C's test
  (§9).
- **Why not wp28's compatibility mode.** By wp28's own rules (line numbers
  at `350bad84`) compat *could* hold references: rule 2 (:59-64) admits a
  construct whose layouts stay fixed, and a tag is an `i32`. The case for
  strict is rule 1's other half, that strict "does not grow" (:57-58), and
  it is answered the way wp28 answered C2a, function-typed parameters, which
  moved to "Built in strict" (`wp28-compatibility-mode.md:462`) because
  strict could take them at no cost. C2b is "a value whose target the
  checker cannot name" (:463), and its cost is what an unknown callee forfeits,
  with "how much of a real program is reachable from its closures" left as
  the measurement C2b takes before it ships (:533-535). A capture-free
  reference is a **third case**, neither C2a nor C2b: the checker cannot name
  its one target, but it names the closed set that can reach each call
  (`F(p)`, §2.3), so what is reachable from the call is computed, per call,
  as that set's members — the quantity wp28 asks to measure, given exactly
  instead of estimated — and its cost is that set's join, which A, B and C
  measure (§4.3). Against the program the invariant names (§2.3), the hand
  `switch` over the same declaration's tags, a reference adds nothing: the
  dispatcher is that `switch`, the same IR. Against a hand program that keeps
  tags in finer places than a declaration — one of two arrays of the same
  element type, one object of a class — a wider set costs more per call, as
  a wider hand `switch` does (§4.4), and a set past eight members is warned;
  a widening that would cost case B's 6.4x to 9.1x and 1.5 GB is refused
  (§2.2), naming the store. Placing it in
  compat would also carry practical costs: C0 (`--compat`) is unbuilt
  (:458), `src/` may never use a compat construct (:244) where §5.4 wants
  this one, and `--compat` implies `--number-mode f64` (:316). Against
  **Decline**, the case is expressiveness, not speed: a reference is no
  faster than the `switch` a program writes today, but it lets a handler
  live in a field, an array or a `Map`, so a table, a router or a test list
  is written as data (§8). Closures stay on wp28's list.

## 2. The rule

### 2.1 What is admitted

A **function reference** is a value of a function type `(p: P, ...) => R`
held anywhere a value can be held: a field, a local, an array element, a
`Map` value, a return value, or an argument to a function-typed parameter. Its
value is one of the program's **capture-free top-level functions** with exactly
that signature, named without calling it: `const h: (x: i32) => i32 = double;`.

| Construct | Today | Proposed |
| --- | --- | --- |
| `const h: (x: i32) => i32 = double;` | refused: a function type annotates only a parameter | admitted: `h` is a reference, an `i32` tag |
| `class Op { f: (a: i32, b: i32) => i32; }` | refused | admitted: the field is an `i32` tag |
| `const ops: ((x: i32) => i32)[] = [inc, dec];` | refused | admitted: an `i32[]` of tags |
| `return pick ? inc : dec;` with a function return type | refused | admitted |
| `h(3)`, `this.f(a, b)`, `ops[i]` called with `x` | — | a call through the reference: `switch` over the signature's set (§2.3) |
| `apply(h, 3)` where `apply` has a function-typed parameter | refused: `h` is not nameable | admitted: `apply` instantiates **once per set**, `$fn.ref.<set>`, its call through the parameter a `switch` |
| `apply(double, 3)` | admitted, a direct-call instantiation | unchanged |
| `h === double`, `h !== k` | refused | admitted: tag equality (§5.1) |
| `h: ((x: i32) => i32) \| null`, `h === null` | refused: `T \| null` takes a class, interface, array or string, never a scalar (`reject_nullable_scalar`) | admitted by a **new rule**, an exception to `reject_nullable_scalar` for function types only: tag `0` is `null` (§2.3), so zero-filled storage reads as `null` as it does for every other `U \| null` |
| `new Array<(x: i32) => i32>(n)`, module storage of a function type | — | refused, as for an enum with no zero member (NL2520; NL2687 in `src/module-storage.ts:306`): zero is no member's tag. Module storage refuses `\| null` already (NL2686), so it holds no reference at all. `new Array<((x: i32) => i32) \| null>(n)` is admitted. A field is covered by definite assignment (`LANGUAGE.md:2764`) |

### 2.2 What stays refused

| Construct | Why | Diagnostic (proposed wording) |
| --- | --- | --- |
| an arrow or nested function that captures a local, a parameter or `this` | a closure needs an environment, which is what wp28 §7.4's escape figure is about | `` this arrow captures `n`: a function reference names a top-level function and carries no environment `` |
| an arrow that captures nothing, written in value position | admitted only by lifting it to a top-level function with a generated name; deferred to stage 3 | `` an arrow in value position is not yet a function reference: declare it as a top-level function and name it `` |
| a method, `o.m` without a call, or a static method | a method has a receiver | `` `o.m` is a method: a function reference names a top-level function, and a method needs its receiver `` |
| a generic function, `id` or `id<i32>`, by reference | an instantiation is a different function natively and the same object under Node, so `===` would disagree (§5.1) | `` `id` is generic: a function reference names one non-generic top-level function `` |
| a function with a function-typed parameter, by reference | it is a template over its callees; the reference would be a function value by another name (`src/generics.ts:1740`) | `` `apply` takes a function parameter, so it has no single body to refer to `` |
| a function with a rest, default or optional parameter, by reference | a call through the reference cannot fill what the signature leaves out, and Node would gather or default differently; today a function with a rest parameter is never passed as a function value (`LANGUAGE.md:1708`–`1712`, `reject_param_rest_function_value`), and the rule extends to default and optional parameters | `` `f` has a rest parameter: a function reference names a function whose every parameter the caller passes `` |
| an `async` function, by reference | its call makes a promise, and a promise is not a value (wp24); a reference would be one by another route | `` `f` is async: a function reference cannot hold it, because its call is a promise `` |
| a `declare function`, by reference | a C function is in no set: the tag indexes this program's own functions | `` `f` is declared in C: a function reference names a function this program defines `` |
| a reference as `s.spawn`'s `entry` | `entry` is a function parameter (`LANGUAGE.md:4246`–`4250`): its task thunk is built per callee named at the call or per arrow lifted there (`tests/link/thread_task_arrow`; the old "task must be named" NL2391 is retired, `tests/wordings/unreachable.txt:67`). A reference would need a thunk over the dispatcher; stage 1 refuses it, a later stage may spawn the dispatcher. Async `spawn(f(x))` takes a direct call of an async function (NL2644), and an async function has no reference (above) | `` `h` is a function reference: `spawn` takes a top-level function or an arrow named at the call `` |
| a call through a reference whose set holds a member that keeps an argument and a member that does not (the **escape-join refusal**) | the dispatcher's facts are its arms' join, so one member that keeps `p` takes `p`'s stack place from every call through the set, the members that do not keep it included: case B's 6.4x to 9.1x and 1.5 GB, growing with the loop (§4.3, §4.4). A hand `switch` pays the same, but the member that causes it can be stored far from the call. The check reads each member's `escaping` set (`src/attributes.ts:755`) by parameter position once the attribute fixpoint is done, as the region rules read facts (`src/region-rules.ts:206`); a set whose members all keep the argument, or none does, is admitted, since a direct call of any member costs the same | `` this call through `h` can reach `u3`, which keeps `p`, and `u0`, which does not, so every call here would allocate `p` in the arena; `u3` reaches `h` through `k.f = u3` (main.ts:12): call `u3` directly, or store it where `h` does not read `` |
| a reference crossing an **external symbol**: an exported function of the program's own package called through the C ABI, a `wasm-host` import or export, a `declare function` parameter or return, or a signature `--emit-dts` writes | the tag means nothing outside the program, and a foreign caller could hand back a function the set does not hold. A Nish-module export, like `sortWith` (`std/sort.ts:162`) or `expose` (`std/secret.ts:77`), is not external: its callers are in the program | §5.2 |
| `` `${h}` ``, `console.log(h)`, `typeof h`, `h.name`, `h.length`, `h.call`, `JSON.stringify(h)` | Node prints the function's source or a `[Function: name]`; native has a tag | `` `h` is a function reference: it can be called, compared, stored and passed, nothing else `` |
| a reference read through a container: `ops.sort()`, `console.log(ops)`, `jsonEncode` of a class with a function-typed field | each would compare or print the element. `sort` without a comparator is refused already (NL2620), so is `console.log` of an array or an object (`LANGUAGE.md:7558`), and typed JSON's field whitelist (NL2485, `tests/wordings/nl2485_json_field_type`) names no function type; stage 1 keeps it so, with a negative test. `ops.indexOf(h)` and `ops.includes(h)` compare by `===` and agree (§5.1) | the existing diagnostics |
| `<`, `>`, arithmetic, or a `Map` key | a tag's number is not part of the language | the same |
| `Function`, `Function.prototype.bind`, `new Function` | Tier 3 of wp28 §2.2 | unchanged (`reject_function_type`) |

### 2.3 The lowering

For each signature `S` the checker collects the **set** `F(S)`: every
top-level function of signature `S` that appears anywhere in value position.
It numbers the set in declaration order (module order, then source order), so
the numbering is stable across builds and independent of call sites. A
reference of type `S` is an `i32` tag in `[1, |F(S)|]`; **tag `0` is `null`**
for `S | null`, so a zero-filled `(S) | null` element or field reads as
`null`, as every other `U | null` does (`LANGUAGE.md:6938`–`6942`). A
non-nullable reference can never hold `0`: zero-filled storage of a
non-nullable function type is refused (§2.1), a field is definitely assigned
before it is read, and a call through `S | null` needs `h !== null` first.

**The set a call dispatches over is the call's, not the signature's.** A
**place** is a declaration a reference can be stored into, and each place
gets one set. Stage 1's places are, exactly:

| Place | One set per | So these share a set |
| --- | --- | --- |
| a local or a parameter | declaration (a generic body's, once for every instantiation) | every caller's argument for one parameter |
| a field | class field declaration | every object of the class, and of every subclass that inherits the field |
| an array element | element type `S[]`; `(S \| null)[]` shares `S[]`'s set | every array of that element type in the program |
| a `Map` value | value type, the same set as the arrays of that type (stage 2 shipped it so: `m.get(k)` reads it, `m.set` stores through the map's own value array) | every `Map` and every array with that value type |
| a return | function declaration | every call of that function |

Per allocation — one set for each `new Array`, each literal, each object —
is not a place: telling two arrays of one element type apart needs a
points-to analysis, which stage 1 does not build. The pass is
flow-insensitive and per place, and iterates to a fixpoint over two rules.

*Every expression of a function type has a value set.* A name `f` gives
`{f}`; a read of place `p` (a local, a parameter, `o.h`, `a[i]`, `m.get(k)`)
gives `F(p)`; a call gives its callee's return place's set; `c ? x : y` and
`x ?? y` give the union of their arms; `null` gives `{}`. An expression of
any other form gives `F(S)`.

*Every store context adds that set to its target place.* `docs/LANGUAGE.md`
has no single list of assignment contexts, so stage 1's list is this one,
checked against the checker's own assignability call sites when the pass is
written:

| Store context | Target place |
| --- | --- |
| `a = e`, a declaration initializer, a compound `??=` | the local's or parameter's |
| `o.h = e`, a field initializer, a constructor argument stored to a field | the field declaration's, through the constructor parameter's |
| `a[i] = e`, `a.push(e)`, `a.unshift(e)`, `a.fill(e)`, `a.splice(i, n, e…)`, an array literal `[e, …]` | the element type's |
| `m.set(k, e)` | the element type's (a `Map`'s values are an array of it) |
| `for (const h of a)` | the loop variable's, from the element type's |
| an argument for parameter `a` | the parameter's |
| `return e`, a concise arrow body | the function's return place |
| a field of an interface type | the union of the field declarations of every class that implements it, both ways |
| a field of a generic class | the declaration's, shared by every instantiation |

**Any store the pass does not model** — a form missing from this table, or
an expression it cannot give a set — adds `F(S)` to its target. That keeps
the pass sound, never precise: a forgotten form widens one place to the
signature's set, which costs at most case B's join and never a wrong call.
What stage 1 tests for it is in §9 (`fnref_place_set`, and a negative-shaped
test per row above that would dispatch to a missing member if the row were
dropped). A call through
a reference read from place `p` dispatches over `p`'s set,
`F(p) ⊆ F(S)`. The tags stay numbered per signature, so `===`, stores and
loads need no translation; only the dispatcher's arms narrow. Calls whose
sets are equal share one dispatcher.

**The invariant, from that definition.** A hand program with no references
stores an `i32` tag in the same declarations and writes a `switch` at each
call. Its `switch` must cover every tag that can be in the declaration it
reads: without reasoning about paths or about which object or array it
holds, that is every tag stored into the declaration, or into any
declaration that flows into it — exactly `F(p)`. So: **no program is slower
than the same program written with `i32` tags, whose hand `switch` at each
call covers every member stored into the same declaration or element type.**
Case C (§4) is that program for §4's three-way site, measured. What the
definition puts in one set that a hand program could keep apart is §10's
list; none of it is slower than the hand program the invariant names, only
than a hand program that reasons further.

The compiler then generates one **dispatcher** per distinct set, an internal
function written as the program could have written it:

```ts
// F(p) = { t0, t1, t2, t3 }, tags 1..4
function $ref.S.p(tag: i32, x: i32, acc: i32): i32 {
  switch (tag) {
    case 1: return t0(x, acc);
    case 2: return t1(x, acc);
    case 3: return t2(x, acc);
    default: return t3(x, acc);
  }
}
```

and every call through a reference read from `p` becomes a direct call of
its dispatcher. The last arm is `default` because no other tag can reach
the call: a non-null tag is made only by naming a member, `0` is ruled out
above, and the set pass put every member that can flow to `p` in `F(p)`. A
set of one has no `switch` at all; the tag is never read and the dispatcher
is a direct call. **A speed or size build checks nothing more; a
`--profile debug` build checks the tag.** There, the dispatcher starts with
`if (tag < 1 || tag > |F(p)|) panic(...)`, and a set of one with
`tag !== 1`, so a store form the pass failed to model fails loudly in every
`nish run` (whose default profile is `debug`, `src/compile.ts:636`) and in
every `tests/cases/fnref_*` program, which stage 1 runs in both profiles.
The profile reaches the emitter as `-g` does (`src/compile.ts:891`). Every
check timed in a speed build cost up to 1.2x to 2.7x somewhere (§4.4): a
dispatcher that can panic is no longer `willreturn readonly` to LLVM. **An empty set** — an `S | null` place that only `null`
was ever stored into — has no member and no dispatcher: every call through
it sits behind an `h !== null` that no value of the place passes, so the
call lowers to a trap (an `unreachable` terminator after `llvm.trap`), and
`fnref_place_set` pins it with a variant whose field is never assigned. Whether the last arm instead traps (`default:
unreachable`-equivalent, with every member a `case`) was **timed and
decided** (§4.4): it cost 1.2x to 2.7x the `default` arm, and a range check
ahead of the `switch` up to 1.23x, so the speed build keeps the `default`
arm, the debug build checks, and soundness rests on the `F(S)` fallback
above, its tests, and the debug build's check.

**How a dispatcher's arguments line up.** The tag is the dispatcher's
parameter `0`, and the call's argument `i` is its parameter `i + 1`, which
every arm passes on unchanged as the member's parameter `i`. The call-site
ranges (`src/ranges.ts:355`, `takesEntryFacts`) therefore see two hops: each
call through `p` is one site of the dispatcher, whose parameter `i + 1`
enters with the join of argument `i` over those sites; each arm is one site
of its member, whose parameter `i` enters with that join. The tag joins only
with the tag, never with a member's argument, and a member reached from
several dispatchers or also called directly joins all of those sites, as any
function with several callers does.

**Which module owns a dispatcher.** `src/` emits one `.ll` per module
(`ARCHITECTURE.md:32`, `:42`), and a function that is not exported is `define
internal` (`src/emit.ts:623-636`), so a dispatcher in one module cannot call
a member that is `internal` in another. The design: a dispatcher is emitted
in each module that holds a call through `p`, as an `internal` copy (the
`src/emit-map.ts` pattern for library copies, `src/emit.ts:390`), and a
member stored into a place read from another module is marked `hidden`, as
WP29 marks a function another module's instantiation calls
(`src/emit.ts:625-633`). **It keeps its call-site entry facts.**
`takesEntryFacts` refuses a `hidden` signature (`!sig.hidden`) because a
`hidden` function is called from another module's *instantiation*, whose
body the ranges walk does not reach with a state (`src/ranges.ts:33`;
`forceCalls`, `src/ranges.ts:424`). A dispatcher is not an instantiation:
it is an ordinary checked function, walked in `proveCallSiteRanges`' one
loop over every module's contexts (`src/ranges.ts:387`), so its arm calls
are sites like any other. Stage 1 therefore marks a member that crosses a
module for `hidden` linkage only, with a separate flag that `takesEntryFacts`
does not read; a member that an instantiation also calls is still forced to
no entry facts by `forceCalls`'s scan, as today. A cross-module reference
then costs what a one-module one does, by construction; stage 1's
`tests/link/fnref_cross_module` pins it (the member's entry facts in its
`.ll`).

The spike (§3, §4, §12) numbered its tags from `0` and had no `null`, so its
`switch` cases are `0` to `K - 2`. Numbering from `1` changes only the case
constants, or, for a jump table, subtracts `1` from the index; nothing it
measured depends on which.

That is the whole design. The dispatcher is generated, but it is generated
by the checker as a function of the program, with its arms' calls recorded
like any body's (§2.4), so to every pass after the checker it is an ordinary
function with ordinary direct calls. That is the sense in which **no
analysis needs a new case for "a call through a reference"**: each already
handles a call to a known function, and the dispatcher's facts are the join
of its arms' by the rule they already apply to any function with several
call sites in its body. It holds only if the record is complete before the
first pass reads it; a member called from a dispatcher the call graph does
not show would be a caller no analysis saw, and the call-site ranges would
enter that member with facts its real callers do not meet (§6,
`ARCHITECTURE.md:393`). A hand-written `switch` is the same join over its
own arms, and with per-place sets the dispatcher joins no more than the arms
the invariant above names — the property strict rests on (§8). §6 lists
every place that leaned on "no function values" and what that join does to
each.

### 2.4 How the set is known in time

Pass 2 of the checker runs "now that every callee in the program is known"
(`src/checker.ts:959`, `src/declarations.ts:445`). The set must be known as
early, because a body checked before a later module names a member would
otherwise see too small a dispatcher. A function is in a set exactly when its
name appears in a value position — not the callee of a call and not an
argument to a function-typed parameter — which is syntactic: pass 1 can collect
it while it binds declarations, before any body is checked. The sets are
therefore closed before pass 2, and nothing downstream sees a partial set.

The per-place sets need the checked bodies (which field `this.f = g` stores
into is a type question), so they are computed once pass 2 has checked every
body, and before anything reads a call's callees: the call-site ranges
(`src/ranges.ts`, which reads `program.nodeCallees`, :1019), the attribute
fixpoint, the region rules, the portability records and the emitter. Each
reference call is recorded in `nodeCallees` as a call of its dispatcher, and
the dispatcher itself is a checked function whose arm calls are recorded the
same way, so every one of those passes sees an ordinary direct call (§6, the
wp49 row). If stage 1 instead emitted the dispatcher only in the emitter, the
members would have callers `src/ranges.ts` never saw, and
`takesEntryFacts` (`src/ranges.ts:355`–`360`) would have to refuse every set
member; either is sound, the first keeps the members' entry facts, and §6's
`ARCHITECTURE.md:393` row holds stage 1 to one of them.

## 3. The measurements

Every figure in this section is best of seven, with every variant run once per
round in order (interleaved), on the machine below. Each program prints a
checksum folded from every call's result. Every **same** variant of a group
prints its **direct** row's number, and each **mixed** switch prints its
indirect twin's; the mixed streams differ by `K`, so their checksums differ
from **direct**'s and from each other (each table lists them). No row timed a
loop the optimiser removed.

- **Machine.** `nproc` 4, `Intel(R) Xeon(R) Processor @ 2.30GHz`, 15 GB, a
  cloud container otherwise idle while timing.
- **Build.** `build/nish` at `350bad84` (built from the 0.34.1 seed), then
  `scripts/build.sh <x>.ll runtime/runtime.c [wp51_fns.c] -o <x> --profile
  speed` (`-O3 -flto`).
- **Noise band.** Each group's baseline, timed against a byte-identical copy
  of its binary in the same interleaved rounds (`.claude/testing.md` → "A
  `Measured:` trailer"): serial 411 / 408 ms (0.7%), array 446 / 446 ms (0%),
  escape 113 / 116 ms (2.7%), so the band is **±3%**, the largest of the
  three; the aperiodic group's pair is 826 / 777 ms (6.3%), so its band is
  **±6%**. Each band rests on that one copy pair. A delta inside the band is
  reported as none.
- **What the band does not cover.** It is run-to-run noise of one binary. It
  says nothing about code layout and predictor aliasing between binaries: the
  indirect **same** binaries have the same hot loop at every `K` (§12.7 shows
  serial `K = 2`, `4` and `8`, and array `K = 2`, `4` and `8`, so both ends of
each group's spread; with addresses stripped, the
  eight instructions either side of every `call *` in `objdump -d` differ
  between `K = 1, 2, 4, 8` only in the addresses of string constants), yet spread from 427 to 516 ms (serial) and 435 to 525 ms
  (array), up to 21%. A difference of that size between two *binaries* is not
  evidence on its own. That spread was measured on the serial and array
  groups only; the aperiodic group has no such pair, so its own spread is
  unknown (§3.5 reads `K = 2`'s 1.28x there with that caveat).

### 3.1 The instruments

The program is wp28 §11a's serial hash chain and §11d's array loop, with eight
callees in place of one, so a set can have 1, 2, 4 or 8 members (§12.1).

- **direct** — §11a as wp28 ran it: the loop calls `t0` by name.
- **switch** — the proposed lowering, written by hand in Nish exactly as §2.3
  would generate it, so the IR is the compiler's own: a `call(tag, x, acc)`
  whose body is a `switch` over `t0..t{K-1}`. The loop reads the tag from a
  1,024-element `i32[]` per call, as a call through an array of references
  would.
- **indirect** — the same `.ll` with `@call`'s body hand-edited to load a
  function pointer from a table and call it (§12.3): the table is a global the
  `.ll` defines and a C constructor fills from `getenv`, so it is not
  constant and nothing can fold it. That is the position a function value
  with no closed set is in, and the instrument of wp28 §11c. Its attributes drop to `nounwind`, as an opaque callee's would.

Each set size is run with two tag streams, built once at start-up from
`process.argv.length`, so the optimiser cannot know them:

- **same** — every tag is the same member: a monomorphic site, perfectly
  predicted.
- **mixed** — tags drawn by xorshift over the whole set: a polymorphic site.
  The 1,024 tags repeat in the same order every 1,024 calls, which a branch
  predictor can learn (§3.5). §3.4 runs a stream with no period.

`K = 1` has one member, so it runs **same** only. Every indirect file is its
switch file with §12.3's hand-edit applied; §12.3 shows the diff for `K = 4`.
The table always has eight entries: the first `K` are the members and the rest
are `null` (§12.3), so the sizes differ only in how many entries are
non-null.

Two adaptations of wp28's programs, both forced by the language as it is at
`350bad84`, so none of the figures below compares directly with wp28's:

1. §11a's `x * 1103515245` and `+ 1` now panic on `i32` overflow; the spike
   uses `wrappingMul` and `wrappingAdd` from `nish:unsafe`, which are what the
   original's `.ll` computed.
2. The switch and indirect rows read one tag per call; **direct** builds the
   same tag array (§12.1) and never reads it. The `K = 1` row does **not**
   isolate that read: its dispatcher never reads the tag, so after `opt -O3`
   the load is dead. `serial_k1_same` and `serial_direct` disassemble to
   byte-identical output; `array_k1_same` has `array_direct`'s inner loop plus
   one length check hoisted before it (§12.7 shows both). No row times the element read alone.

### 3.2 Dispatch, serial (§11a's shape, 400M calls)

Baseline **direct** 411 ms (copy 408 ms). Ratios are against **direct**;
the last column is how much the switch saves over a true indirect call.

| K | stream | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | same | 416 | 1.01x | 437 | 1.06x | 1.05x |
| 2 | same | 415 | 1.01x | 516 | 1.26x | 1.24x |
| 2 | mixed | 413 | 1.00x | 1,944 | 4.73x | 4.71x |
| 4 | same | 411 | 1.00x | 427 | 1.04x | 1.04x |
| 4 | mixed | 404 | 0.98x | 1,572 | 3.82x | 3.89x |
| 8 | same | 421 | 1.02x | 515 | 1.25x | 1.22x |
| 8 | mixed | 548 | 1.33x | 1,808 | 4.40x | 3.30x |

Checksums: every **same** row and **direct** print `631536064`; each
**mixed** switch row prints the same number as its indirect row (`966901674`,
`16372346`, `1904994139`). Maximum RSS 12 MB everywhere.

### 3.3 Dispatch, array (§11d's shape, 1,024 elements × 400k rounds)

Baseline **direct** 446 ms (copy 446 ms).

| K | stream | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | same | 436 | 0.98x | 448 | 1.00x | 1.03x |
| 2 | same | 438 | 0.98x | 435 | 0.98x | 0.99x |
| 2 | mixed | 444 | 1.00x | 1,816 | 4.07x | 4.09x |
| 4 | same | 434 | 0.97x | 522 | 1.17x | 1.20x |
| 4 | mixed | 437 | 0.98x | 1,602 | 3.59x | 3.67x |
| 8 | same | 437 | 0.98x | 525 | 1.18x | 1.20x |
| 8 | mixed | 556 | 1.25x | 1,721 | 3.86x | 3.10x |

Checksums: every **same** row and **direct** print `93400201`; mixed pairs
print `738435298`, `71504611`, `829684326`. Maximum RSS 12 MB everywhere.

### 3.4 Dispatch, aperiodic stream (400M calls)

The **mixed** streams above repeat every 1,024 calls. This group draws each
call's tag from `(s >>> 24) & (K - 1)`, the low bits of the top byte of a
xorshift32 state `s` advanced in the loop
(period 2^32 − 1), so there is no pattern short enough to learn (§12.1).
Every variant, **direct** included, advances the same state and passes it as
`x`, so **direct** here is slower than §3.2's and is this group's own
baseline: 826 ms (copy 777 ms, band ±6%).

| K | switch ms | switch / direct | indirect ms | indirect / direct | indirect / switch |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 1,968 | 2.38x | 2,519 | 3.05x | 1.28x |
| 4 | 2,889 | 3.50x | 3,504 | 4.24x | 1.21x |
| 8 | 3,732 | 4.52x | 3,976 | 4.81x | 1.07x |

Checksums: **direct** and its copy print `662644096`; each switch row prints
the same number as its indirect row (`1127541019`, `314685327`,
`1853447471`). Maximum RSS 12 MB everywhere.

### 3.5 What the dispatch numbers say

The three streams answer differently, so each is read on its own.

- **Monomorphic (every *same* row).** The switch is within ±3% of **direct**
  at every `K`. The indirect call is 0.99x to 1.24x the switch, and the
  indirect **same** rows run the same instructions per call at every `K`, so
  that spread is mostly the 21% layout spread of §3, not the call: on a
  monomorphic site the switch's advantage is **not shown** beyond it.
- **Periodic mixed, `K ≤ 4`.** The switch is within ±3% of **direct**, and
  the indirect call is **3.7x to 4.7x** the switch. `opt -O3` inlines `@call`
  and every member into the loop, leaving one `switch` on the loaded tag whose
  arms are the members' four instructions (`mul`, `xor`, `ashr`, `xor`) and one
  `add` after they join (§12.2). `llc` lowers that `switch` to a chain of
  conditional branches — one compare at `K = 2`, three at `K = 4` (§12.7) — and
  the indirect variant keeps a `call *` per iteration through `-flto` (§12.7).
- **Periodic mixed, `K = 8`.** The switch costs 1.25x to 1.33x **direct** and
  the indirect call is **3.1x to 3.3x** the switch. At `K = 8` the `switch`
  has seven cases, past `llc`'s default minimum of four for a jump table
  (`-min-jump-table-entries`), and it becomes
  `notrack jmpq *.LJTI0_0(,%r15,8)` (§12.2): an indirect branch. The first
  jump table is expected at five members (four cases and `default`); only
  eight was measured.
- **Why the indirect call costs 3.1x to 4.7x on a periodic stream — cause
  unknown.** No performance counter was read (§7). The indirect **same** rows,
  where the call keeps the full calling convention and the callee's
  attributes are `nounwind` only, are 0.98x to 1.26x of **direct**, so the
  call alone does not explain the mixed rows. The obvious cause, an
  indirect-target predictor that does not learn the 1,024-call period, is
  ruled out by the `K = 8` switch rows: in the linked binaries the hot loop
  of `serial_k8_mixed` runs `notrack jmp *%r12` once a call, and those of
  `array_k8_mixed` and `rand_k8_mixed` run `notrack jmp *%r10` and
  `notrack jmp *%rdx` (§12.7, from `objdump -d` of the executables, not
  `llc`'s output) — an indirect branch on the same period-1,024 stream — and
  the serial and array rows cost only 1.25x to 1.33x **direct**, so an
  indirect branch on this stream is learned. Not
  distinguished, with no counters to tell them apart: the `call`/`ret` pair
  and its calling convention against code inlined into the loop; the callee
  that stays out of line, with its own prologue and the attributes the loop
  can no longer use; and how the return-stack and branch-target buffers treat
  a `call *` against a `jmp *`. Nor is the order explained: mixed indirect at
  `K = 2` (1,944 ms serial, 1,816 ms array) is slower than at `K = 4`
  (1,572 ms, 1,602 ms), which no cause above predicts.
- **Aperiodic.** The switch costs 2.38x to 4.52x **direct**, because which
  arm runs is decided by data no predictor can learn: the arms stay branches,
  one `test` and `jne` at `K = 2`, the three-compare chain at `K = 4`, a jump
  table at `K = 8`, with no `select` and no `cmov` in the loop (§12.7). A
  hand-written `switch` or `if` chain over the same tags is the same code and
  pays the same. Against the indirect call, `K = 2`'s 1.28x and `K = 4`'s
  1.21x (3,504 ms against 2,889 ms; a compare chain at `K = 4`, not an
  indirect branch) are both past the band (±6%), but this group's own layout
  spread was not measured (§3), so neither is known to be past that. `K = 8`'s
  1.07x (6.5%), a jump table against a `call *`, is at the edge of the band
  (the copy pair's 6.3%): it is read as neither a difference nor none.
- **So the switch's large advantage is a periodic-stream result.** "3.1x to
  4.7x faster than an indirect call" holds where the tags follow a short
  pattern. On a monomorphic site it is not shown past the layout spread; where
  the tags are decided by input it is 28% at `K = 2` and 21% at `K = 4`,
  neither known to be past that group's layout spread, and none at `K = 8`.
  What holds in every stream is that the dispatcher is the `switch` a program
  writes by hand today, so at the call a reference costs what today's code
  costs. §4 is where that stops being true.
- **Why the same switch is about 1.0x here and 1.3x to 1.6x in §4.3** — read
  from the instructions (§12.7), not from counters (§7). Here each call's
  `xor`, `sar`, `xor` and `inc` form a chain of dependent instructions the
  next call waits on, and the tag load and the compare that picks the arm
  depend only on the loop counter, so they can run beside that chain. §4's
  **direct** loop is much shorter: `opt -O3` folds `u0`'s constants and
  unrolls it five times, about four instructions a call (§12.7). A adds about
  nine a call to that — the load, the compare, two `cmov`, an `imul` — so the
  added work is most of the loop instead of a small part of it, and costs
  1.3x to 1.6x. That is the hand `switch`'s cost too, since A *is* that
  `switch`; it is the price of a callee picked by data against one known at
  compile time, not of references.

## 4. The escape proof through a dispatched call

wp28 §7.4 found that the call's own cost is the small half: the escape analysis
was worth 8.76x there, and a callee the analysis cannot see forfeits it. That
figure does not reproduce at `350bad84`: §11e's shape, adapted (§4.1), with
and without `--no-stack-alloc` measured 1.66x to 2.19x here, across four
runs (§4.3). The likely cause is
that `--no-stack-alloc` now rewinds the arena offset every iteration (§12.5
shows the save and the rewind); no build without the rewind was timed, so
that is not shown. That ratio is this note's reference for the lost proof.
The question for a reference is whether the dispatcher keeps the proof when
every member keeps the object local, what it costs when one member does not,
and what it costs when that member is in the program but not at the hot site.

### 4.1 The programs

§11e's `P`, made once per iteration in `run`, is passed through a dispatched
call over four members `u0..u3`, each `(p: P, k: Keep): i32` (§12.4). `Keep` is
one object made in `main` and passed down, so a member has somewhere to put
`p` if it wants to.

- **A — every member local.** `u0..u3` read `p.x` and `p.y` and return.
- **B — one member escapes.** `u3` also stores `k.last = p`.
- **C — the program a per-place pass produces.** B's members, but the hot
  site dispatches over `{u0, u1, u2}` only (`u0` for tag `0`, `u1` for `1`,
  `u2` otherwise), and `u3` is called once, by name, after the loop:
  `const e = u3(new P(r, 1), k)`. That is what §2.3's sets give when the hot
  site's place never holds `u3` and another place does, and what a program
  writes by hand today. `genc.mjs` derives it from B's sources (§12.4).

Each is run with the **same** stream (every tag `0`, so the escaping arm of B
is never taken and the row isolates the lost proof from the store) and the
**mixed** one. The baselines are §11e adapted: where wp28's loop calls
`use(p)`, whose body is `(p.x * 3) ^ (p.y + 1)`, **direct** calls `u0(p, k)`,
the same body with `wrappingMul` and `wrappingAdd` (§3.1's overflow
adaptation) and a `Keep` parameter, so it has the members' signature (§12.4).
It is compiled as is and with `--no-stack-alloc` — wp28's instrument for "the
object is not provable". C's **mixed** stream is `((s ^ base) & 0x7fffffff) % 3`,
three tags, not A's and B's four, so its checksum and stream are its own.

### 4.2 The fact table

Exactly as the compiler emitted them (`build/nish`, no flags), with
`"probe-stack"` elided; §12.5 shows each signature and each `alloca` and
allocation call the last two columns name:

| Program | members `u0..u2` | member `u3` | `dispatch` | `run` | `P` in `run` | `Keep` in `nish_main` |
| --- | --- | --- | --- | --- | --- | --- |
| direct | `u0`: `nounwind willreturn readonly`; `p`, `k` `readonly nocapture` | — | — | `nounwind willreturn`; `k` `readonly nocapture` | `%P.obj = alloca %struct.P` | `%Keep.obj = alloca` |
| direct, `--no-stack-alloc` | as direct | — | — | as direct | `nish_alloc_struct(i64 8)` per iteration, the arena offset saved before it and rewound after (`nish_arena_release` if the arena grew), §12.5 | arena |
| **A** (every member local) | `nounwind willreturn readonly`; `p`, `k` `readonly nocapture` | the same | **the same: `nounwind willreturn readonly`; `p`, `k` `readonly nocapture`** | `nounwind`; `k` `readonly nocapture` | **`%P.obj = alloca %struct.P`** | `%Keep.obj = alloca` |
| **B** (`u3` stores `p`) | the same as A | `nounwind willreturn`; **`p` neither `readonly` nor `nocapture`**; `k` `nocapture` | **`nounwind willreturn`; `p` neither `readonly` nor `nocapture`** | `nounwind`; `k` `nocapture`, not `readonly` | **`nish_alloc_struct(i64 8)` per iteration, no per-iteration release: every `P` lives until `nish_main` releases the arena** | `%Keep.obj = alloca` |
| **C** (`u3` escapes, called after the loop) | the same as A | the same as B | **as A: `nounwind willreturn readonly`; `p`, `k` `readonly nocapture`** | `nounwind`; `k` `readonly nocapture` | **`%P.obj = alloca %struct.P`** | `%Keep.obj = alloca`; the one `P` passed to `u3` is `nish_alloc_struct(i64 8)`, once |

`run` in A and B is `nounwind` without `willreturn` because it reads the tag
array, whose bounds check can panic; **direct** reads no array. The rows are
the same for the **same** and **mixed** builds: the facts are a property of the
set, not of the stream.

The dispatcher's facts in A are its members' facts, and in B they are `u3`'s:
**the join**, by the attribute pass as it is today, with no change. In A the
stack proof survives the dispatched call; in B it is lost for every call of
`dispatch`, including the ones whose tag is `0`. In C `u3`'s facts are B's,
and the dispatcher, which does not call it, has A's: the escape stays at the
site that calls `u3`.

### 4.3 What it costs

Four runs of `bench.py`, every row the best of its rounds, interleaved
(§12.6): run 0 of 7 rounds, before C existed, on the Intel Xeon @ 2.30GHz of
§3; runs 1 (7 rounds) and 2 (11 rounds), with C added, on a later container
whose CPU model was not recorded; run 3 (11 rounds) on a third container, an
Intel Xeon @ 2.10GHz with 4 cores and 15 GB.

| Program | stream | run 0 ms | / direct | run 1 ms | / direct | run 2 ms | / direct | run 3 ms | / direct | max RSS | checksum |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| direct | — | 113 | 1.00x | 139 | 1.00x | 126 | 1.00x | 115 | 1.00x | 12 MB | `208457217` |
| direct (copy) | — | 116 | 1.03x | 135 | 0.97x | 133 | 1.06x | 133 | 1.16x | 12 MB | `208457217` |
| direct, `--no-stack-alloc` | — | 209 | 1.85x | 231 | 1.66x | 249 | 1.98x | 252 | 2.19x | 12 MB | `208457217` |
| A, every member local | same | 168 | 1.49x | 180 | 1.29x | 187 | 1.48x | 184 | 1.60x | 12 MB | `208457217` |
| A, every member local | mixed | 166 | 1.47x | 199 | 1.43x | 206 | 1.63x | 169 | 1.47x | 12 MB | `230433138` |
| B, `u3` escapes | same | 792 | 7.01x | 1,062 | 7.64x | 1,129 | 8.96x | 1,045 | 9.09x | **1,527 MB** | `208457217` |
| B, `u3` escapes | mixed | 726 | 6.42x | 948 | 6.82x | 920 | 7.30x | 874 | 7.60x | **1,527 MB** | `230433138` |
| **C**, `u3` escapes after the loop | same | — | — | 196 | 1.41x | 177 | 1.40x | 205 | 1.78x | 12 MB | `208457217 1876114956` |
| **C**, `u3` escapes after the loop | mixed | — | — | 205 | 1.47x | 225 | 1.79x | 232 | 2.02x | 12 MB | `188232515 1694092638` |

The copy rows put the within-run band at 3%, 3%, 6% and 16% in runs 0 to 3:
the band is the run's own, and run 3's is wide. The runs disagree by more
than that: A **same** is 1.49x, 1.29x, 1.48x and 1.60x **direct**, so a
difference under about 25% between runs is not read. C prints a second
number, `u3`'s result on the one `P` after the loop.

- **A keeps the proof.** `P` stays an `alloca` and SROA dissolves it; after
  `opt -O3` neither A nor **direct** has an allocation in the loop (§12.5).
  A's 1.29x to 1.63x over **direct** is not the proof, since the facts are
  identical, but the rest of the loop (§12.7). **direct**'s callee is a
  constant: `opt -O3` folds `u0`'s constants and unrolls the loop five
  times, about four instructions a call (`lea`, `inc`, `xor`, `add`). A's
  loop loads `ts[i & 1023]`, compares it, and picks the arm's two constants
  with two `cmovae`, then `imul`, `add` and `xor`: about thirteen
  instructions a call, unrolled twice. How that splits between the load and
  the select was not measured (§7). §3.5 says why the same switch costs
  about 1.0x in §3's loops and this much here.
- **A's same and mixed loops are the same instructions** (§12.7): the
  `cmov` does not branch on the tag, so the stream cannot change the loop.
  Their differences are 1% in run 0 (band 3%) and 9% in run 3 (band 16%),
  inside those runs' bands. In runs 1 and 2 they are 11% and 10% (180
  against 199 ms, 187 against 206 ms), outside those runs' 3% and 6% bands,
  and **unexplained**: the loops are the same instructions, so the stream is
  not the cause the code allows, and no counter was read to find another.
- **B loses it, and the loss is not the stream's.** With every tag `0` the
  escaping arm never runs, yet B is 7.0x to 9.1x **direct** and holds 1.5 GB.
  `dispatch` may capture `p`, so `P` is an escaping allocation in the loop
  body; it goes to the arena, and `decidePass` (`src/escape.ts:2396`–`2420`)
  refuses the loop its per-iteration mark and release for that reason. B's
  `run` has no `nish_arena_mark` (§12.5), so every `P` of the 200M
  iterations lives until `nish_main` releases the arena. `--no-stack-alloc`
  allocates as often but keeps the release, because in **direct** nothing
  in the loop escapes, so it holds 12 MB and costs 1.7x to 2.2x.
- **B same is slower than B mixed in all four runs** (9%, 12%, 23% and
  20%).
  Both take the same arena path for every iteration; the mixed stream runs
  `u3`'s store about a quarter of the time and the same stream never does.
  Why the run that stores less is slower is **not known**; no counter was
  read.
- **The join is the hot site's members, not the signature's.** A program
  that calls `u3` at the hot site pays B's cost, correctly, because `u3` does
  keep `p`. A per-*signature* dispatcher would make every site of that
  signature pay it, a program slower than it can be written today; that is
  why §2.3 makes the set per place. C is the program that per-place sets
  produce when the hot site's place holds `u0..u2` and `u3` is called
  elsewhere: its `dispatch` has A's facts, `P` in `run` is an `alloca`, the
  loop has no allocation (§12.7), and it holds 12 MB. Against B, the program
  a per-signature set produces, C costs 1.40x to 2.02x **direct** where B
  costs 6.4x to 9.1x and holds 1.5 GB. `u3`'s one `P`, after the loop, is in
  the arena once.
- **What C is not shown to be: A's cost.** C over A, by run, is 1.09x and
  1.03x (run 1, band 3%), 0.95x and 1.09x (run 2, band 6%), 1.11x and 1.37x
  (run 3, band 16%), **same** and **mixed**: past its run's own band in
  three of six readings, run 3's **mixed** by 21 points. C is not A's
  program — its `dispatch` has three arms where A's has four, and `opt -O3`
  gave C a branch chain on the tag where A got two `cmov` (§12.7) — so the
  two need not cost the same, and **why C costs more than A is not known**:
  no counter was read. C **mixed** is 5%, 27% and 13% over C **same**; a
  misprediction is not the explanation §3 allows, since the escape loops
  read `ts[i % 1024]`, the same period-1,024 stream on which §3 found a
  compare chain of up to three compares within ±3% of **direct**. What C
  does show is the invariant's half that needs no comparison with A: C *is*
  the hand `switch` over `{u0, u1, u2}` that the invariant (§2.3) names, the
  same IR a hand program writes, so a reference program lowered to C costs
  exactly that hand program, by construction. C is hand-written: the pass
  that would produce it is
  not built (§9).

### 4.4 The safeguards, measured

Three questions the review left open were answered by timing rather than
argument: what a check on the tag costs, what sets past eight cost, and
whether any variant leaks. Two runs of §12.8's runner, best of 11 rounds,
interleaved, on an Intel Xeon @ 2.10GHz with 4 cores and 15 GB; every program
compiled by the 0.38.0 release (`build/seed/bin/nish`, `--profile speed`),
every `.ll` through `llvm-as`. Copy bands, run 4: serial 0.7%, array 0%,
aperiodic 1.2%, escape 1.3%; run 5: 0.9%, 1.6%, 2.0% and 0.3%. Checksums
match the `default` arm's in every row, and §3's and §4.3's where the
program is theirs.

**A check on the tag (run 5).** Three lowerings of the last arm:
**default**, the last member as the `switch`'s `default` (§2.3); **trap**,
every member a `case` and `default: panic(...)`; **guard**, `if (tag < 0 ||
tag > K - 1) panic(...)` ahead of the `default`-arm `switch`. `/ direct`:

| Program | default | trap | guard |
| --- | ---: | ---: | ---: |
| serial, `K = 1`, same (a set of one) | 0.98x (no check) | — | 1.00x |
| serial, `K = 4`, same | 0.99x | 1.00x | 1.00x |
| serial, `K = 4`, mixed | 1.05x | 1.49x | 1.08x |
| serial, `K = 8`, same | 1.01x | 1.27x | 1.24x |
| serial, `K = 8`, mixed | 1.38x | 3.69x | 1.64x |
| array, `K = 4`, mixed | 1.02x | 1.22x | 1.03x |
| array, `K = 8`, mixed | 1.27x | 1.72x | 1.07x |
| aperiodic, `K = 4` | 3.78x | 4.49x | 3.76x |
| aperiodic, `K = 8` | 4.86x | 4.98x | 4.89x |
| escape A, same | 1.47x | 1.71x | 1.69x |
| escape A, mixed | 1.46x | 1.67x | 1.71x |
| escape C, same | 1.50x | 1.71x | 1.49x |
| escape C, mixed | 1.83x | 1.71x | 1.75x |

**trap** is past the band against **default** in eight of twelve rows, up to
2.7x (serial `K = 8` mixed). **guard** is cheaper but still past it in three:
1.19x serial `K = 8` mixed, 1.23x serial `K = 8` same, 1.16x escape A
mixed. Where a check came out ahead (array `K = 8`, escape C mixed) the
difference is inside §3's 21% layout spread. The visible difference in the
IR: a dispatcher that can panic loses `willreturn readonly`. Escape A's
`dispatch`, **default** then **guard**:

```llvm
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #2 {
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
```

The escape proof survives every check (`nocapture` above, and `P` an
`alloca` in `run` for A and C under all three); whether the lost attributes
or the extra branch is the cost was not measured. So a speed build carries
no check and a debug build does (§2.3).

**Sets past eight (run 4, the `default` arm).** `/ direct`, the same
generator as §12.1 with odd multipliers past the eighth (§12.8):

| `K` | serial, same | serial, periodic mixed | aperiodic |
| ---: | ---: | ---: | ---: |
| 2 | 1.00x | 1.00x | 2.50x |
| 4 | 1.00x | 1.02x | 3.75x |
| 8 | 1.00x | 1.35x | 4.81x |
| 16 | 1.92x | 4.60x | 5.17x |
| 32 | 6.41x | 12.37x | 5.56x |

Each row is a hand `switch` over `K` functions, written in Nish today, so a
reference over the same set costs what it does. The cost grows steeply past
eight, on a monomorphic stream too (6.4x at 32, where the tag never
changes); why was not measured. That is why stage 1 warns when a call's
set passes eight members, naming the stores that brought each one in (§10).

**Leaks.** Every variant was built at 1x, 10x and 100x its loop length and
run for its peak RSS, then at 1/1000 under `valgrind --leak-check=full`:

| Program | 1x | 10x | 100x | valgrind, definitely / indirectly lost |
| --- | ---: | ---: | ---: | --- |
| direct (serial, escape) | 13.1 MB | 13.1 MB | 13.1 MB | 0 / 0 bytes |
| serial `K = 1` guard, `K = 4` and `8` mixed, default and guard | 13.1 MB | 13.1 MB | 13.1 MB | 0 / 0 bytes |
| escape A and C mixed, default and guard | 13.0–13.1 MB | 13.0–13.1 MB | 13.1 MB | 0 / 0 bytes |
| escape B mixed | 16.6 MB | 154.0 MB | **1,527.8 MB** | 0 / 0 bytes |

Nothing a reference adds allocates: a tag is an `i32` and a dispatcher a
`switch` of direct calls. B's growth is not lost memory, which is why
valgrind reports none: every `P` stays in the arena until `nish_main`
releases it (§4.3). It is the growth the escape-join refusal (§2.2) keeps a
reference from causing. Every program but `esc_direct` reports 62 to 70
bytes "still reachable" at exit, two blocks allocated before `main` (a
32-byte and a 30-to-38-byte `malloc` from the loader's constructor call);
`esc_direct` is the one program that never reads `process.argv`, and the
direct baselines carry them too, so they are not the construct's.

## 5. Semantics

### 5.1 Node and `--emit-ts`: identity and `===`

Under `--emit-ts` and under Node, a reference is the function object itself:
`const h: (x: i32) => i32 = double;` is emitted as written, and `h(3)` is an
ordinary JavaScript call. Native identity is tag identity. The two agree
exactly when **one function has one tag and one object**:

- A top-level function is one object per module in JavaScript and one member
  of one set natively (its signature is fixed, so it is in exactly one set).
  `h === double` is `true` in both, `inc === dec` is `false` in both, and a
  reference compared with itself after a round trip through a field, an array
  or a `Map` value is `true` in both.
- An imported function is the same object in every importer under ES modules,
  and the same member natively. Agrees.
- `null` is `null` in Node and tag `0` natively; `h === null` agrees, and so
  does a zero-filled `(S) | null` element, which is `null` in both.
- **A generic function does not agree.** `f<i32>` and `f<u8>` with the same
  signature are two functions natively and one object in JavaScript, so
  `===` would be `false` natively and `true` in Node. **Refused** (§2.2).
- **A function with a function-typed parameter does not agree** for the same
  reason (one object, many instantiations). **Refused.**
- **Printing does not agree.** Node prints `[Function: double]` or the source;
  native holds a number. Every direct read but a call, a comparison, a store
  and a pass is **refused** (§2.2), and so is every container read that would
  print or order an element: `sort` with no comparator (NL2620), `console.log`
  of an array or an object, and typed JSON, whose field whitelist names no
  function type. `indexOf` and `includes` compare by `===`, which agrees. No
  program can observe the tag through a path that exists at `350bad84`; a new
  builtin that formats or orders values must refuse a reference too (§10).

What does not change: Node's call through `h` is a real indirect call, and a
site that sees several targets is the polymorphic site
[wp22-arrow-functions.md](wp22-arrow-functions.md) §2 measured at 7.6x
*in V8*. That cost is Node's, at a site the program asked for; the native
build pays §3's figures instead.

### 5.2 The C ABI

A tag is an index into one program's set; to C it is a meaningless `int`, and a
C function cannot be turned into a tag because it is not in any set. So a
reference never crosses the boundary in either direction:

- a `declare function` parameter or return of function type — today an arrow
  passed there is refused with NL2336 (`` An arrow may only be written as the
  argument for a function-typed parameter of a top-level function ``, pinned
  by `tests/cases/reject_ffi_callback`). A reference gets a new code in
  `src/codes.ts`: `` `h` is a function reference: C cannot call it, because a
  reference is a tag this program's dispatcher reads, not an address ``,
  pinned by a new `tests/cases/reject_fnref_ffi`;
- a field of function type in a class a `declare function` is handed or
  returns (the same diagnostic, against the field);
- a function type in a return, a field, or a reference-typed parameter or
  local of any declaration `hostVisible`
  (`src/visibility.ts:141`–`142`) answers yes for, which is the one place the
  compiler decides who besides this program can call a function or see a
  layout. A foreign caller could hand in a function no set holds, which
  breaks the closed-set premise everything else rests on. Read from that
  rule, the refusal covers:
  - **every exported function of an open-world build.** `buildModeOf`
    (`src/visibility.ts:121`–`131`) makes a build closed only under `--link`,
    native, with no sidecar (`--emit-header`, `--emit-dts`, `--emit-napi`,
    `--emit-napi-async`) and no `declare function`; any other build, `-o`
    alone included, leaves `export` host-visible;
  - **every function, exported or not, under `--no-strict-exports`** in an
    open build: `everySymbolPublic` gives each external linkage;
  - **the entry point**, which is host-visible in every build; `main` takes
    no function-typed parameter today, and must not take a reference;
  - **a function-typed field of a class reachable from a host-visible
    signature**, a parameter, return or field type, since a host that holds
    the object can store into the field. Where `layoutsShared` holds (a
    sidecar, a `declare function` or a wasm build), every class's layout is
    handed out, so the field is refused in every class of such a build, not
    only the reachable ones.

  In a closed-world `--link` build an exported function is not host-visible,
  and an `export` between Nish modules is never external: neither is
  refused. **A compile-time function parameter is not in the refusal's
  scope, in any build.** `sortWith` (`std/sort.ts:162`) and `expose`
  (`std/secret.ts:77`) take function-typed parameters; such a parameter is
  bound when its function is instantiated (NL2587's wording), to a named
  callee or, from stage 2, to the arrow a reference argument is rewritten
  into, one instantiation per call site, and a function holding one has no single body a host could
  call (§2.2). Every instantiation is made at a call the compiler checked,
  so its callers are in the program whatever the build mode. What is
  refused is a reference a host could hold: a return, a field, or a
  parameter of a function that is itself a host-visible symbol. Because the refusal reads `hostVisible`, the
  call-site ranges and the C ABI answer the same question, and an output
  mode added later is refused until `src/visibility.ts` says it is closed.

A real C callback — a code pointer C can call — is
[wp27-ffi.md](wp27-ffi.md)'s and [wp53-ffi-buffers-handles.md](wp53-ffi-buffers-handles.md)'s
question, and this note does not move it: it would need an exported
trampoline per function, which is a different construct.

### 5.3 `-g` and DWARF

- **The tag in a debugger.** A reference's debug type is a
  `DW_TAG_enumeration_type` named for the signature, one `DIEnumerator` per
  member (`name: "t2", value: 3`). `src/debug.ts` already emits exactly this
  for an `enum` (the `DIEnumerator` at `:454`, the
  `DW_TAG_enumeration_type` at `:461`), so gdb and lldb print `h = t2` rather than `h = 2`, and
  `p h == t2` works. Nothing new in the emitter but the source of the names.
- **Line info on the switch.** The dispatcher is synthetic and shared by
  every call whose set is the same (§2.3), so its own instructions cannot
  carry any one call site's location. It gets a `DISubprogram` flagged
  `DIFlagArtificial`, and its `switch` and arms carry a location in that
  subprogram's own scope (line `0`, the convention for compiler-generated
  code), not a source line. What a reader sees unoptimised: a backtrace from
  inside a member shows the member's frame, then `$ref.S.p` with no source
  line, then the caller's frame **at the call line** — the caller's own
  location is the one that names the site. A step into `h(3)` enters
  `$ref.S.p`; whether gdb and lldb step through an artificial line-0 frame
  into the member, or stop in it, was not tried, and is checked in stage 1
  with the `-g` test of §9.
- **What stage 1 found** (`tests/run.js`, section `fnref`, "fnref -g", under
  `--profile debug`, which keeps the symbols the speed profile strips; gdb
  15 and lldb 18). gdb prints `h = twice`, `p h == twice` is `1`, and
  `ptype h` is `enum (i32) => i32 {inc = 1, twice}`. The first `step` from
  the call stops in `$ref.0.fr1.i32.i32.0 ($t=<optimized out>)` — gdb names
  a line beside it, its display of a line-0 location, though the line table
  gives the dispatcher none — and the second enters `twice`; `skip -rfu
  '^\$ref\.'` makes it one step. A backtrace from inside the member shows no
  dispatcher frame, because the dispatcher tail-calls its member, then the
  caller at the call line. lldb prints `((i32) => i32) h = twice`, but
  `expr h == twice` is refused ("reference to 'twice' is ambiguous": the
  enumerator and the function share the name), and its `step` from the call
  line steps out of the line-0 dispatcher and over the tail call to the next
  line: in lldb, set a breakpoint in the member instead. The debug type
  needed `src/debug.ts` to describe a reference at all (before, `-g` on any
  reference local stopped with "no DWARF basic type"); the enumeration's
  names come from `TypeTable.fnRefMembers`, filled where the tags are dealt.
- **The optimised build** inlines the dispatcher into its callers (it is a few
  instructions); each inlined copy's locations then carry `inlinedAt` the
  call site, so in `--profile speed` the debugger attributes the switch to
  the call line, as `-O3` shows any inlined function. That is LLVM's
  inliner's rule, not something the spike's IR was checked for.

### 5.4 The rolling freeze

`src/` may not use a construct until the release after it ships (CLAUDE.md,
CI's `bootstrap` job). Because references are strict (§8), that freeze is the
only wait; a compat construct could never be used in `src/`
(`wp28-compatibility-mode.md:244` at `350bad84`). The first release that builds references cannot use
them in `src/`, and nothing in `src/` needs them first: the dispatch tables
`src/` has (wp23 §6.2, D2 of [wp14-selfhost.md](wp14-selfhost.md) §3a) are
central `switch`es, which is the lowering this proposal generates. The release
after could rewrite a table as an array of references; whether it should is a
readability question, not a performance one, since §3 shows the code is the
same. The freeze reaches the `std/` modules `src/` imports as well:
`src/cli-style.ts` imports `std/cli.ts` by relative path, "so that module is
under the rolling freeze too" (`.claude/selfhost.md:198`), and no such module
may hold a reference until the release after.

## 6. What leaned on "no function values"

The proposal keeps every whole-program fact, **as the join over the set**. A
place that leaned on "every callee is named at the call" is therefore
*weakened* — its fact is now as strong as the weakest member that can reach
the call — or *intact*, where the fact was about something a reference cannot
reach. **Broken** marks a place whose claim is false under the proposal and
must be rewritten. Most of the prose rows say "Nish has no function values"
to explain an API's shape; under the proposal each becomes "Nish has no
closures", and the shape it explains may stay or change.

Every row was read at `350bad84`. Hits for "never a value" that are about
promises, module storage, classes or a parameter's own storage, not functions
(`src/annotations.ts:292`, 298; `src/async-check.ts`; `src/codes.ts:304`,
310, 428, 460, 816; `src/checker.ts:1869`; `src/constants.ts:287`;
`src/inline-arrays.ts:25`; `src/module-storage.ts:20`, 821;
`src/parser.ts:4371`; `src/statements.ts:875`; `docs/AI.md:184`, 904;
`docs/guide/language/async.md:82`; `docs/guide/getting-started/from-typescript.md:345`;
`docs/guide/using-nish/threads.md:614`; `docs/security/postgres.md:533`;
`docs/wp49-async-server.md:43`), are unrelated and have no row.

**The compiler and its diagnostics**

| Where | What it leans on | Verdict | What the compiler or the text would need |
| --- | --- | --- | --- |
| `src/codes.ts:274` (NL2336, `tests/wordings/nl2336_fnarg_arrow_returned`), `docs/LANGUAGE.md:3392`, `src/generics.ts:2398` | an arrow outside a function-typed argument is refused: "a function is never a value" | **rewritten in stage 1** | NL2336 now reads `an arrow in value position is not yet a function reference: declare it as a top-level function and name it` (`reject_fnarg_arrow_value`), and a capturing arrow is NL2731, `` this arrow captures `k`: a function reference names a top-level function and carries no environment `` (`reject_arrow_as_value`, `reject_fnref_capture`); `docs/LANGUAGE.md` → "Function parameters" and "Function references". Stage 3 still lifts a capture-free arrow |
| `src/codes.ts:480` (NL2334, `tests/wordings/nl2334_fnarg_parameter_as_value`), `src/expressions.ts:984`–`993`, `docs/LANGUAGE.md:3337` | a function parameter can only be called or passed on | **rewritten in stage 1** | a parameter typed through an alias is an ordinary reference parameter, of a function, a method or a constructor, and may be stored and returned (`fnref_stores`); a parameter whose function type is written inline stays a compile-time function parameter, and NL2334 names it: `` `f` is a function parameter and can only be called or passed on as a function argument: it names the callee each call is compiled for, not a value, so it cannot be stored, returned, compared or put in an array ``. `docs/LANGUAGE.md` → "Function parameters"; `docs/guide/language/functions.md`. No `$fn.ref.<set>` instantiation was needed for this |
| `src/codes.ts:150`–`151` (NL2587, `tests/wordings/nl2587_fnarg_capture_function_param`), `docs/LANGUAGE.md:3358`–`3360` (`reject_fnarg_capture_function_param`) | an arrow argument may not name a function parameter of the function it is written in, which "is bound at instantiation and is no value" | intact | a function-typed parameter is still bound at instantiation, to a named callee or (stage 2) to the arrow a reference argument becomes, `($a0) => h($a0)` capturing the local `h`, one instantiation per call site; the template is checked once from its source, so an arrow that names it is refused in every instantiation: one body is accepted or refused the same way whatever its argument. An arrow may capture a reference-typed *local* or parameter: that is an `i32` tag, captured by copy like any `const` (`fnref_arg_capture_param`); a field or element passed directly is refused (NL2741) because the arrow would read it again at each call |
| `src/generics.ts:2008`–`2010` (now 2048) | an argument for a function-typed parameter must be a name or an arrow: "a function is never a value computed at run time" | **rewritten in stage 2** | stage 1 refused a reference handed to an inline function parameter with NL2734; stage 2 admits a reference-typed local by passing an arrow that captures it and calls it, one instantiation per call site (`tests/cases/fnref_arg`); a field or element is refused (NL2741: read it into a `const`), and a nullable local until it is narrowed (NL2742). NL2734 now covers only the runners that check their body, `parallelMap`, `parallelMapInto`, `parallelReduce`, `spawn`, `expose`, `exposeWith`, `region` and `enterWith` (`tests/wordings/nl2734_fnref_to_function_parameter`, `tests/cases/reject_fnarg_ref_*`) |
| `src/codes.ts:494` (NL2337, `tests/wordings/nl2337_fnarg_function_type_element`), `docs/LANGUAGE.md:3409`, `src/annotations.ts:224` | a function type annotates only a parameter | **rewritten in stage 1** | NL2337 is retired (`tests/wordings/unreachable.txt`): a function type in a field, local, element or return is a reference type, an `i32` tag (`fnref_array`, `fnref_field`). An inline function type on a method or constructor parameter, or on a function type's own parameter, is refused: `` `f` cannot have a function type here: a function type may only annotate a parameter of a top-level function, which is monomorphised for each function it is given, and this is a parameter of a method or a constructor `` (`reject_fnarg_method`, `reject_fnarg_nested`) |
| `src/nodes.ts:129` | an `N_ARROW` is never a value | intact until stage 3 | stage 3's lifted arrow is a reference, not an `N_ARROW` value |
| `docs/LANGUAGE.md:12476`, `src/validator.ts:146` | `Function` as a type name is forbidden | intact | `Function` stays refused (§2.2) |
| `docs/LANGUAGE.md:1708`–`1712` (`reject_param_rest_function_value`) | a function with a rest parameter is never passed as a function value | intact, extended | the rule covers a reference too, and widens to default and optional parameters (§2.2) |
| `docs/ARCHITECTURE.md:393` (the call-site ranges row, now 410), `src/ranges.ts:355`–`360` (`takesEntryFacts`), 1019 | **the entry-facts soundness premise**: a function that is not `hostVisible` is entered with the join of its call sites' facts, which is sound because "a Nish function is never a value, so no other caller can exist" | **rewritten in stage 1** | the dispatcher is a checked function pushed into the module (`src/fnref-places.ts`), so its arm calls are call sites like any other and a set member is entered with their join. The row now says every other call is one the compiler recorded, a call through a reference included, and the builtin summary says "a call handed no function reference reaches only what it is handed" |
| `src/attributes.ts:13`–`17`, 830, 4967, 5677 | the fact collector records direct callees; an unknown callee is `EFFECT_ANY` | weakened | none if §2.4's record holds: the dispatcher is an ordinary checked function, and its arm calls are direct calls recorded like any other; §4.2 is the evidence |
| `src/attributes.ts:27`, `src/expressions.ts:4`–`10`, `src/emit.ts:24`, `src/emit-classes.ts:19` | "a table needs function values; D2 took a central `switch`" | weakened | a table becomes possible after the freeze (§5.4); the `switch` stays valid |
| `src/emit-async.ts:27` | async state machines dispatch by `switch` | intact | — |
| `src/generics.ts:1693`, 1740 | a function-typed parameter instantiates per callee | intact | a reference argument adds one instantiation per call site, of the arrow it is rewritten into (stage 2; the plan's one per set, `$fn.ref.<set>`, was not built) |
| `src/members.ts:883` | `Map.forEach` waits for function values | weakened | `forEach` with a capture-free callback could ship; with a closure it still waits |
| `src/portability-records.ts:904`, 1093 | a call through a function value is `EFFECT_ANY` | weakened | a reference call's effect is the join of its set's effects, not `EFFECT_ANY` |
| `src/region-rules.ts:206` (`noFactsMessage`, used at 810 and 987) | a callee without facts is refused inside a region | intact, if | the reference call is recorded in `nodeCallees` as its dispatcher, which has facts (§2.4); otherwise every reference call in a region would be refused |
| `src/checker.ts:959`, `src/declarations.ts:445` | pass 2 runs once every callee is known | intact, if | pass 1 collects the signature sets; the per-place sets follow pass 2 (§2.4) |
| `src/parallel.ts:1238`, `docs/wp20-threads.md:57` | a parallel body's callee is named, so its captures and sendability are known | intact in kind | the walk of a reference call visits every member of its set: the join again |
| `docs/LANGUAGE.md:7259`, `src/bounds.ts:5637` | a builtin's callee argument is named | intact | if no builtin takes a reference; otherwise the builtin needs the dispatcher's summary |
| `docs/LANGUAGE.md:9922` (NL2425, unreachable: `tests/wordings/unreachable.txt:133`) | the `using … arena()` row "a call the analysis has no facts for": always refused, and unreachable because every callee has facts today | intact, if | the dispatcher has facts, so it stays unreachable; a reference call recorded without its dispatcher (§2.4) would make it reachable |
| `docs/LANGUAGE.md:8766`, `src/builtins.ts:1060` | a builtin or array method takes no function value | intact | no builtin takes a reference in stage 1 |
| `src/arrays.ts:1068` | a compiler helper is "a class because Nish-0 has no closures (as `PerfWalk` is)": the compiler's own language, not the user's | intact | closures stay refused; the freeze keeps `src/` off references for a release (§5.4) |
| `docs/LANGUAGE.md:9537`, `docs/IR_COOKBOOK.md:942`, 1236 | `sort`'s comparator is called directly, no pointer | weakened | a reference comparator gives one `switch` instantiation, inlined like §3's |
| `docs/LANGUAGE.md:6267`, `docs/wp27-ffi.md:510`, `docs/wp53-ffi-buffers-handles.md:1270` (and 620, 679, 835, 869, 1389) | no C callbacks (`reject_ffi_callback`) | intact, extended | `reject_fnref_ffi` (§5.2) |
| `docs/security/async.md:130` | a dispatch is a `switch` over known handlers | intact | a tag can only be made by naming a member; the `default` arm cannot reach outside the set |

**The language reference and the user guide**

| Where | What it leans on | Verdict | What the text would need |
| --- | --- | --- | --- |
| `docs/LANGUAGE.md:3291`–`3292` | "There is no function pointer, no indirect call and no function value anywhere; the parameter has no LLVM parameter at all" | weakened | true of a parameter bound to a named callee; a parameter holding a reference has an `i32` parameter, and its calls go through the dispatcher, still no function pointer |
| `docs/LANGUAGE.md:2305`–`2314` | the `--link` closed-world rule: every call to an exported function is one the compiler sees, which `ARCHITECTURE.md`'s call-site ranges row makes sound | intact, if | it rests on that row's premise, so it holds while every dispatcher's arm calls are recorded (§2.4); §5.2 keeps references out of every host-visible signature, so no host can hand one in |
| `docs/LANGUAGE.md:3398`–`3402` (`reject_fnarg_not_name`) | a function argument must be the name of a top-level function or an arrow; a local, a member or any other expression is refused | **broken** in stage 2 | a reference-typed local, member or element is admitted as the argument (`fnref_arg`); `reject_fnarg_not_name` keeps a local of any other type and names it (§9) |
| `docs/LANGUAGE.md:12606` (`reject_fnarg_store`, `reject_fnarg_return`) | the summary row: a function parameter used as a value is refused | **rewritten in stage 1** | the summary row keeps the refusal for a parameter whose function type is written inline; an alias-typed parameter is a reference and is not in the row |
| `docs/LANGUAGE.md:12609` (`reject_fnarg_arrow_value`) | an arrow anywhere but as a function argument is refused | intact until stage 3 | stage 3 admits a capture-free arrow in value position by lifting it |
| `docs/LANGUAGE.md:12610` | a function type anywhere but on a parameter of a top-level function is refused | **rewritten in stage 1** | the summary row now names only an inline function type on a method, constructor or function-type parameter, and a new row lists the reference codes NL2725–NL2739 |
| `docs/LANGUAGE.md:1585`–`1590` (`reject_arrow_as_value`) | "A function is not a value": `const alias = double` is an unknown identifier; a function in a field, a local or an array does not exist | **rewritten in stage 1** | the bullet is "A capture-free top-level function is a value", citing `fnref_field`, `fnref_array`, `fnref_eq` and `fnref_stores`; `reject_arrow_as_value` keeps only a capturing arrow (NL2731). The rules are the new "Function references" section |
| `docs/AI.md:178`, 421, 584, 827 | a stored or returned callback is refused; write a `switch` | **rewritten in stage 1** (178, 584), weakened (421, 827) | the table row is now "a closure stored or returned" with the NL2731 and NL2336 wordings; the "A function is not a value" bullet became "A capture-free top-level function is a value", and AI.md has a "Function references" section. 421 and 827 do not lean on it and were left |
| `docs/guide/language/functions.md:195` | "A function is not a value in Nish: you cannot store one" | **rewritten in stage 1** | the paragraph now points to `docs/guide/language/function-references.md`, the new page (route `/function-references`) |
| `docs/guide/language/errors.md:236`–`237`, `docs/wp16-results.md:112`, `docs/LANGUAGE.md:1276` | no `map` / `andThen` / `orElse` on a `Result`, because they would take a function | weakened | the reason now holds for capturing callbacks only; a `map(r, double)` taking a reference becomes expressible |
| `docs/guide/using-nish/http-router.md:9`, `std/net/router.ts:15` | "a route is not a handler": a route is the index `add` answered | weakened | the index can become a reference; the dispatcher is the same code. The page and the module change only if `std/` adopts it |
| `std/cli-flags.ts:18` | "**No function values.**" | weakened | the reason becomes "no closures"; the API changes only if `std/` adopts references |
| `docs/IR_COOKBOOK.md:20306` | "no function pointer, no indirect call"; `std/sort.ts` writes the comparator as a parameter | intact | a reference lowers to a `switch`, so there is still no function pointer or indirect call |
| `docs/guide/using-nish/standard-library.md:1768`, `std/README.md:478`, `std/cli-args.ts:18`, `std/net/handler.ts:31`, `std/net/tls-tcp.ts:22`, `std/testing.ts:26` | an API is a handle, a builder or a pull loop "because Nish has no function values" | weakened | each sentence's reason becomes "no closures"; whether the API takes a reference is its own change after stage 2 |

**The design notes**

| Where | What it leans on | Verdict | What the text would need |
| --- | --- | --- | --- |
| `docs/wp22-arrow-functions.md:55`–`59` | a callback site in Node is monomorphic, because each callee is its own instantiation and "there are no function values" | **annotated in stage 1** | a dated note after the paragraph records that WP51 made capture-free top-level functions values and that a native reference call is a `switch` of direct calls; a reference site is polymorphic under Node (§5.1) |
| `docs/wp22-arrow-functions.md:65`, 82–85 (rule 2) | "Function values stay forbidden"; a name bound to a function appears only in call position, so `const g = double`, `[double]` and `obj.f = double` are refused | **annotated in stage 1** | the note's text is kept as the record of that decision, and each place carries a pointer to this note saying stage 1 replaced rule 2 for capture-free top-level functions |
| `docs/wp23-language-surface.md:21`–`23`, §6 (188–192, 205) | function values are refused and why; "a function is still never a value" | weakened | the pointer this PR adds; the text is replaced by this table when stage 1 ships |
| `docs/wp28-compatibility-mode.md:141` (row), 183, 463 (C2b) | function values are a compat-tier construct: an indirect call and a lost fixpoint; the `NL9xxx` sort warning "passes a function value" | weakened | capture-free references leave this row for strict, as C2a did (§8), and need neither the indirect call nor a lost fixpoint; closures stay in C2b |
| `docs/wp26-stdlib.md:93`–`95` (§3a), 149 (§3f), 162 | no `test(name, callback)`; `jsonFields` shares a step, not a loop; `std/` APIs avoid callbacks | weakened | a capture-free test body or field step could be a reference once stage 2 ships |
| `docs/wp49-async-server.md:127`–`129`, 147–150 | a handler cannot be stored in the router | weakened (128), intact (the rest) | a router holding an array of handler references becomes expressible |
| `docs/wp49-async-server.md:756`–`761` | a call through a function-typed parameter in a spawned task is judged by worst-case facts; lifting that "needs facts per function value" | weakened | a reference call has its dispatcher's facts, so the region rules judge it by its set's join, not the worst case — the per-function-value facts this row asks for, if §2.4's `nodeCallees` record holds |
| `docs/wp18-generics.md:28` | a generic is instantiated per use | intact | a generic cannot be referenced (§2.2) |
| `docs/wp15-performance.md:15`, 64 | no closures, so no environment allocation | intact | closures stay refused |
| `docs/wp25-inheritance.md:40`, 159; `docs/wp2-classes.md:125` | no vtables: dispatch is closed-world | intact | the dispatcher is the closed-world `switch` those notes name as the alternative |
| `docs/wp24-async.md:94`, 198, 239 | no promise values, no capturing callbacks | intact | — |
| `docs/wp43-http-app-layer.md:48`, 172 | a route is an index because there are no function values | weakened | the index can become a reference; the dispatcher is the same code |
| `docs/wp9-optimisation.md:230` | no closure allocations to elide | intact | a tag holds no allocation |
| `docs/wp1-control-flow.md:83`, `docs/ARCHITECTURE.md:361`, 370 | every call's callee is known to the fixpoint | weakened | known as a set; the dispatcher must exist in the module before the fixpoint runs, and then no change |
| `docs/ARCHITECTURE.md:48`, 359 | the fixpoint runs over the whole program at once | intact | it is what makes each set closed |
| `docs/ARCHITECTURE.md:142` | the IR holds no closure value, environment struct or indirect call | intact | a reference is an `i32`, the dispatcher a `switch` of direct calls |
| `docs/wp14-selfhost.md:50`, `docs/ARCHITECTURE.md:136` | Nish-0 has no function values, so the emitter has no tables of closures | intact | the freeze keeps `src/` off references for a release (§5.4); a table of references is not a table of closures |

**The contributor rules and the AI checklist**

| Where | What it leans on | Verdict | What the text would need |
| --- | --- | --- | --- |
| `.claude/typescript.md:53`–`57` | `Function` is forbidden as "no dynamic function values": a function value "needs a function pointer and an indirect call", and the whole-program pass "cannot prove purity, termination or escape facts through an unknown callee"; "that is what keeps a function from being a value whichever way it is spelled" | weakened | `Function` stays forbidden (§2.2), but the reason no longer covers every spelling: a reference has neither a pointer nor an unknown callee, and its facts are its set's join (§6's first table). The sentence narrows to closures and `Function` |
| `.claude/typescript.md:79` | `src/`'s own subset: "a function is never a value" | intact | the freeze keeps `src/` off references for one release (§5.4); after it, whether `src/` adopts them is its own change, and this line moves with it |
| `.claude/selfhost.md:137`–`140` | Nish-0 has "no … function values" | intact | Nish-0's subset is a choice, held by the freeze; the line moves only if `src/` adopts references |
| `.claude/testing.md:290` | "A function is not a value, so there is no `test(name, () => ...)`": the test harness is straight-line calls | weakened | the reason becomes "no closures"; a `test(name, f)` over a capture-free top-level `f` is expressible from stage 2 (as `docs/wp26-stdlib.md`'s row says), and the line changes only if `std/testing.ts` adopts it |
| `docs/AI.md:3129` (checklist item 8, now item 9) | "a stored or returned callback" is on the list of things a program must not use | **rewritten in stage 1** | the item now names "a stored or returned closure"; a capture-free function is admitted |

## 7. Not measured

- **Where the jump table starts.** `K = 8` was a jump table (§3.5); `K = 5`
  to `7`, where `llc`'s threshold says the first one appears, were not
  timed. Sets of 16 and 32 were (§4.4), and why their cost grows on a
  monomorphic stream was not found.
- **Performance counters.** No `perf stat` was read, so why the indirect call
  costs 3.1x to 4.7x on a periodic stream is unknown (§3.5): the `K = 8` row
  rules out the obvious cause, and the candidates left are not distinguished.
- **The aperiodic group's layout spread.** No pair of binaries with the same
  loop was timed there, so neither `K = 2`'s 1.28x nor `K = 4`'s 1.21x is
  known to be past it.
- **How A's 1.3x to 1.6x splits** between the tag load and the `cmov`
  select (§4.3). The disassembly says what A adds over **direct**, a callee
  picked by data against one folded to constants (§3.5, §12.7); no variant
  with the load but no select was timed.
- **Why B same is slower than B mixed** in all four runs (§4.3).
- **Why C costs more than A**, by up to 1.37x in run 3, and why C **mixed**
  is 5% to 27% over C **same** on a periodic stream (§4.3). No counter was
  read; C's branch chain against A's `cmov` is the visible difference, not a
  shown cause.
- **The escape group's own layout spread.** Its copy rows give a within-run
  band per run (3% to 16%); no relinked or reordered build of the escape
  programs was timed, so §3's 21% is not known to apply here, and §4.3 reads
  each run against its own band only.
- **A `K = 1` control for the escape shape.** With one member there is no
  `switch`, so it would separate the tag array's cost from the dispatch's; it
  was not built.
- **The per-place set pass.** Its output was measured, the pass was not:
  case C (§4.3) is the program the pass produces for a hot site whose place
  holds `u0..u2` while `u3` escapes at another site, written by hand. That
  the pass computes `{u0, u1, u2}` there, and what it costs to compute, are
  stage 1's to show.
- **A loop-invariant reference.** `const h = pick(); for (...) h(x)` could be
  unswitched; whether LLVM does it from the dispatcher was not checked.
- **Node.** No `--emit-ts` build was timed; §5.1 relies on wp22's 7.6x for a
  polymorphic V8 site.
- **The cost of the compiler change**: compile time, `.ll` size and debug-info
  size for a program with many sets.
- **A large real program.** Every figure is a microbenchmark; no router, no
  parser table, no `std/` API was rewritten with references.

## 8. The recommendation

**Strict, with per-place sets, the escape-join refusal and a check-free
speed-build dispatcher required in stage 1.**

The three possible answers, against the numbers:

- **Decline** would be right if a reference cost what wp28 §7.4 measured for a
  function value. It does not, but what it saves depends on the stream (§3.5).
  On a periodic mixed stream the switch is within ±3% of **direct** up to
  four members and 1.25x to 1.33x at eight, against an indirect call 3.7x to
  4.7x the switch (3.1x to 3.3x at eight). On a monomorphic site the switch
  is free and its advantage over an indirect call is not shown past the 21%
  layout spread. On an aperiodic stream every lowering mispredicts: the switch
  costs 2.4x to 4.5x **direct**, as a hand-written `switch` over the same tags
  does, and differs from the indirect call at `K = 2` and `K = 4` (1.28x and
  1.21x, neither known to be past that group's layout spread) and not at
  `K = 8`. The escape proof is kept whenever the set keeps it (§4.2, A and
  C). So performance does not decide against Decline: a reference costs
  what the hand `switch` costs. **The case over Decline is expressiveness**:
  a handler in a field, an array or a `Map`, a parser's action table, a
  router's handler list, a test list, written as the functions themselves
  rather than as integer tags and a `switch` kept in step with them by hand.
- **Strict**, with per-place sets. With **one dispatcher per signature** a
  reference could cost more than the code it replaces: a three-way site over
  `u0..u2`, rewritten from a hand `switch` to references, would pay B's 6.4x
  to 9.1x and 1.5 GB because `u3`, elsewhere in the program, keeps `p` (§4.3).
  Per-place sets (§2.3) are the cure, and it is measured: case C, the
  program the pass produces when `u3` escapes at another site, keeps `P` an
  `alloca` and 12 MB at 1.40x to 2.02x a direct call, against B's 6.4x to
  9.1x and 1.5 GB (§4.3); it is the hand `switch` over `u0..u2`, the same
  IR, so it costs what that hand program costs by construction. A place is a declaration (a
  local, a parameter, a field, a function's return) or an element type
  (`S[]`, a `Map`'s value), and its set is every member stored into it. From
  that: **no program is slower than the same program written with `i32`
  tags, whose hand `switch` at each call covers every member stored into the
  same declaration or element type**, since the dispatcher is that `switch`.
  What a hand programmer could do better, by knowing which array or which
  object a call reads, or which path reaches it, is §10's list. The pass is
  unbuilt, so it is part of stage 1, and stage 1 does not ship until
  `fnref_place_set`, case C's program, keeps `P` an `alloca` (§9). Its
  TypeScript reading is identical (class A of
  [wp33-round-trip.md](wp33-round-trip.md) §2), because every read that
  could tell a tag from a function object is refused (§5.1).
- **Not compat, though compat could hold it.** A tag is an `i32`, a fixed
  layout, so wp28's rule 2 (`wp28-compatibility-mode.md:59`–`64` at
  `350bad84`) would admit references in compat. Strict "does not grow"
  (rule 1, :57-58), and wp28 answered that rule for C2a, function-typed
  parameters, by building them in strict because they were "free at run
  time" (:462). References are not C2a: their target is not named at the
  call. Nor are they C2b, "a value whose target the checker cannot name"
  (:463), whose cost is an unknown callee and whose open measurement is how
  much of a program is reachable from it (:533-535): the checker names the
  closed set that can reach each call, `F(p)`, so that reach is computed per
  call, exactly, and the join over it is what A, B and C measure. In that
  third case a reference costs exactly the hand `switch` over the same
  declaration's tags — the dispatcher is that `switch` (§2.3, C in §4.3) —
  and more only against a hand program that keeps tags in finer places than
  a declaration, and then only by a wider `switch` (§4.4): the escape-join
  refusal (§2.2) keeps B's 6.4x to 9.1x out of reach. So references leave compat's
  list the way C2a did, with that gap stated. The practical costs of compat point the same way: C0,
  the `--compat` machinery, is unbuilt (:458); `src/` may never use compat
  (:244), where §5.4 wants references after the freeze; and compat implies
  `--number-mode f64` (:316). Closures stay on wp28's list (C2b).

What the recommendation does not rest on, because it was not measured (§7):
`K = 5` to `7` and sets above eight, Node timings, a real program, the `K = 1`
escape control, and performance counters. The per-place pass is unbuilt, but
the program it produces is measured (case C). The
aperiodic stream narrows the claim: the switch's large advantage over an
indirect call is a periodic-stream result, while its parity with a
hand-written `switch` holds on every stream.

The join would be a cliff within a place's set: a member that escapes,
stored into a place that a hot call reads, would remove the stack proof for
that call, and the program's memory would grow with the loop (§4.4). A hand
`switch` with that arm pays the same, but a reference makes it easy to cause
with one store far from the call, so stage 1 refuses it (§2.2): a call
through a set that mixes members that keep an argument with members that do
not does not compile, and the diagnostic names the member and the store.

## 9. If it ships: stages

Each stage is one PR, follows the checklist of
[ARCHITECTURE.md](ARCHITECTURE.md#how-to-add-a-construct), and lands green on
its own.

Every stage lands in the strict language (§8). Stage 1 changes
`docs/LANGUAGE.md` and flips the negatives that refuse references today, so it
does not ship until its per-place pass and `fnref_place_set`, case C's
program, do.

1. **Stage 1 — references in fields, locals, arrays and returns; calls; `===`;
   per-place sets.** Pass 1 collects the signature sets and the numbering
   (§2.4); after pass 2 the per-place pass computes each place's set (§2.3),
   the checker generates each set's dispatcher as a checked function, and
   records its arm calls and each reference call (as a call of its
   dispatcher) in `nodeCallees`, before ranges, attributes or the region
   rules read it; after the attribute fixpoint, the escape-join refusal
   (§2.2) reads each member's `escaping` set; the emitter writes the tag
   check only under `--profile debug` (§2.3); a member that crosses a module
   gets `hidden` linkage without losing its entry facts (§2.3);
   `src/annotations.ts` admits a function type outside a
   parameter as an `i32` tag; the checker refuses everything in §2.2 and the
   zero-filled storage of §2.1 with new codes in `src/codes.ts`; `src/emit.ts`
   writes each generated dispatcher as `$ref.S.p` and lowers a reference
   call to a call of it; `===` lowers to `icmp eq`; `-g` gets the enumeration type and the
   artificial dispatcher (§5.3). NL2336's and NL2334's wordings change
   (§6), and their `tests/wordings/` programs with them
   (`nl2336_fnarg_arrow_returned`, `nl2334_fnarg_parameter_as_value`);
   NL2337 is retired (`tests/wordings/unreachable.txt`). `fnref_place_set` is case C
   (§4.1) written with references: a field or local holding `u0..u2` read at
   the hot call, `u3` stored into another place and called there. Its golden
   pins the dispatcher over `{u0, u1, u2}` with A's facts and `P` an
   `alloca` in `run`; stage 1 does not ship without it (§8). Beside it, one
   test per row of §2.3's store-context table, each storing `u3` through
   that row's form into the hot place, so the golden shows `u3` in the
   place's set: a row the pass drops would leave `u3` out and call `u2`
   instead, or, with the trap arm, trap. A `-g` test steps into a reference
   call under gdb and lldb and pins where it stops (§5.3). A two-module
   variant stores a member of one module into a place read in the other and
   pins the dispatcher copy and the member's `hidden` linkage (§2.3).
   Stage 1 also settles the two open decisions of §2.3: the trap arm, and
   whether a `hidden` member keeps its call-site entry facts. Any function
   reachable from a host-visible signature taking a reference is refused
   (§5.2).
2. **Stage 2 — references as arguments, `| null` and `Map` values.** *As
   shipped: a reference argument instantiates the callee once per call site,
   with an arrow that captures the local by value, not once per set; a field
   or element argument is refused (NL2741), so it is read once as in
   JavaScript; `Map` values share the set of the arrays of their type.* A
   function-typed parameter accepts a reference, instantiating
   `$fn.ref.<set>` once per set; `S | null` with tag `0`, the exception to
   `reject_nullable_scalar` (§2.1), and zero-filled `new Array<S | null>(n)`;
   `Map` values. Each is a new kind of place, so the per-place pass extends to
   it in the same stage, and `fnref_place_set` gains a variant with the
   reference passed as an argument, through `| null` and through a `Map`.
   `reject_fnarg_not_name` flips (`docs/LANGUAGE.md:3398`–`3402`): a
   reference-typed local, member or element is admitted as an argument, and
   the case is rewritten to an expression of another type, which stays
   refused. **What `functionArgs` holds.** Every reader of
   `Instantiation.functionArgs` assumes one named callee and treats any other
   length as "no callee": `src/region-rules.ts:981` and `src/secret.ts:2716`
   return no finding, `src/parallel.ts:323` no body, `src/secret.ts:2094` and
   `2477` no flow; `src/parallel.ts:1192` and `src/inline-arrays.ts:757` walk
   whatever it holds. An empty list in a `$fn.ref.<set>` instantiation would
   therefore let a region, a parallel body or an `expose` through unchecked.
   So the reference parameter's slot holds the set's dispatcher, a checked
   function with facts (§2.3): every reader then runs on it, and its facts,
   captures and calls are its arms' join. One reader looks past the callee's
   facts to its parameter list, `src/secret.ts:2094`'s `paramNames[1]`, and
   on a dispatcher parameter `i + 1` is the member's `i` (§2.3); until that
   reader is taught the offset, and the parallel roles' grain and capture
   walks are read against a dispatcher body, stage 2 refuses a
   reference argument to `expose`, `exposeWith`, `parallelMapInto` and
   `parallelReduce`, each with a negative test, and admits it everywhere
   else.
   **As shipped.** A reference argument is passed as an arrow that calls it,
   so the callee is instantiated per call site rather than per set, and
   `functionArgs` holds that arrow, a checked function every reader already
   handles; the refusal covers `parallelMap`, a scope's `spawn`, `region` and
   `enterWith` as well (`tests/cases/reject_fnarg_ref_*`). A call through
   `F | null` needs a null test first (NL2740). A `Map` value is the element
   place of the `Map`'s value array, so no new place kind was needed; a call
   whose result has no place, `Map.get`, dispatches over every function of the
   type, which is sound and less precise: a `Map` whose type also has a
   function that keeps `p` makes that call a mixed set, refused by NL2736
   (`reject_fnref_place_set_map`), where an array of the same functions
   compiles (`fnref_place_set_nullable`, `fnref_place_set_arg`). A function-type `Map` key stays
   refused (`reject_fnref_map_key`), and NL2738 is retired.
3. **Stage 3 — capture-free arrows in value position**, lifted to a generated
   top-level function and then a reference. Capturing arrows stay refused.

`src/` uses none of them until the release after stage 1 (§5.4).

**The construct checklist, for stage 1**, item by item against
[ARCHITECTURE.md](ARCHITECTURE.md#how-to-add-a-construct) "How to add a
construct" and `CLAUDE.md`'s definition of done:

| Item | What it is for references |
| --- | --- |
| 1. Rule, lowering and TypeScript reading | §2 and §2.3; the expected `.ll` is §12.2's `@call`, renumbered from tag `1`, checked with `llvm-as` and `opt -passes=verify`; TypeScript reading **A**, identical (§5.1), so no `--emit-ts` translation or `tests/emit-ts/` fixture is required by the item; one is added all the same for `===` (§5.1) |
| 2. Parser and validator | no new syntax: a function type and a bare name already parse; the validator keeps `Function` refused |
| 3. Types | a function type outside a parameter: `llvmType` `i32`, `alignOf` 4, `assignable` by signature, the annotation resolver (`src/annotations.ts:224`); `src/interop-abi.ts`'s `cType` and `tsKeyword`, `src/interop-wasm.ts`'s `wasmType` and bridging decision, and `src/interop-napi.ts`'s readers and boxers each **refuse** it with `reject_fnref_ffi`'s code rather than leave it unmapped, since a type with no N-API row silently drops the function from the addon (§5.2); `src/debug.ts` the enumeration type (§5.3) |
| 4. Checker | pass-1 signature sets; the post-pass-2 per-place sets; the generated dispatchers and their `nodeCallees` record (§2.4); value-position names; reference calls; the §2.2 refusals and §2.1's zero-fill refusals (`new Array<S>(n)`, module storage); the `hostVisible` refusal (§5.2) |
| 5. Diagnostics | new NL codes in `src/codes.ts` for each §2.2 wording, the zero-fill refusals, `reject_fnref_ffi` and the escape-join refusal, each with a `tests/wordings/` program; the `performance`-class warning for a set past eight members; NL2336 and NL2334 reworded with their wordings programs, NL2337 retired |
| 6. Emitter | the generated dispatcher written as `$ref.S.p`, and the call lowering; named blocks (`sw.case.N`, `sw.default`) |
| 7. Runtime | none: no C symbol, so no `RuntimeTable` row and no budget move |
| 8. Attributes | none expected: the dispatcher is a checker-generated function, ordinary to the fact collector, and its facts are the join of its place's set. `fnref_escape_join` pins §4.2's A and B facts; `fnref_place_set` pins C's |
| 9. Tests | goldens `tests/cases/fnref_field`, `fnref_array`, `fnref_eq`, `fnref_escape_join`, `fnref_place_set` (`.ts`, `.ll`, `llvm-as`, `.out`); `reject_fnref_capture`, `reject_fnref_generic`, `reject_fnref_ffi` (a `declare function`, an open-world export, `--no-strict-exports`, a field reachable from a host-visible signature), `reject_fnref_print`, `reject_fnref_zero_fill`, `reject_fnref_rest`, `reject_fnref_async`, `reject_fnref_json`, `reject_fnref_escape_join` (case B's program); `fnref_debug_check` (the `--profile debug` dispatcher panics on a forged tag, the speed one has no check in its `.ll`); `tests/link/fnref_cross_module` (§2.3); `fnref_place_set` and `fnref_escape_join` also run at 10x their loop length with peak RSS pinned equal (§4.4); `tests/self/goldens/checked/` regenerated with `node tests/self/goldens.js --update`; each new positive case registered with `node tests/differential/goldens.js --update`; `tests/differential/emit-ts-known.txt` regenerated under the Node `.github/workflows/ci.yml` pins; `DECLARED` entries in `tests/nish-cmp.js` for the reworded diagnostics. Negatives that flip, each rewritten to the refusal that remains: `reject_fnarg_field`, `reject_fnarg_local`, `reject_fnarg_return_type`, `reject_fnarg_alias`, `reject_fnarg_store`, `reject_fnarg_return` (to a capturing arrow or a parameter bound to a named callee) and `reject_arrow_as_value` (to a capturing arrow); `reject_fnarg_not_name` flips in stage 2 |
| 10. Docs | the `docs/LANGUAGE.md` rule replacing "a function is not a value" (1585) and the function-type rules (3337, 3392, 3409), with test citations; a `docs/cookbook/` snippet with the dispatcher's IR and its marker in `docs/IR_COOKBOOK.md`, regenerated by `docs/cookbook/regen.sh` against `build/nish`; a `docs/guide/` page on function references with its route in `scalar.config.json`, and `docs/guide/language/functions.md:195` rewritten; §6's broken rows rewritten; `docs/reference/` regenerated with `node scripts/gen-reference.mjs`, since `docs/LANGUAGE.md` moves; the changelog is the commit message |
| 11. Security record | none: no `std/net` or `std/crypto` module, no `runtime/*.c` file and no builtin that reads the network, the terminal or another process. `docs/security/async.md:130`'s claim holds (§6) |

## 10. Risks

- **The join within a site's set** (§4.3, §8). Per-place sets confine it to
  the members a site can reach, and the escape-join refusal (§2.2) makes a
  site whose members disagree on keeping an argument a compile error, so the
  join can no longer move an object to the arena. What remains is that a
  program the refusal stops must call the keeping member directly or store
  it in another place.
- **A set of five or more members becomes a jump table**, an indirect branch
  again: seen at eight (§3.5), expected at five, not timed between (§7). Its
  cost grows with the set as a hand `switch`'s does: 1.92x and 6.41x
  **direct** at 16 and 32 members on a monomorphic stream, 4.60x and 12.37x
  on a periodic one (§4.4). A reference adds nothing to that, but a wide set
  is easy to reach by storing into a shared place, so stage 1 warns past
  eight members.
- **A per-place set wider than it needs to be — the remaining risk.** A
  place (§2.3) is a local, a parameter, a field declaration, an array or `Map`
  element type, or a function's return; it is not an allocation. The
  invariant per-place sets keep is: no program is slower than the same program
  with `i32` tags whose hand `switch` covers every member stored into the same
  declaration or element type — which is the dispatch that program would have
  to write, since it has no finer place to keep a tag in either. Case C
  is that site's hand program, measured (§4.3). The invariant says nothing
  against a hand programmer who uses a finer place than a declaration, and
  these are the gaps where a reference can lose to one:
  - two arrays or `Map`s of one element type share one set, so `u3` stored
    into a cold `S[]` joins the hot `S[]`'s dispatcher;
  - two objects of one class share each field's set, so one object holding
    `u3` widens the field for every object;
  - a parameter joins every caller's argument set;
  - the pass is flow-insensitive: a place that receives stores on two paths
    holds both sets on both;
  - a function's return is one place for every call of it.

  Against a program that knows which member reaches a call and calls it
  directly, a widened dispatcher would lose the stack proof, case B's 6.4x
  to 9.1x and 1.5 GB (§4.3), which the escape-join refusal turns into a
  compile error, and costs more per call as it grows (§4.4). The workaround is to keep the cold member out of the hot
  place — in its own field or local rather than a shared `S[]`. A widening
  that would mix keeping and non-keeping members is refused (§2.2) and names
  the store; one that only widens past eight members is warned (above). Per-alias sets (§11) are
  the fallback if a real program needs a site narrower than its declaration.
- **Compile-time cost.** Pass 1 now scans every value-position name, the
  per-place pass walks every store of a reference, and each distinct set gets
  a function. All are linear and small; none was measured.
- **Generic zero-fill where `T` is a function type.** `std/threads.ts:218`
  (`new Array<T>(blocks)`) zero-fills a generic array; instantiated at a
  function type, it is §2.1's refused zero-fill inside `std/`
  (`std/sort.ts`'s scratch array is already exempt, `src/arrays.ts:794`
  `isSortScratch`), where the user cannot fix it. `src/parallel.ts:925`
  already moves such a refusal (NL2520) from `std/threads.ts` to the user's
  call; stage 1 does the same for a reference `T`, or admits the `| null`
  instantiation instead.
- **A reference read the rules forgot.** Any read that exposes the tag
  (a new builtin that formats values, a `Map` key path, `JSON`, a container
  method that compares or prints its elements) would break §5.1's agreement.
  Every such read is refused by default because a reference admits only call,
  compare, store and pass; a new builtin or container method must opt in.
- **Pressure toward closures.** Once a field can hold `double`, a user will
  want it to hold `x => x * n`. The answer stays wp28's, and the diagnostic
  says why (§2.2).

## 11. Open

- Whether a program should be able to name a set: a per-*declared*-type-alias
  set, which keeps two aliases of one signature apart, is cheaper than the
  per-place pass and could serve as its fallback, or as an explicit way to
  narrow a place the pass makes too wide.
- Whether a reference may cross an external symbol for an `--emit-ts`
  library, where the JavaScript caller can only pass functions; this note
  refuses it (§5.2) for one rule across targets.
- The numbering is declaration order; whether a debugger or a
  `nish-cmp` diff would prefer a name-sorted order.
- Function-type aliases (`type Handler = (x: i32) => i32`) and containers of
  references other than arrays and `Map` values, such as `Set<Handler>`:
  whether a `Set` may hold tags, and whether an alias names a set (above), is
  left to stage 2.

## 12. Appendix: the programs

Every program below was generated into a temporary directory by a short
script, compiled with `build/nish` at `350bad84`, and never committed. The
`.ll` excerpts are verbatim, with `"probe-stack"="inline-asm"` left in the
attribute lines and the metadata kept.

### 12.1 The dispatch programs

`serial_k4_mixed.ts`, in full:

```ts
import { wrappingAdd, wrappingMul } from "nish:unsafe";

function t0(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 1103515245);
  return wrappingAdd((m >> 13) ^ m, 1);
}

function t1(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 22695477);
  return wrappingAdd((m >> 11) ^ m, 1);
}

function t2(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 1664525);
  return wrappingAdd((m >> 15) ^ m, 1);
}

function t3(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, 134775813);
  return wrappingAdd((m >> 9) ^ m, 1);
}

// The lowering under test: a switch over the closed set, a direct call per arm.
function call(tag: i32, x: i32, acc: i32): i32 {
  switch (tag) {
    case 0:
      return t0(x, acc);
    case 1:
      return t1(x, acc);
    case 2:
      return t2(x, acc);
    default:
      return t3(x, acc);
  }
}

function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    t.push((s ^ base) & 3);
  }
  return t;
}

function run(n: i32, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    acc = call(ts[i % 1024], i, acc);
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  console.log(`${run(400000000, ts)}`);
  return 0;
}
```

The other variants differ only where stated:

- **`K` members.** `t0..t{K-1}` with the multipliers `1103515245`,
  `22695477`, `1664525`, `134775813`, `214013`, `1103515243`, `69069`,
  `-1403630843` and the shifts `13, 11, 15, 9, 7, 17, 5, 19`; `call`'s
  `switch` has `case 0` to `case K-2` and `default` for the last member; the
  stream masks with `& (K - 1)`.
- **`K = 1`.** `call`'s body is `return t0(x, acc);` and nothing else.
- **same.** `t.push(base);` in place of `t.push((s ^ base) & (K - 1));`;
  `base` is `process.argv.length - 1`, which is `0`.
- **direct.** Only `t0`, no `call`; the loop is `acc = t0(i, acc);` (the tag
  array is still built, and not read).
- **array shape.** `run` and `main` become:

```ts
function run(rounds: i32, xs: i32[], ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let r: i32 = 0; r < rounds; r++) {
    for (let j: i32 = 0; j < xs.length; j++) {
      acc = call(ts[j], xs[j], acc);
    }
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  const xs: i32[] = [];
  for (let i: i32 = 0; i < 1024; i++) {
    xs.push(wrappingMul(i, 654435761) >> 3);
  }
  console.log(`${run(400000, xs, ts)}`);
  return 0;
}
```

  and **direct**'s inner statement is `acc = t0(xs[j], acc);`.

- **aperiodic (§3.4).** `rand_direct.ts` and `rand_k{2,4,8}_mixed.ts` keep
  the members and `call` of the serial programs and replace `run` and `main`
  with a xorshift32 loop; the tag is `(s >>> 24) & (K - 1)`, the low bits of the
  state's top byte, so no tag array is built. `genrand.mjs` wrote them from the serial programs; the `_ind`
  variants are §12.3's hand-edit of each:

```js
// The aperiodic stream: each call's tag is (s >>> 24) & (K - 1) of a xorshift32 state
// advanced in the loop (period 2^32 - 1), so no 1,024-call pattern exists to learn.
// Every variant, direct included, advances the same state and passes it as x.
import { writeFileSync, readFileSync } from "node:fs"
const src = readFileSync("serial_k8_mixed.ts", "utf8")
const fns = (k) => src.split("\n\n").filter((b) => b.startsWith("function t")).slice(0, k).join("\n\n")
const callOf = (k) => readFileSync(`serial_k${k}_mixed.ts`, "utf8").split("\n\n").find((b) => b.includes("function call("))
const run = (k) => `function run(n: i32, seed: i32): i32 {
  let acc: i32 = 1;
  let s: i32 = seed;
  for (let i: i32 = 0; i < n; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    acc = ${k === 0 ? "t0(s, acc)" : `call((s >>> 24) & ${k - 1}, s, acc)`};
  }
  return acc;
}

export function main(): i32 {
  console.log(\`\${run(400000000, 463534242 + process.argv.length)}\`);
  return 0;
}`
const head = `import { wrappingAdd, wrappingMul } from "nish:unsafe";\n\n`
writeFileSync("rand_direct.ts", head + fns(1) + "\n\n" + run(0) + "\n")
for (const k of [2, 4, 8]) writeFileSync(`rand_k${k}_mixed.ts`, head + fns(k) + "\n\n" + callOf(k) + "\n\n" + run(k) + "\n")
```

### 12.2 The `.ll` the compiler emitted for it

`build/nish serial_k4_mixed.ts -o serial_k4_mixed.ll`, the member, the
dispatcher and the loop:

```llvm
define internal noundef i32 @t0(i32 noundef %x, i32 noundef %acc) #0 {
entry:
  %m.addr = alloca i32, align 4
  %0 = mul i32 %x, 1103515245
  %1 = xor i32 %acc, %0
  store i32 %1, i32* %m.addr, align 4
  %2 = load i32, i32* %m.addr, align 4
  %3 = ashr i32 %2, 13
  %4 = load i32, i32* %m.addr, align 4
  %5 = xor i32 %3, %4
  %6 = add i32 %5, 1
  ret i32 %6
}

define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #0 {
entry:
  switch i32 %tag, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %0 = tail call i32 @t0(i32 %x, i32 %acc)
  ret i32 %0

sw.case.1:
  %1 = tail call i32 @t1(i32 %x, i32 %acc)
  ret i32 %1

sw.case.2:
  %2 = tail call i32 @t2(i32 %x, i32 %acc)
  ret i32 %2

sw.default:
  %3 = tail call i32 @t3(i32 %x, i32 %acc)
  ret i32 %3
}

define internal noundef i32 @run(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 1024
  %8 = sext i32 %7 to i64
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %8
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %acc.addr, align 4
  %15 = call i32 @call(i32 %12, i32 %13, i32 %14)
  store i32 %15, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = load i32, i32* %acc.addr, align 4
  ret i32 %18
}
attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
```

After `opt -O3` (what `--profile speed` runs before linking), the loop in
`nish_main`: the dispatcher and all four members are inlined, the bounds
check is gone, and one `switch` is left:

```llvm
bounds.ok.i:                                      ; preds = %push.store.i, %call.exit.i
  %i.addr.03.i = phi i32 [ %44, %call.exit.i ], [ 0, %push.store.i ]
  %acc.addr.02.i = phi i32 [ %common.ret.op.i.i3, %call.exit.i ], [ 1, %push.store.i ]
  %24 = and i32 %i.addr.03.i, 1023
  %25 = zext nneg i32 %24 to i64
  %26 = getelementptr inbounds i32, ptr %.val1, i64 %25
  %27 = load i32, ptr %26, align 4, !tbaa !18, !alias.scope !14, !noalias !11
  switch i32 %27, label %sw.default.i.i [
    i32 0, label %sw.case.i.i
    i32 1, label %sw.case.1.i.i
    i32 2, label %sw.case.2.i.i
  ]

sw.case.i.i:                                      ; preds = %bounds.ok.i
  %28 = mul i32 %i.addr.03.i, 1103515245
  %29 = xor i32 %28, %acc.addr.02.i
  %30 = ashr i32 %29, 13
  %31 = xor i32 %30, %29
  br label %call.exit.i

sw.case.1.i.i:                                    ; preds = %bounds.ok.i
  %32 = mul i32 %i.addr.03.i, 22695477
  %33 = xor i32 %32, %acc.addr.02.i
  %34 = ashr i32 %33, 11
  %35 = xor i32 %34, %33
  br label %call.exit.i

sw.case.2.i.i:                                    ; preds = %bounds.ok.i
  %36 = mul i32 %i.addr.03.i, 1664525
  %37 = xor i32 %36, %acc.addr.02.i
  %38 = ashr i32 %37, 15
  %39 = xor i32 %38, %37
  br label %call.exit.i

sw.default.i.i:                                   ; preds = %bounds.ok.i
  %40 = mul i32 %i.addr.03.i, 134775813
  %41 = xor i32 %40, %acc.addr.02.i
  %42 = ashr i32 %41, 9
  %43 = xor i32 %42, %41
  br label %call.exit.i

call.exit.i:                                      ; preds = %sw.default.i.i, %sw.case.2.i.i, %sw.case.1.i.i, %sw.case.i.i
  %common.ret.op.in.i.i = phi i32 [ %31, %sw.case.i.i ], [ %35, %sw.case.1.i.i ], [ %39, %sw.case.2.i.i ], [ %43, %sw.default.i.i ]
  %common.ret.op.i.i3 = add i32 %common.ret.op.in.i.i, 1
  %44 = add nuw nsw i32 %i.addr.03.i, 1
  %45 = icmp ult i32 %i.addr.03.i, 399999999
  br i1 %45, label %bounds.ok.i, label %run.exit
```

At `K = 8` (`serial_k8_mixed.ll` through `opt -O3`, then `llc`), the same
`switch` is a jump table: the tag is loaded, checked against the seven cases
and used as the index of an indirect branch.

```asm
	incl	%ecx
	movl	%ecx, %r15d
	andl	$1023, %r15d                    # imm = 0x3FF
	movl	(%rax,%r15,4), %r15d
	cmpq	$6, %r15
	ja	.LBB0_18
# %bb.10:                               # %bounds.ok.i
                                        #   in Loop: Header=BB0_9 Depth=1
	notrack		jmpq	*.LJTI0_0(,%r15,8)
```

### 12.3 The indirect variant: the hand-edit

`mkind.mjs` rewrote `@call` and added the table; the diff against §12.2's
file:

```diff
@@ -43,6 +43,8 @@
   ret i8* %grown
 }
 
+@wp51_fns = global [8 x i32 (i32, i32)*] [i32 (i32, i32)* @t0, i32 (i32, i32)* @t1, i32 (i32, i32)* @t2, i32 (i32, i32)* @t3, i32 (i32, i32)* null, i32 (i32, i32)* null, i32 (i32, i32)* null, i32 (i32, i32)* null], align 16
+
 define internal noundef i32 @t0(i32 noundef %x, i32 noundef %acc) #0 {
 entry:
   %m.addr = alloca i32, align 4
@@ -99,29 +101,13 @@
   ret i32 %6
 }
 
-define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #0 {
+define internal noundef i32 @call(i32 noundef %tag, i32 noundef %x, i32 noundef %acc) #2 {
 entry:
-  switch i32 %tag, label %sw.default [
-    i32 0, label %sw.case
-    i32 1, label %sw.case.1
-    i32 2, label %sw.case.2
-  ]
-
-sw.case:
-  %0 = tail call i32 @t0(i32 %x, i32 %acc)
-  ret i32 %0
-
-sw.case.1:
-  %1 = tail call i32 @t1(i32 %x, i32 %acc)
-  ret i32 %1
-
-sw.case.2:
-  %2 = tail call i32 @t2(i32 %x, i32 %acc)
-  ret i32 %2
-
-sw.default:
-  %3 = tail call i32 @t3(i32 %x, i32 %acc)
-  ret i32 %3
+  %ix = sext i32 %tag to i64
+  %slot = getelementptr inbounds [8 x i32 (i32, i32)*], [8 x i32 (i32, i32)*]* @wp51_fns, i64 0, i64 %ix
+  %fp = load i32 (i32, i32)*, i32 (i32, i32)** %slot, align 8
+  %r = call i32 %fp(i32 %x, i32 %acc)
+  ret i32 %r
 }
 
 define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @tags(i32 noundef %base) #1 {
```

The `@wp51_fns` line is the only part that depends on `K`; `mkind.mjs`
builds its entries as

```js
Array.from({ length: 8 }, (_, i) => i < k ? `i32 (i32, i32)* @t${i}` : "i32 (i32, i32)* null")
```

so every size has an eight-entry table whose first `K` entries are members.
The `.ll` defines the table; `wp51_fns.c`, linked beside the runtime (§3's
build line), declares it `extern`, and its `getenv` constructor's stores into
it are why link-time optimisation cannot treat it as constant:

```c
/* WP51 spike: owns the function table the indirect variant loads from.
   The constructor rewrites it only when WP51_SWAP is set (never, when timed),
   so link-time optimisation cannot treat the table as constant. */
#include <stdlib.h>
typedef int (*fn)(int, int);
extern fn wp51_fns[8];
__attribute__((constructor)) static void wp51_init(void) {
  if (getenv("WP51_SWAP")) { fn t = wp51_fns[0]; wp51_fns[0] = wp51_fns[1]; wp51_fns[1] = t; }
}
```

The file's first comment says it "owns" the table; it does not. The `extern`
line declares it, the `.ll` above defines it, and the constructor only stores
into it.

### 12.4 The escape programs

`esc_b_mixed.ts`, in full:

```ts
import { wrappingAdd, wrappingMul } from "nish:unsafe";

class P {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Keep {
  last: P | null = null;
}

function u0(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 3) ^ wrappingAdd(p.y, 1);
}

function u1(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 5) ^ wrappingAdd(p.y, 2);
}

function u2(p: P, k: Keep): i32 {
  return wrappingMul(p.x, 7) ^ wrappingAdd(p.y, 3);
}

function u3(p: P, k: Keep): i32 {
  k.last = p;
  return wrappingMul(p.x, 9) ^ wrappingAdd(p.y, 4);
}

// The lowering under test: a switch over the closed set, a direct call per arm.
function dispatch(tag: i32, p: P, k: Keep): i32 {
  switch (tag) {
    case 0:
      return u0(p, k);
    case 1:
      return u1(p, k);
    case 2:
      return u2(p, k);
    default:
      return u3(p, k);
  }
}

function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    t.push((s ^ base) & 3);
  }
  return t;
}

function run(n: i32, k: Keep, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const p = new P(i, acc);
    acc = wrappingAdd(dispatch(ts[i % 1024], p, k), 1);
  }
  return acc;
}

export function main(): i32 {
  const k = new Keep();
  const ts = tags(process.argv.length - 1);
  console.log(`${run(200000000, k, ts)}`);
  return 0;
}
```

- **A** drops `k.last = p;` from `u3`.
- **same** pushes `base` (`0`) in place of `(s ^ base) & 3`.
- **direct** is wp28 §11e's shape: only `u0`, no `dispatch`, no tag array,
  `run(n: i32, k: Keep)` with `acc = wrappingAdd(u0(p, k), 1);`.
- **C** (`esc_c_same`, `esc_c_mixed`) is what the per-place pass would emit
  for a hot place holding `{u0, u1, u2}` while `u3` is stored and called
  elsewhere. `genc.mjs` writes it from B's two files:

```js
// Writes WP51 escape case C: what a per-place pass would produce. The hot
// call's place holds {u0,u1,u2}; u3 escapes and is called at another site.
import { readFileSync, writeFileSync } from "node:fs"
for (const stream of ["same", "mixed"]) {
  let s = readFileSync(`esc_b_${stream}.ts`, "utf8")
  s = s.replace(/\/\/ The lowering under test[\s\S]*?\n}\n/, `// The hot place's dispatcher: its set is {u0, u1, u2}; u3 is not in it.
function dispatch(tag: i32, p: P, k: Keep): i32 {
  switch (tag) {
    case 0:
      return u0(p, k);
    case 1:
      return u1(p, k);
    default:
      return u2(p, k);
  }
}
`)
  s = s.replace("t.push((s ^ base) & 3);", "t.push(((s ^ base) & 0x7fffffff) % 3);")
  s = s.replace("console.log(`${run(200000000, k, ts)}`);", "const r = run(200000000, k, ts);\n  // u3 at another site: it escapes into k, once.\n  const e = u3(new P(r, 1), k);\n  console.log(`${r} ${e}`);")
  writeFileSync(`esc_c_${stream}.ts`, s)
}
```

### 12.5 The escape programs' `.ll`

The signatures §4.2 reads, verbatim:

```llvm
; direct
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #0 {
define noundef i32 @nish_main() #0 {
attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

; A (mixed; same is identical)
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @u3(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
define noundef i32 @nish_main() #2 {

; B (mixed; same is identical)
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @u3(%struct.P* noundef nonnull align 8 dereferenceable(8) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull align 8 dereferenceable(8) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
define noundef i32 @nish_main() #2 {
attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

; C (mixed; same is identical, attributes as above)
define internal noundef i32 @u0(%struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @u3(%struct.P* noundef nonnull align 8 dereferenceable(8) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
define noundef i32 @nish_main() #2 {
```

`u3` keeps B's facts and `dispatch` keeps A's: the join is over the place's
set, not the signature's. C's `dispatch`, and the two places it allocates `P`
— on `run`'s stack in the loop, in the arena once for the `u3` call:

```llvm
define internal noundef i32 @dispatch(i32 noundef %tag, %struct.P* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
entry:
  switch i32 %tag, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]
  ; ... each arm a direct call of u0, u1, u2 and its ret

; run
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  call void @P.constructor(%struct.P* %P.obj, i32 %6, i32 %7)

; nish_main, after run returns
  %arena.mark = call i64 @nish_arena_mark()
  %12 = call i8* @nish_alloc_struct(i64 8)
  %13 = bitcast i8* %12 to %struct.P*
  call void @P.constructor(%struct.P* %13, i32 %14, i32 1)
  %16 = call i32 @u3(%struct.P* %13, %struct.Keep* %15)
```

**direct** with `--no-stack-alloc` (`esc_direct_nostack`), the loop body of
`run`: `P` goes to the arena, and the offset is rewound every iteration.

```llvm
for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.P*
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %7, i32 %8, i32 %9)
  store %struct.P* %7, %struct.P** %p.addr, align 8
  %10 = load %struct.P*, %struct.P** %p.addr, align 8
  %11 = call i32 @u0(%struct.P* %10, %struct.Keep* %k)
  %12 = add i32 %11, 1
  store i32 %12, i32* %acc.addr, align 4
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %14 = load i8*, i8** %13, align 8
  %15 = icmp eq i8* %14, %3
  br i1 %15, label %pass.rewind, label %pass.free

pass.rewind:
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %16, align 8
  br label %pass.done

pass.free:
  %17 = ptrtoint i8* %3 to i64
  %18 = add i64 %17, %5
  call void @nish_arena_release(i64 %18)
  br label %pass.done
```

Where `Keep` is made, the first lines of `nish_main` in each program (the
`!tbaa` number differs between files and is the only other difference):

```llvm
; direct (esc_direct.ll)
define noundef i32 @nish_main() #0 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Keep, %struct.Keep* %Keep.obj, i32 0, i32 0
  store %struct.P* null, %struct.P** %0, align 8, !tbaa !8
  store %struct.Keep* %Keep.obj, %struct.Keep** %k.addr, align 8

; direct, --no-stack-alloc (esc_direct_nostack.ll): Keep goes to the arena
define noundef i32 @nish_main() #0 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Keep*

; A (esc_a_same.ll)
define noundef i32 @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %ts.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()

; B (esc_b_same.ll)
define noundef i32 @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %ts.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
```

`run` in **direct**, where `P` is made, its entry and loop body:

```llvm
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  ...
for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %2, i32 %3)
  store %struct.P* %P.obj, %struct.P** %p.addr, align 8
  %4 = load %struct.P*, %struct.P** %p.addr, align 8
  %5 = call i32 @u0(%struct.P* %4, %struct.Keep* %k)
  %6 = add i32 %5, 1
  store i32 %6, i32* %acc.addr, align 4
  br label %for.inc
```

`run` in A, where `P` is made:

```llvm
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %6, i32 %7)
  store %struct.P* %P.obj, %struct.P** %p.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = srem i32 %8, 1024
  %10 = sext i32 %9 to i64
  %11 = icmp ult i64 %10, %1
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %1)
  unreachable

bounds.ok:
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %10
  %14 = load i32, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %15 = load %struct.P*, %struct.P** %p.addr, align 8
  %16 = call i32 @dispatch(i32 %14, %struct.P* %15, %struct.Keep* %k)
  %17 = add i32 %16, 1
  store i32 %17, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i32, i32* %acc.addr, align 4
  ret i32 %20
}
```

`run` in B:

```llvm
define internal noundef i32 @run(i32 noundef %n, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ts) #2 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  store i32 1, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ts, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.P*
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %acc.addr, align 4
  call void @P.constructor(%struct.P* %7, i32 %8, i32 %9)
  store %struct.P* %7, %struct.P** %p.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = srem i32 %10, 1024
  %12 = sext i32 %11 to i64
  %13 = icmp ult i64 %12, %1
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %12, i64 %1)
  unreachable

bounds.ok:
  %14 = bitcast i8* %3 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %12
  %16 = load i32, i32* %15, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %17 = load %struct.P*, %struct.P** %p.addr, align 8
  %18 = call i32 @dispatch(i32 %16, %struct.P* %17, %struct.Keep* %k)
  %19 = add i32 %18, 1
  store i32 %19, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %acc.addr, align 4
  ret i32 %22
}
```

After `opt -O3`, the loop of `nish_main` in each (`run` inlined). **direct**,
six instructions and the branch:

```llvm
for.body.i:                                       ; preds = %for.body.i, %entry
  %acc.addr.02.i = phi i32 [ 1, %entry ], [ %3, %for.body.i ]
  %i.addr.01.i = phi i32 [ 0, %entry ], [ %4, %for.body.i ]
  %0 = mul nuw nsw i32 %i.addr.01.i, 3
  %1 = add i32 %acc.addr.02.i, 1
  %2 = xor i32 %0, %1
  %3 = add i32 %2, 1
  %4 = add nuw nsw i32 %i.addr.01.i, 1
  %5 = icmp ult i32 %i.addr.01.i, 199999999
  br i1 %5, label %for.body.i, label %run.exit
```

**A** (`esc_a_same`): the tag load, a `switch` into empty arms, and two phis
that pick each member's constants for one shared body; no allocation:

```llvm
bounds.ok.i:                                      ; preds = %push.store.i, %dispatch.exit.i
  %acc.addr.03.i = phi i32 [ %23, %dispatch.exit.i ], [ 1, %push.store.i ]
  %i.addr.02.i = phi i32 [ %24, %dispatch.exit.i ], [ 0, %push.store.i ]
  %16 = and i32 %i.addr.02.i, 1023
  %17 = zext nneg i32 %16 to i64
  %18 = getelementptr inbounds i32, ptr %.val1, i64 %17
  %19 = load i32, ptr %18, align 4, !tbaa !18, !alias.scope !14, !noalias !11
  switch i32 %19, label %sw.default.i.i [
    i32 0, label %dispatch.exit.i
    i32 1, label %sw.case.1.i.i
    i32 2, label %sw.case.2.i.i
  ]

sw.case.1.i.i:                                    ; preds = %bounds.ok.i
  br label %dispatch.exit.i

sw.case.2.i.i:                                    ; preds = %bounds.ok.i
  br label %dispatch.exit.i

sw.default.i.i:                                   ; preds = %bounds.ok.i
  br label %dispatch.exit.i

dispatch.exit.i:                                  ; preds = %sw.default.i.i, %sw.case.2.i.i, %sw.case.1.i.i, %bounds.ok.i
  %.sink.i.i = phi i32 [ 9, %sw.default.i.i ], [ 7, %sw.case.2.i.i ], [ 5, %sw.case.1.i.i ], [ 3, %bounds.ok.i ]
  %.sink2.i.i = phi i32 [ 4, %sw.default.i.i ], [ 3, %sw.case.2.i.i ], [ 2, %sw.case.1.i.i ], [ 1, %bounds.ok.i ]
  %20 = mul nuw nsw i32 %.sink.i.i, %i.addr.02.i
  %21 = add i32 %.sink2.i.i, %acc.addr.03.i
  %22 = xor i32 %21, %20
  %23 = add i32 %22, 1
  %24 = add nuw nsw i32 %i.addr.02.i, 1
  %25 = icmp ult i32 %i.addr.02.i, 199999999
  br i1 %25, label %bounds.ok.i, label %run.exit
```

**B** (`esc_b_same`): the same `switch` and phis, after an inline arena bump
for `P` and its two stores in every iteration; `k.last = p` was optimised away
with `u3`'s arm folded into the phis, and nothing releases the arena in the
loop:

```llvm
for.body.i2:                                      ; preds = %push.store.i, %dispatch.exit.i
  %acc.addr.03.i = phi i32 [ %24, %dispatch.exit.i ], [ 1, %push.store.i ]
  %i.addr.02.i = phi i32 [ %25, %dispatch.exit.i ], [ 0, %push.store.i ]
  %off.i.i3 = load i64, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 1), align 8
  %new.off.i.i4 = add i64 %off.i.i3, 8
  %cap.i.i5 = load i64, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 2), align 8
  %fits.not.i.i6 = icmp ugt i64 %new.off.i.i4, %cap.i.i5
  br i1 %fits.not.i.i6, label %slow.i.i12, label %fast.i.i7

fast.i.i7:                                        ; preds = %for.body.i2
  store i64 %new.off.i.i4, ptr getelementptr inbounds (%struct.nish_arena, ptr @nish_arena, i64 0, i32 1), align 8
  %buf.i.i8 = load ptr, ptr @nish_arena, align 8
  %obj.i.i9 = getelementptr inbounds i8, ptr %buf.i.i8, i64 %off.i.i3
  br label %bounds.ok.i

slow.i.i12:                                       ; preds = %for.body.i2
  %grown.i.i13 = tail call dereferenceable(8) ptr @nish_arena_grow(i64 8)
  br label %bounds.ok.i

bounds.ok.i:                                      ; preds = %fast.i.i7, %slow.i.i12
  %common.ret.op.i.i11 = phi ptr [ %obj.i.i9, %fast.i.i7 ], [ %grown.i.i13, %slow.i.i12 ]
  store i32 %i.addr.02.i, ptr %common.ret.op.i.i11, align 4, !tbaa !20, !alias.scope !23
  %16 = getelementptr inbounds %struct.P, ptr %common.ret.op.i.i11, i64 0, i32 1
  store i32 %acc.addr.03.i, ptr %16, align 4, !tbaa !26, !alias.scope !23
  ; ... the switch, the arms and the phis as in A
```

### 12.6 How it was run

```sh
build/nish <x>.ts -o <x>.ll                 # esc_direct also with --no-stack-alloc
llvm-as <x>.ll -o /dev/null                 # every .ll, the _ind ones included
scripts/build.sh <x>.ll runtime/runtime.c [wp51_fns.c] -o bin/<x> --profile speed
cp bin/serial_direct bin/serial_direct_copy # and array_, esc_, rand_: the noise band
python3 bench.py "$(cat groups.json)" 7     # best of 7, interleaved
node genc.mjs                               # case C (§12.4), then build as above
python3 bench.py '[["esc_direct", "esc_direct_copy", "esc_direct_nostack", "esc_a_same", "esc_a_mixed", "esc_b_same", "esc_b_mixed", "esc_c_same", "esc_c_mixed"]]' 7
python3 bench.py '[["esc_direct", "esc_direct_copy", "esc_direct_nostack", "esc_a_same", "esc_a_mixed", "esc_b_same", "esc_b_mixed", "esc_c_same", "esc_c_mixed"]]' 11
nproc; grep -m1 'model name' /proc/cpuinfo; free -g   # run 3: the same 11-round group
python3 bench.py '[["esc_direct", "esc_direct_copy", "esc_direct_nostack", "esc_a_same", "esc_a_mixed", "esc_b_same", "esc_b_mixed", "esc_c_same", "esc_c_mixed"]]' 11
node genrand.mjs                            # §3.4's group, then the steps above
python3 bench.py "$(cat groups_rand.json)" 7
```

The hosts, as §4.3 gives them: run 0 and §3 on an Intel Xeon @ 2.30GHz;
runs 1 and 2 on a container whose CPU model was not recorded; run 3 on one
that printed `4`, `Intel(R) Xeon(R) Processor @ 2.10GHz` and 15 GB.

`groups.json` and `groups_rand.json`:

```json
[["serial_direct", "serial_direct_copy", "serial_k1_same", "serial_k1_same_ind", "serial_k2_same", "serial_k2_same_ind", "serial_k2_mixed", "serial_k2_mixed_ind", "serial_k4_same", "serial_k4_same_ind", "serial_k4_mixed", "serial_k4_mixed_ind", "serial_k8_same", "serial_k8_same_ind", "serial_k8_mixed", "serial_k8_mixed_ind"], ["array_direct", "array_direct_copy", "array_k1_same", "array_k1_same_ind", "array_k2_same", "array_k2_same_ind", "array_k2_mixed", "array_k2_mixed_ind", "array_k4_same", "array_k4_same_ind", "array_k4_mixed", "array_k4_mixed_ind", "array_k8_same", "array_k8_same_ind", "array_k8_mixed", "array_k8_mixed_ind"], ["esc_direct", "esc_direct_copy", "esc_direct_nostack", "esc_a_same", "esc_a_mixed", "esc_b_same", "esc_b_mixed"]]
[["rand_direct","rand_direct_copy","rand_k2_mixed","rand_k2_mixed_ind","rand_k4_mixed","rand_k4_mixed_ind","rand_k8_mixed","rand_k8_mixed_ind"]]
```

`bench.py`:

```python
# WP51 spike runner: best of N, every variant run once per round (interleaved).
import os, subprocess, sys, time, resource, json
BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")
groups = json.loads(sys.argv[1]); rounds = int(sys.argv[2])
best, rss, outs = {}, {}, {}
for r in range(rounds):
    for g in groups:
        for v in g:
            t0 = time.perf_counter()
            p = subprocess.Popen([os.path.join(BIN, v)], stdout=subprocess.PIPE)
            out = p.stdout.read(); _, status, ru = os.wait4(p.pid, 0)
            dt = (time.perf_counter() - t0) * 1000
            assert status == 0, v
            best[v] = min(best.get(v, 1e18), dt); rss[v] = max(rss.get(v, 0), ru.ru_maxrss)
            outs.setdefault(v, set()).add(out.strip().decode())
    print(f"round {r + 1} done", flush=True)
for g in groups:
    print("--")
    for v in g:
        print(f"{v:28} {best[v]:9.0f} ms  {rss[v] // 1024:6d} MB  out={','.join(outs[v])}")
```

### 12.7 The linked loops, disassembled

What §3.1 and §3.5 argue from, from the linked `--profile speed` binaries:
`objdump -d --no-show-raw-insn <binary>`, the hot loop of `nish_main` only.
`0x41c64e6d` is `1103515245` (`t0`), `0x15a4e35` is `22695477` (`t1`).

**`K = 1`.** `serial_direct` and `serial_k1_same` disassemble byte-identical
(`diff` of the two whole `objdump -d` outputs is empty): no tag load and no
bounds check, so the **K = 1** row times **direct**'s loop. That loop is
unrolled four times; the multiply by the loop counter becomes a `lea` per
copy off a counter that steps by `0x71939b4`, four times `0x41c64e6d` mod
2^32:

```asm
1b10:	xor    %ecx,%esi
1b12:	mov    %esi,%edx
1b14:	sar    $0xd,%edx
1b17:	xor    %esi,%edx
1b19:	inc    %edx
1b1b:	lea    0x41c64e6d(%rcx),%esi
1b21:	xor    %edx,%esi
1b23:	mov    %esi,%edx
1b25:	sar    $0xd,%edx
1b28:	xor    %esi,%edx
1b2a:	inc    %edx
1b2c:	lea    -0x7c736326(%rcx),%esi
1b32:	xor    %edx,%esi
1b34:	mov    %esi,%edx
1b36:	sar    $0xd,%edx
1b39:	xor    %esi,%edx
1b3b:	inc    %edx
1b3d:	lea    -0x3aad14b9(%rcx),%edi
1b43:	xor    %edx,%edi
1b45:	mov    %edi,%esi
1b47:	sar    $0xd,%esi
1b4a:	xor    %edi,%esi
1b4c:	inc    %esi
1b4e:	add    $0x71939b4,%ecx
1b54:	add    $0xfffffffc,%eax
1b57:	jne    1b10
```

`array_direct`'s loop, unrolled twice:

```asm
1b70:	xor    %edx,%edx
1b80:	imul   $0x41c64e6d,(%rcx,%rdx,4),%edi
1b87:	xor    %esi,%edi
1b89:	mov    %edi,%esi
1b8b:	sar    $0xd,%esi
1b8e:	xor    %edi,%esi
1b90:	imul   $0x41c64e6d,0x4(%rcx,%rdx,4),%edi
1b98:	inc    %esi
1b9a:	xor    %esi,%edi
1b9c:	mov    %edi,%esi
1b9e:	sar    $0xd,%esi
1ba1:	xor    %edi,%esi
1ba3:	inc    %esi
1ba5:	add    $0x2,%rdx
1ba9:	cmp    $0x400,%rdx
1bb0:	jne    1b80
1bb2:	inc    %eax
1bb4:	cmp    $0x61a80,%eax
1bb9:	jne    1b70
```

`array_k1_same` runs the same instructions at `1c00`–`1c4a`, with `%rax` for
the base and `%ecx` for the outer counter; the one addition is a length check
hoisted before the loop, whose `jb` goes to the panic path:

```asm
1bd7:	mov    (%rbx),%rdi
1bda:	cmp    $0x400,%rdi
1be1:	jb     1f51
1be7:	mov    0x10(%rsp),%rax
1c00:	xor    %edx,%edx
1c10:	imul   $0x41c64e6d,(%rax,%rdx,4),%edi
1c35:	add    $0x2,%rdx
1c39:	cmp    $0x400,%rdx
1c40:	jne    1c10
1c42:	inc    %ecx
1c44:	cmp    $0x61a80,%ecx
1c4a:	jne    1c00
```

(The lines between `1c10` and `1c35` are `1b87`–`1ba3` above with `%rax` for
`%rcx`.) In the mixed serial loops below, with no unrolling, the multiply
becomes one `add` per member.

**`serial_k2_mixed`: one compare per call.** The tag is loaded with the
compare; the index is masked (`and $0x3ff`), so there is no bounds check.

```asm
1b30:	xor    %ecx,%esi              # t1's arm
1b32:	mov    %esi,%r8d
1b35:	sar    $0xb,%r8d
1b39:	xor    %r8d,%esi              # the arms join
1b3c:	inc    %esi
1b3e:	inc    %edi
1b40:	add    $0x41c64e6d,%edx
1b46:	add    $0x15a4e35,%ecx
1b4c:	cmp    $0x17d78400,%edi
1b52:	je     1b70
1b54:	mov    %edi,%r8d
1b57:	and    $0x3ff,%r8d
1b5e:	cmpl   $0x0,(%rax,%r8,4)      # tag == 0?
1b63:	jne    1b30
1b65:	xor    %edx,%esi              # t0's arm
1b67:	mov    %esi,%r8d
1b6a:	sar    $0xd,%r8d
1b6e:	jmp    1b39
```

**`serial_k4_mixed`: three compares per call.**

```asm
1b73:	mov    %r9d,%r10d
1b76:	and    $0x3ff,%r10d
1b7d:	mov    (%rax,%r10,4),%r10d    # the tag
1b81:	cmp    $0x2,%r10d
1b85:	je     1ba0                   # t2: sar $0xf
1b87:	cmp    $0x1,%r10d
1b8b:	je     1b40                   # t1: sar $0xb
1b8d:	test   %r10d,%r10d
1b90:	jne    1bb0                   # t3: sar $0x9
1b92:	xor    %edi,%esi              # t0
1b94:	mov    %esi,%r10d
1b97:	sar    $0xd,%r10d
1b9b:	jmp    1b49
```

**`serial_k2_mixed_ind`: the indirect call survives `-flto`.** One table
load and a `call *` per iteration, the callee not inlined:

```asm
1bf9:	lea    0x27f0(%rip),%r12      # the table the constructor fills
1c00:	mov    %ebx,%eax
1c02:	and    $0x3ff,%eax
1c07:	movslq (%r14,%rax,4),%rax     # the tag
1c0b:	mov    %ebx,%edi
1c0d:	call   *(%r12,%rax,8)
1c11:	mov    %eax,%esi
1c13:	inc    %ebx
1c15:	cmp    $0x17d78400,%ebx
1c1b:	jne    1c00
```

**The indirect same loops: one `call *` per iteration, at every `K`.**
`serial_k2_same_ind`:

```asm
1bce:	lea    0x27fb(%rip),%r12      # the table
1be0:	mov    %ebx,%eax
1be2:	and    $0x3ff,%eax
1be7:	movslq (%r14,%rax,4),%rax     # the tag
1beb:	mov    %ebx,%edi
1bed:	call   *(%r12,%rax,8)
1bf1:	mov    %eax,%esi
1bf3:	inc    %ebx
1bf5:	cmp    $0x17d78400,%ebx
1bfb:	jne    1be0
```

`serial_k4_same_ind`, the serial group's fastest indirect binary (427 ms), is the same
instructions at `1c3e` (`lea 0x27fb(%rip),%r12`) and `1c50`–`1c6b`, its
`call *(%r12,%rax,8)` at `1c5d`; `serial_k8_same_ind` is them again at `1d1e`
and `1d30`–`1d4b`, its `call *` at `1d3d`. The loop starts at 32 mod 64 at
`K = 2` (`1be0`) and at 16 mod 64 at `K = 4` (`1c50`): the layouts differ,
the instructions do not. `array_k4_same_ind`:

```asm
1d14:	lea    0x2845(%rip),%rbp      # the table
1d20:	mov    (%r15),%r14            # the array's length
1d23:	mov    0x10(%r15),%r15
1d27:	xor    %ebx,%ebx
1d30:	cmp    %rbx,%r14              # the bounds check
1d33:	je     2057
1d39:	movslq (%r15,%rbx,4),%rax     # the tag
1d3d:	mov    (%r12,%rbx,4),%edi
1d41:	call   *0x0(%rbp,%rax,8)
1d45:	mov    %eax,%esi
1d47:	inc    %rbx
1d4a:	cmp    $0x400,%rbx
1d51:	jne    1d30
1d53:	inc    %r13d
1d56:	cmp    $0x61a80,%r13d
1d5d:	mov    0x8(%rsp),%r15
1d62:	jne    1d20
```

The array group's two ends run these instructions too. `array_k2_same_ind`
has its table `lea` at `1ca4`, the outer loop at `1cb0`–`1cf2`, the inner
loop at `1cc0` (64-byte aligned) and its `call *0x0(%rbp,%rax,8)` at `1cd1`;
`array_k8_same_ind` has them at `1df4`, `1e00`–`1e42`, `1e10` (16 mod 64)
and `1e21`. Only the addresses move:

```asm
1e10:	cmp    %rbx,%r14              # array_k8_same_ind
1e13:	je     2137
1e19:	movslq (%r15,%rbx,4),%rax
1e1d:	mov    (%r12,%rbx,4),%edi
1e21:	call   *0x0(%rbp,%rax,8)
1e25:	mov    %eax,%esi
1e27:	inc    %rbx
1e2a:	cmp    $0x400,%rbx
1e31:	jne    1e10
```

**The aperiodic loops: branches, not selects.** `rand_k2_mixed` advances the
xorshift state and branches on bit 24 of it:

```asm
1a60:	imul   $0x15a4e35,%r12d,%ecx  # t1's arm
1a67:	xor    %edi,%ecx
1a69:	mov    %ecx,%edi
1a6b:	sar    $0xb,%edi
1a6e:	xor    %ecx,%edi
1a70:	inc    %edi
1a72:	dec    %eax
1a74:	je     1aaf
1a76:	mov    %r12d,%ecx             # xorshift32
1a79:	shl    $0xd,%ecx
1a7c:	xor    %r12d,%ecx
1a7f:	mov    %ecx,%edx
1a81:	shr    $0x11,%edx
1a84:	xor    %ecx,%edx
1a86:	mov    %edx,%r12d
1a89:	shl    $0x5,%r12d
1a8d:	xor    %edx,%r12d
1a90:	test   $0x1000000,%r12d       # the tag is bit 24
1a97:	jne    1a60
1a99:	imul   $0x41c64e6d,%r12d,%ecx # t0's arm
1aa0:	xor    %edi,%ecx
1aa2:	mov    %ecx,%edi
1aa4:	sar    $0xd,%edi
1aa7:	xor    %ecx,%edi
1aa9:	inc    %edi
1aab:	dec    %eax
1aad:	jne    1a76
```

`rand_k4_mixed` takes bits 24–25 and runs the same three-compare chain as
`serial_k4_mixed`:

```asm
1a90:	mov    %r12d,%ecx
1a93:	shr    $0x18,%ecx
1a96:	and    $0x3,%ecx
1a99:	cmp    $0x2,%ecx
1a9c:	je     1ac0
1a9e:	cmp    $0x1,%ecx
1aa1:	je     1a60
1aa3:	test   %ecx,%ecx
1aa5:	jne    1ad0
```

`rand_k8_mixed.ll` through `opt -O3`, then `llc`, is a jump table, as
`serial_k8_mixed` is (§12.2):

```asm
	shrl	$24, %edx
	andl	$7, %edx
	cmpl	$6, %edx
	ja	.LBB0_11
	notrack		jmpq	*.LJTI0_0(,%rdx,8)
```

**`serial_k8_mixed`, linked: the jump table's indirect branch is in the hot
loop** (§3.5). The excerpts from `llc` above show the `switch` lowered; this
is the executable, from `objdump -d`. The loop head at `1b80` advances the
eight members' state, `1bc5` to `1be0` loads the tag (`i & 1023`) and jumps
through the table, and every arm ends in `jmp 1b80`, so `notrack jmp *%r12`
runs once a call (three of the seven arms shown):

```asm
1b80:	xor    %r12d,%esi
1b83:	inc    %esi
1b85:	inc    %r14d
1b88:	add    $0xac564b05,%ebp
1b8e:	add    $0x41c64e6d,%ebx
1b94:	add    $0x15a4e35,%r11d
1b9b:	add    $0x19660d,%r10d
1ba2:	add    $0x8088405,%r9d
1ba9:	add    $0x343fd,%r8d
1bb0:	add    $0x41c64e6b,%edi
1bb6:	add    $0x10dcd,%ecx
1bbc:	cmp    $0x17d78400,%r14d
1bc3:	je     1c43
1bc5:	mov    %r14d,%r12d
1bc8:	and    $0x3ff,%r12d
1bcf:	mov    (%rax,%r12,4),%r12d
1bd3:	cmp    $0x6,%r12
1bd7:	ja     1c0a
1bd9:	movslq (%rdx,%r12,4),%r12
1bdd:	add    %rdx,%r12
1be0:	notrack jmp *%r12
1be4:	xor    %ebx,%esi
1be6:	mov    %esi,%r12d
1be9:	sar    $0xd,%r12d
1bed:	jmp    1b80
1bef:	xor    %r10d,%esi
1bf2:	mov    %esi,%r12d
1bf5:	sar    $0xf,%r12d
1bf9:	jmp    1b80
```

The other two `K = 8` mixed executables hold the same branch in their hot
loops: `notrack jmp *%r10` at `1c86` in `array_k8_mixed` and
`notrack jmp *%rdx` at `1ade` in `rand_k8_mixed`.

No dispatch loop shown above holds a `cmov`. The `cmovs` nearest each loop
is after it, in printing the result: `1b74` in `serial_k2_mixed`, `1ab3` in
`rand_k2_mixed`, `1c01` in `serial_k2_same_ind`.

**The escape loops (§4.3).** `run` is inlined into `nish_main` in each.
**direct** (`esc_direct`): `u0` folded to constants, `P` gone, unrolled five
times — about four instructions a call, all on the one `acc` chain:

```asm
18e0:	lea    -0xc(%rax),%ecx
18e3:	inc    %edi
18e5:	xor    %ecx,%edi
18e7:	lea    -0x9(%rax),%ecx
18ea:	add    $0x2,%edi
18ed:	xor    %ecx,%edi
18ef:	lea    -0x6(%rax),%ecx
18f2:	add    $0x2,%edi
18f5:	xor    %ecx,%edi
18f7:	lea    -0x3(%rax),%ecx
18fa:	add    $0x2,%edi
18fd:	xor    %ecx,%edi
18ff:	add    $0x2,%edi
1902:	xor    %eax,%edi
1904:	inc    %edi
1906:	add    $0xf,%eax
1909:	cmp    $0x23c3460c,%eax
190e:	jne    18e0
```

**A** (`esc_a_same`; `esc_a_mixed` is the same instructions): unrolled twice,
the tag loaded and compared, each arm's two constants picked with two
`cmovae` — about thirteen instructions a call, the load, `cmp` and `cmov` on
the chain into `imul`. This is the one loop in this section with a `cmov`
inside it:

```asm
1b10:	lea    -0x1(%rcx),%r9d
1b14:	mov    %r9d,%r8d
1b17:	and    $0x3fe,%r8d
1b1e:	mov    (%rax,%r8,4),%r10d     # the tag
1b22:	lea    0x1(%r10),%r8d
1b26:	cmp    $0x3,%r10d
1b2a:	lea    0x3(%r10,%r10,1),%r10d
1b2f:	cmovae %edx,%r10d             # u3's constants
1b33:	cmovae %edi,%r8d
1b37:	imul   %r9d,%r10d
1b3b:	add    %esi,%r8d
1b3e:	xor    %r10d,%r8d
1b41:	mov    %ecx,%esi
1b43:	and    $0x3ff,%esi
1b49:	mov    (%rax,%rsi,4),%esi
1b4c:	lea    0x1(%rsi),%r9d
1b50:	cmp    $0x3,%esi
1b53:	lea    0x3(%rsi,%rsi,1),%r10d
1b58:	cmovae %edx,%r10d
1b5c:	cmovae %edi,%r9d
1b60:	imul   %ecx,%r10d
1b64:	lea    (%r8,%r9,1),%esi
1b68:	inc    %esi
1b6a:	xor    %r10d,%esi
1b6d:	inc    %esi
1b6f:	add    $0x2,%ecx
1b72:	cmp    $0xbebc201,%ecx
1b78:	jne    1b10
```

**C** (`esc_c_same`): unrolled twice, each copy's constants picked by a
`test`/`cmp` branch chain over the tag, and no call or allocation in the
loop; the arena bump at `1c30` is the one `P` for `u3`, after it:

```asm
1b70:	mov    $0x1,%r9d
1b76:	imul   %edx,%r8d
1b7a:	add    %ebx,%edi
1b7c:	xor    %r8d,%edi
1b7f:	inc    %edi
1b81:	add    %r9d,%edi
1b84:	imul   %ecx,%esi
1b87:	xor    %edi,%esi
1b89:	mov    %esi,%ebx
1b8b:	inc    %ebx
1b8d:	add    $0x2,%ecx
1b90:	cmp    $0xbebc201,%ecx
1b96:	je     1c30                   # loop exit
1b9c:	lea    -0x1(%rcx),%edx
1b9f:	mov    %edx,%esi
1ba1:	and    $0x3fe,%esi
1ba7:	mov    (%rax,%rsi,4),%r9d     # the first copy's tag
1bab:	mov    $0x3,%esi
1bb0:	mov    $0x3,%r8d
1bb6:	mov    $0x1,%edi
1bbb:	test   %r9d,%r9d
1bbe:	je     1beb
1bc0:	cmp    $0x1,%r9d
1bc4:	jne    1be0
1bc6:	mov    $0x2,%edi
1bcb:	mov    $0x5,%r8d
1bd1:	jmp    1beb
1be0:	mov    $0x3,%edi
1be5:	mov    $0x7,%r8d
1beb:	mov    %ecx,%r9d
1bee:	and    $0x3ff,%r9d
1bf5:	mov    (%rax,%r9,4),%r9d     # the second copy's tag
1bf9:	test   %r9d,%r9d
1bfc:	je     1b70
1c02:	cmp    $0x1,%r9d
1c06:	jne    1c20
1c08:	mov    $0x2,%r9d
1c0e:	mov    $0x5,%esi
1c13:	jmp    1b76
1c20:	mov    $0x3,%r9d
1c26:	mov    $0x7,%esi
1c2b:	jmp    1b76
```

### 12.8 The safeguard programs (§4.4)

Generated into a temporary directory and never committed, like the rest.
`gen.mjs` writes the `default`- and `trap`-arm variants of §12.1's and
§12.4's programs and the sets of 16 and 32; its first eight multipliers and
shifts are §12.1's, so `K` up to eight is §3's program:

```js
// WP51 follow-up spike: the trap arm, sets of 16 and 32, and the escape cases.
import { writeFileSync } from "node:fs"
const MUL = [1103515245, 22695477, 1664525, 134775813, 214013, 1103515243, 69069, -1403630843]
const SHF = [13, 11, 15, 9, 7, 17, 5, 19]
for (let i = 8; i < 32; i++) {
  // Odd multipliers past the doc's eight, deterministic.
  MUL.push((Math.imul(i * 2654435761 >>> 0, 40503) | 1) | 0)
  SHF.push(5 + (i * 7) % 15)
}
const head = `import { wrappingAdd, wrappingMul } from "nish:unsafe";\n\n`
const fn = (i) => `function t${i}(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ wrappingMul(x, ${MUL[i]});
  return wrappingAdd((m >> ${SHF[i]}) ^ m, 1);
}`
const fns = (k) => Array.from({ length: k }, (_, i) => fn(i)).join("\n\n")
// dflt: the last member is the default arm. trap: every member is a case, any other tag panics.
const call = (k, arm) => {
  const cases = []
  const last = arm === "trap" ? k : k - 1
  for (let i = 0; i < last; i++) cases.push(`    case ${i}:\n      return t${i}(x, acc);`)
  cases.push(arm === "trap" ? `    default:\n      panic("tag outside the set");` : `    default:\n      return t${k - 1}(x, acc);`)
  return `function call(tag: i32, x: i32, acc: i32): i32 {\n  switch (tag) {\n${cases.join("\n")}\n  }\n}`
}
const tags = (k, stream) => `function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    ${stream === "same" ? "t.push(base);" : `t.push((s ^ base) & ${k - 1});`}
  }
  return t;
}`
const serialRun = (k) => `function run(n: i32, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    acc = ${k === 0 ? "t0(i, acc)" : "call(ts[i % 1024], i, acc)"};
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  console.log(\`\${run(400000000, ts)}\`);
  return 0;
}`
const arrayRun = (k) => `function run(rounds: i32, xs: i32[], ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let r: i32 = 0; r < rounds; r++) {
    for (let j: i32 = 0; j < xs.length; j++) {
      acc = ${k === 0 ? "t0(xs[j], acc)" : "call(ts[j], xs[j], acc)"};
    }
  }
  return acc;
}

export function main(): i32 {
  const ts = tags(process.argv.length - 1);
  const xs: i32[] = [];
  for (let i: i32 = 0; i < 1024; i++) {
    xs.push(wrappingMul(i, 654435761) >> 3);
  }
  console.log(\`\${run(400000, xs, ts)}\`);
  return 0;
}`
const randRun = (k) => `function run(n: i32, seed: i32): i32 {
  let acc: i32 = 1;
  let s: i32 = seed;
  for (let i: i32 = 0; i < n; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    acc = ${k === 0 ? "t0(s, acc)" : `call((s >>> 24) & ${k - 1}, s, acc)`};
  }
  return acc;
}

export function main(): i32 {
  console.log(\`\${run(400000000, 463534242 + process.argv.length)}\`);
  return 0;
}`
const w = (name, s) => writeFileSync(`${name}.ts`, s + "\n")
for (const shape of ["serial", "array"]) {
  const run = shape === "serial" ? serialRun : arrayRun
  w(`${shape}_direct`, head + fns(1) + "\n\n" + tags(2, "same") + "\n\n" + run(0))
  for (const k of [2, 4, 8, 16, 32]) for (const stream of ["same", "mixed"]) for (const arm of ["dflt", "trap"]) {
    if (shape === "array" && k > 8) continue
    w(`${shape}_k${k}_${stream}_${arm}`, head + fns(k) + "\n\n" + call(k, arm) + "\n\n" + tags(k, stream) + "\n\n" + run(k))
  }
}
w("rand_direct", head + fns(1) + "\n\n" + randRun(0))
for (const k of [2, 4, 8, 16, 32]) for (const arm of ["dflt", "trap"])
  w(`rand_k${k}_mixed_${arm}`, head + fns(k) + "\n\n" + call(k, arm) + "\n\n" + randRun(k))

// Escape: A (no member keeps p), B (u3 keeps p, in the hot set), C (u3 kept out of the hot set).
const escHead = `import { wrappingAdd, wrappingMul } from "nish:unsafe";

class P {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Keep {
  last: P | null = null;
}
`
const u = (i, keeps) => `function u${i}(p: P, k: Keep): i32 {
${keeps ? "  k.last = p;\n" : ""}  return wrappingMul(p.x, ${3 + 2 * i}) ^ wrappingAdd(p.y, ${i + 1});
}`
const dispatch = (n, arm) => {
  const cases = []
  const last = arm === "trap" ? n : n - 1
  for (let i = 0; i < last; i++) cases.push(`    case ${i}:\n      return u${i}(p, k);`)
  cases.push(arm === "trap" ? `    default:\n      panic("tag outside the set");` : `    default:\n      return u${n - 1}(p, k);`)
  return `function dispatch(tag: i32, p: P, k: Keep): i32 {\n  switch (tag) {\n${cases.join("\n")}\n  }\n}`
}
const escTags = (n, stream) => `function tags(base: i32): i32[] {
  const t: i32[] = [];
  let s: i32 = 463534242;
  for (let i: i32 = 0; i < 1024; i++) {
    s = s ^ (s << 13);
    s = s ^ (s >>> 17);
    s = s ^ (s << 5);
    ${stream === "same" ? "t.push(base);" : n === 4 ? "t.push((s ^ base) & 3);" : "t.push(((s ^ base) & 0x7fffffff) % 3);"}
  }
  return t;
}`
const escRun = (tail) => `function run(n: i32, k: Keep, ts: i32[]): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const p = new P(i, acc);
    acc = wrappingAdd(dispatch(ts[i % 1024], p, k), 1);
  }
  return acc;
}

export function main(): i32 {
  const k = new Keep();
  const ts = tags(process.argv.length - 1);
${tail}
  return 0;
}`
w("esc_direct", escHead + "\n" + u(0, false) + `

function run(n: i32, k: Keep): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const p = new P(i, acc);
    acc = wrappingAdd(u0(p, k), 1);
  }
  return acc;
}

export function main(): i32 {
  const k = new Keep();
  console.log(\`\${run(200000000, k)}\`);
  return 0;
}`)
const us = (keep3) => [0, 1, 2, 3].map((i) => u(i, i === 3 && keep3)).join("\n\n")
for (const stream of ["same", "mixed"]) {
  for (const arm of ["dflt", "trap"]) {
    w(`esc_a_${stream}_${arm}`, escHead + "\n" + us(false) + "\n\n" + dispatch(4, arm) + "\n\n" + escTags(4, stream) + "\n\n" + escRun("  console.log(`${run(200000000, k, ts)}`);"))
    w(`esc_c_${stream}_${arm}`, escHead + "\n" + us(true) + "\n\n" + dispatch(3, arm) + "\n\n" + escTags(3, stream) + "\n\n" +
      escRun("  const r = run(200000000, k, ts);\n  // u3 at another site: it keeps p, once.\n  const e = u3(new P(r, 1), k);\n  console.log(`${r} ${e}`);"))
  }
  w(`esc_b_${stream}_dflt`, escHead + "\n" + us(true) + "\n\n" + dispatch(4, "dflt") + "\n\n" + escTags(4, stream) + "\n\n" + escRun("  console.log(`${run(200000000, k, ts)}`);"))
}
```

`gen2.mjs` writes the **guard** variants and the set of one from those:

```js
// Variants: guard (one range check, then the default-arm switch) and K = 1.
import { readFileSync, writeFileSync } from "node:fs"
const guardCall = (src, k, fname, args) => src.replace(/function (call|dispatch)\(tag: i32, ([^)]*)\): i32 \{\n  switch \(tag\) \{/, (m, n, params) =>
  `function ${n}(tag: i32, ${params}): i32 {\n  if (tag < 0 || tag > ${k - 1}) {\n    panic("tag outside the set");\n  }\n  switch (tag) {`)
for (const [base, k] of [["serial_k4_mixed", 4], ["serial_k8_mixed", 8], ["serial_k8_same", 8], ["serial_k4_same", 4], ["array_k4_mixed", 4], ["array_k8_mixed", 8], ["rand_k4_mixed", 4], ["rand_k8_mixed", 8], ["esc_a_same", 4], ["esc_a_mixed", 4], ["esc_c_same", 3], ["esc_c_mixed", 3]]) {
  const src = readFileSync(`${base}_dflt.ts`, "utf8")
  const out = guardCall(src, k)
  if (out === src) throw new Error(base)
  writeFileSync(`${base}_guard.ts`, out)
}
// K = 1: the set of one. dflt: a direct call, the tag never read. guard: the tag checked once.
const d = readFileSync("serial_direct.ts", "utf8")
const k1 = (body) => d.replace("acc = t0(i, acc);", "acc = call(ts[i % 1024], i, acc);").replace("function tags", `function call(tag: i32, x: i32, acc: i32): i32 {\n${body}\n}\n\nfunction tags`)
writeFileSync("serial_k1_same_dflt.ts", k1("  return t0(x, acc);"))
writeFileSync("serial_k1_same_guard.ts", k1(`  if (tag !== 0) {\n    panic("tag outside the set");\n  }\n  return t0(x, acc);`))
```

`gen3.mjs` writes the leak programs, each at four loop lengths:

```js
// Leak tests: each variant at three loop lengths (peak RSS must not grow with n),
// and a short one for valgrind's leak check.
import { readFileSync, writeFileSync } from "node:fs"
const esc = ["esc_direct", "esc_a_mixed_dflt", "esc_a_mixed_guard", "esc_c_mixed_dflt", "esc_c_mixed_guard", "esc_b_mixed_dflt"]
const ser = ["serial_direct", "serial_k4_mixed_dflt", "serial_k4_mixed_guard", "serial_k8_mixed_dflt", "serial_k8_mixed_guard", "serial_k1_same_guard"]
const scale = { esc: [["s", 2000000], ["m", 20000000], ["l", 200000000], ["v", 200000]], serial: [["s", 4000000], ["m", 40000000], ["l", 400000000], ["v", 400000]] }
for (const [list, full, kind] of [[esc, "200000000", "esc"], [ser, "400000000", "serial"]]) {
  for (const b of list) {
    const src = readFileSync(`${b}.ts`, "utf8")
    if (!src.includes(`run(${full}`)) throw new Error(b)
    for (const [tag, n] of scale[kind]) writeFileSync(`leak/${b}_${tag}.ts`, src.replace(`run(${full}`, `run(${n}`))
  }
}
```

The runner. It differs from §12.6's in rotating the order each round and in
reading peak RSS from `wait4` per run:

```python
# WP51 follow-up runner: best of N, every variant run once per round (interleaved,
# order rotated each round), wall time and peak RSS per run, stdout checked stable.
import json, os, subprocess, sys, time
groups = json.loads(sys.argv[1]); rounds = int(sys.argv[2])
res = {}
for g in groups:
    for r in range(rounds):
        order = g[r % len(g):] + g[:r % len(g)]
        for b in order:
            t0 = time.perf_counter()
            p = subprocess.Popen(["./bin/" + b], stdout=subprocess.PIPE)
            out = p.stdout.read().decode().strip()
            _, status, ru = os.wait4(p.pid, 0)
            dt = (time.perf_counter() - t0) * 1000
            e = res.setdefault(b, {"ms": [], "rss_kb": 0, "out": out})
            assert status == 0, (b, status)
            assert e["out"] == out, (b, e["out"], out)
            e["ms"].append(dt); e["rss_kb"] = max(e["rss_kb"], ru.ru_maxrss)
        print(f"group {groups.index(g)} round {r + 1}/{rounds}", flush=True)
for b, e in res.items():
    e["best"] = min(e["ms"])
json.dump(res, open(sys.argv[3] if len(sys.argv) > 3 else "results.json", "w"), indent=1)
print("done")
```

How it was run, with `N=build/seed/bin/nish` (0.38.0):

```sh
node gen.mjs && node gen2.mjs && node gen3.mjs
$N <x>.ts --link bin/<x> --profile speed -o ll/<x>.ll   # every program, leak/ too
llvm-as ll/<x>.ll -o /dev/null                          # every .ll
cp bin/<g>_direct bin/<g>_direct_copy                   # serial, array, rand, esc: the bands
python3 bench.py "$(cat groups.json)" 11                # run 4: every variant of gen.mjs
python3 bench.py "$(cat groups2.json)" 11 results2.json # run 5: default, trap and guard
valgrind --leak-check=full --show-leak-kinds=all leak/bin/<x>_v
```

`groups.json` holds four groups, each `<g>_direct`, its copy and every
variant of that shape; `groups2.json` the same baselines with the `default`,
`trap` and `guard` triples of §4.4's first table and the `K = 1` pair.
