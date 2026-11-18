// The compact-class rule: which classes docs/wp48-ref32-classes.md §3.1 would
// make compact, and why each other class is left alone. `--explain-layout`
// prints it (`Compilation.explainLayoutText`); nothing else reads it yet, so
// it changes no byte of the IR. The stage that narrows the classes it picks
// reads the same answer.
//
// A class `R` is compact when five tests hold, asked in order, and the first
// that fails is the reason it is not:
//
//   1. the output is a native executable: a closed-world build
//      (`buildModeOf` in `src/visibility.ts`), which `--link` and `nish run`
//      make unless a wasm target, a sidecar (`--emit-header`, `--emit-napi`,
//      `--emit-napi-async`, `--emit-dts`) or a `declare function` opens it;
//      `--emit-ts` writes TypeScript and no IR, so it is refused as well;
//   2. some class, `R` included, has a field typed exactly `R` or `R | null`;
//   3. narrowing those fields to four bytes (`narrowedSize`) shrinks `R` or a
//      class holding the link, after rounding;
//   4. some `new R(...)` is lexically inside a loop, or inside a function that
//      reaches itself through direct calls by name;
//   5. nothing forbids it: `R` is not a `declare class` and holds no `Secret`.
//
// Test 1 refuses a bare `-o x.ll` build: a host may link that IR, and its
// exports are then the host's to call with any object. A `declare function` is
// the "C library" case: the link takes a library this compiler did not build,
// which may be handed a class. A refusal names the first flag that opens the
// build, and `no --link` or `a declare function` when no flag does.
// `--emit-dts` is refused on its own though the loader it writes is for a wasm
// build (`rejectRootInWasiLoader`): a native compile still accepts the flag
// and writes the `.d.ts`, whose reads follow the layouts.
//
// Test 5's third clause, "not exported in a C or N-API surface", has no case of
// its own: a native build hands C a class's layout only through
// `--emit-header`, an N-API shim or a `declare function`, which test 1
// already refuses. Being "a field
// of a `declare class`" is the same case as being one, since a `declare class`
// holds no other class.
//
// Test 4 reads the parsed bodies, not the checked ones, because the stage that
// uses the answer settles layouts before any body is checked
// (`src/structs.ts`): a call by name to a function, `this.m(...)` in a method
// and `new C(...)`'s constructor are edges; a call through a value is not,
// and neither is a call by a name a parameter or local of the caller shadows.
// A generic function or method is one node per instantiation (`build<i32>`),
// and the body names it as written (`build`), so both sides are keyed by the
// name with its type arguments dropped. Nish has no `static` member and no
// inheritance (docs/LANGUAGE.md), so `T.m()` and an inherited `this.m()` have
// no case to cover.
//
// A generic class is asked about once per instantiation (`Box<i32>`), which
// is a candidate `R` like any class: its fields, monomorphised, are links for
// test 2 and holders for test 3 when typed exactly that instantiation or it
// `| null`. A template no code instantiates has no layout, and no line. An
// instantiation is reported once, at its template's declaration, under the
// module that declares the template, though every module that names it holds
// it. A `new Box<T>(...)` or `new Box(...)` is a made-site and a constructor
// edge: the body is read before any type argument is settled, so the site
// names the template and counts for each of its instantiations. Test 4 then
// over-counts an instantiation made once beside one made in a loop; test 4
// picks where narrowing pays, and a wrong yes costs a decode, not
// correctness. Test 5
// reads a field's own type (`holdsSecret`): a `Secret<T>`, or an array,
// nullable or `Result` of one; a field holding a class that holds a `Secret`
// is not looked into.

import { isLoopKind } from "./escape"
import { StringMap } from "./map"
import { Node, NodeKind } from "./nodes"
import { Options } from "./options"
import { CheckedProgram, FunctionSig, STRUCT_CLASS, StructInfo } from "./program"
import { StringBuilder } from "./strings"
import { isLinkTo, narrowedSize } from "./structs"
import { TypeTable } from "./types"
import { buildModeOf, isWasmBuild } from "./visibility"

/** One module the report covers, and whether it is a standard-library one. */
export class LayoutModule {
  program: CheckedProgram
  std: boolean

  constructor(program: CheckedProgram, std: boolean) {
    this.program = program
    this.std = std
  }
}

/** One function of the call graph: where its body is and what it calls. */
class CallNode {
  key: string
  program: CheckedProgram
  owner: StructInfo | null
  body: Node
  /** Indices of the functions this one calls by name. */
  calls: i32[]
  /** Every parameter and local name declared in it: a call through one of them is a call through a value. */
  shadowed: StringMap
  /** Tarjan's numbering: the visit order, the lowest it reaches, and whether it is on the stack. */
  index: i32
  low: i32
  onStack: boolean
  /** It reaches itself: a member of a cycle, or a function that calls itself. */
  recursive: boolean

  constructor(key: string, program: CheckedProgram, owner: StructInfo | null, body: Node) {
    this.key = key
    this.program = program
    this.owner = owner
    this.body = body
    this.calls = []
    this.shadowed = new StringMap()
    this.index = -1
    this.low = -1
    this.onStack = false
    this.recursive = false
  }
}

/**
 * A `new R(...)`: the class as written (`classKey`), the function it is in,
 * and whether a loop encloses it there.
 */
class MadeSite {
  key: string
  fn: i32
  inLoop: boolean

  constructor(key: string, fn: i32, inLoop: boolean) {
    this.key = key
    this.fn = fn
    this.inLoop = inLoop
  }
}

/** The whole program's call graph and `new` sites, read from the parsed bodies. */
class CallGraph {
  nodes: CallNode[]
  /** `CallNode.key` -> index into `nodes`. */
  byKey: StringMap
  sites: MadeSite[]
  stack: i32[]
  counter: i32

  constructor() {
    this.nodes = []
    this.byKey = new StringMap()
    this.sites = []
    this.stack = []
    this.counter = 0
  }
}

/**
 * `name` without its type arguments: `Box<i32>.pick<string>` is `Box.pick`.
 * A generic function's instantiations are named with their arguments, and a
 * call names the template, so both are keyed by what the source wrote.
 */
const writtenName = (name: string): string => {
  if (name.indexOf("<") < 0) {
    return name
  }
  const out = new StringBuilder()
  let depth = 0
  let i = 0
  while (i < name.length) {
    const c = name.charCodeAt(i)
    if (c === 60) {
      depth = depth + 1
    } else if (c === 62 && depth > 0) {
      depth = depth - 1
    } else if (depth === 0) {
      out.addChar(c)
    }
    i = i + 1
  }
  return out.toText()
}

/** The key a function is found by: its module's path and its name as written (`Owner.method` for a member). */
const functionKey = (sig: FunctionSig): string => {
  const origin = sig.origin
  const name = writtenName(sig.sourceName)
  return origin === null ? `#${name}` : `${origin.path}#${name}`
}

/**
 * The key of a class as written, without its type arguments: its module's
 * path and its name. A generic class's instance is named by its symbol
 * (`Box$i32`), so its template gives the written name, and every
 * instantiation of one template shares the template's key.
 */
const classKey = (info: StructInfo): string => {
  const instance = info.instance
  const name = instance === null ? info.name : instance.template.sourceName
  return `${info.origin.path}#${name}`
}

/** The key of `owner`'s member `member`, as `classKey` writes the class. */
const memberKey = (owner: StructInfo, member: string): string => `${classKey(owner)}.${member}`

/** The block a declaration's body is: a constructor's second child, any other function's fourth. */
const functionBodyOf = (decl: Node): Node | null => {
  if (decl.kind === NodeKind.Constructor) {
    return decl.children.length > 1 ? decl.children[1] : null
  }
  return decl.children.length > 3 ? decl.children[3] : null
}

/**
 * Record in `names` every parameter and variable `node` declares, at any depth
 * (a nested arrow's included). Over-collecting only drops an edge, which is a
 * miss the rule allows; keeping a shadowed name would add an edge that is not
 * there.
 */
const shadowingNames = (names: StringMap, node: Node): void => {
  if ((node.kind === NodeKind.Param || node.kind === NodeKind.VarDecl) && node.children.length > 0) {
    const name = node.children[0]
    if (name.kind === NodeKind.Ident) {
      names.set(name.text, 1)
    }
  }
  for (const child of node.children) {
    shadowingNames(names, child)
  }
}

/** Every function the program's own modules define, once each, with its body. */
const collectFunctions = (graph: CallGraph, modules: LayoutModule[]): void => {
  for (const module of modules) {
    const program = module.program
    for (const sig of program.functions) {
      const origin = sig.origin
      if (origin === null || origin !== program.source || sig.foreign()) {
        continue
      }
      const body = functionBodyOf(sig.decl)
      if (body === null) {
        continue
      }
      const key = functionKey(sig)
      if (graph.byKey.has(key)) {
        continue
      }
      graph.byKey.set(key, graph.nodes.length)
      const node = new CallNode(key, program, sig.owner, body)
      shadowingNames(node.shadowed, sig.decl)
      graph.nodes.push(node)
    }
  }
}

/** The function `callee` names by itself in `program`: its own, or the one an import binds. */
const calleeIndex = (graph: CallGraph, self: CallNode, callee: Node): i32 => {
  const program = self.program
  const owner = self.owner
  if (callee.kind === NodeKind.Ident) {
    if (self.shadowed.has(callee.text)) {
      return -1
    }
    for (const binding of program.imports) {
      const sig = binding.sig
      if (binding.localName === callee.text && sig !== null) {
        return graph.byKey.get(functionKey(sig), -1)
      }
    }
    return graph.byKey.get(`${program.source.path}#${callee.text}`, -1)
  }
  if (callee.kind === NodeKind.Member && owner !== null && callee.children[0].kind === NodeKind.This) {
    return graph.byKey.get(memberKey(owner, callee.text), -1)
  }
  return -1
}

/**
 * The `classKey` of what `new` builds when its callee is a name `program`
 * knows as a class or a generic class's template, else `""`. A template's key
 * is its instantiations' key, whatever type arguments the site writes.
 */
const madeClass = (program: CheckedProgram, node: Node): string => {
  const callee = node.children[0]
  if (callee.kind !== NodeKind.Ident) {
    return ""
  }
  const info = program.struct(callee.text)
  if (info !== null) {
    return classKey(info)
  }
  const template = program.structTemplate(callee.text)
  return template === null ? "" : `${template.origin.path}#${template.sourceName}`
}

/**
 * Walk `node`, a part of function `fn`'s body, recording its calls and its
 * `new` sites. `inLoop` says a loop of this function encloses it; a `for`'s
 * initializer and a `for...of`'s iterable run once, so they are outside it.
 */
const scanBody = (graph: CallGraph, fn: i32, node: Node, inLoop: boolean): void => {
  const self = graph.nodes[fn]
  if (node.kind === NodeKind.Call) {
    const callee = calleeIndex(graph, self, node.children[0])
    if (callee >= 0) {
      self.calls.push(callee)
    }
  } else if (node.kind === NodeKind.New) {
    const made = madeClass(self.program, node)
    if (made.length > 0) {
      graph.sites.push(new MadeSite(made, fn, inLoop))
      const ctor = graph.byKey.get(`${made}.constructor`, -1)
      if (ctor >= 0) {
        self.calls.push(ctor)
      }
    }
  }
  const loop = isLoopKind(node)
  let i = 0
  while (i < node.children.length) {
    const once = (node.kind === NodeKind.For && i === 0) || (node.kind === NodeKind.ForOf && i < 2)
    scanBody(graph, fn, node.children[i], inLoop || (loop && !once))
    i = i + 1
  }
}

/** Tarjan's strongly connected components from `v`, marking every function that reaches itself. */
const connect = (graph: CallGraph, v: i32): void => {
  const node = graph.nodes[v]
  node.index = graph.counter
  node.low = graph.counter
  graph.counter = graph.counter + 1
  graph.stack.push(v)
  node.onStack = true
  for (const w of node.calls) {
    const next = graph.nodes[w]
    if (w === v) {
      node.recursive = true
    }
    if (next.index < 0) {
      connect(graph, w)
      if (next.low < node.low) {
        node.low = next.low
      }
    } else if (next.onStack && next.index < node.low) {
      node.low = next.index
    }
  }
  if (node.low !== node.index) {
    return
  }
  const members: i32[] = []
  let top = -1
  while (top !== v) {
    top = graph.stack[graph.stack.length - 1]
    graph.stack.pop()
    graph.nodes[top].onStack = false
    members.push(top)
  }
  if (members.length > 1) {
    for (const member of members) {
      graph.nodes[member].recursive = true
    }
  }
}

/** The whole program's call graph, with each function's recursion settled, and every `new` site. */
const buildGraph = (modules: LayoutModule[]): CallGraph => {
  const graph = new CallGraph()
  collectFunctions(graph, modules)
  let i = 0
  while (i < graph.nodes.length) {
    scanBody(graph, i, graph.nodes[i].body, false)
    i = i + 1
  }
  i = 0
  while (i < graph.nodes.length) {
    if (graph.nodes[i].index < 0) {
      connect(graph, i)
    }
    i = i + 1
  }
  return graph
}

/** Whether `info` is a class a report line is about: a class, laid out whole. */
const reportable = (info: StructInfo): boolean => info.kind === STRUCT_CLASS && !info.poisoned

/**
 * Every generic class instantiation any of `modules` holds, once each by its
 * symbol, into `into`, and into `homes` the index of the module that declares
 * its template (or the first that holds it, when no module in the list does).
 */
const collectInstances = (modules: LayoutModule[], into: StructInfo[], homes: i32[]): void => {
  const seen = new StringMap()
  let m = 0
  while (m < modules.length) {
    for (const info of modules[m].program.structList) {
      if (info.instance === null || !reportable(info) || seen.has(info.name)) {
        continue
      }
      seen.set(info.name, 1)
      let home = m
      let h = 0
      while (h < modules.length) {
        if (modules[h].program.source === info.origin) {
          home = h
        }
        h = h + 1
      }
      into.push(info)
      homes.push(home)
    }
    m = m + 1
  }
}

/**
 * Appends every class a report line is about to `into`: each declared class
 * of module `m`, and each instantiation of `instances` whose template it
 * declares (`homes`), in the module's source order. An instantiation sits at
 * its template's declaration, after the classes declared before it.
 */
const collectClasses = (
  m: i32,
  program: CheckedProgram,
  instances: StructInfo[],
  homes: i32[],
  into: StructInfo[]
): void => {
  const first = into.length
  for (const info of program.structList) {
    if (info.origin === program.source && info.instance === null && reportable(info)) {
      into.push(info)
    }
  }
  let n = 0
  while (n < instances.length && n < homes.length) {
    if (homes[n] === m) {
      into.push(instances[n])
    }
    n = n + 1
  }
  // `structList` is in collection order; a report reads in source order.
  let i = first + 1
  while (i < into.length) {
    const item = into[i]
    let j = i
    while (j > first && j >= 1 && j < into.length && into[j - 1].decl.start > item.decl.start) {
      into[j] = into[j - 1]
      j = j - 1
    }
    if (j >= 0 && j < into.length) {
      into[j] = item
    }
    i = i + 1
  }
}

/** The class as a diagnostic spells it: `Node`, or an instantiation's `Box<i32>`. */
const displayName = (table: TypeTable, info: StructInfo): string =>
  info.instance === null ? info.name : table.typeName(info.type)

/** Test 1's refusal, the flag or target that makes the build not a native executable, or `""`. */
const notNative = (opts: Options, programs: CheckedProgram[]): string => {
  if (isWasmBuild(opts)) {
    return "wasm32"
  }
  if (opts.emitTs.length > 0) {
    return "--emit-ts"
  }
  if (opts.emitHeader.length > 0) {
    return "--emit-header"
  }
  if (opts.emitNapi.length > 0) {
    return "--emit-napi"
  }
  if (opts.emitNapiAsync.length > 0) {
    return "--emit-napi-async"
  }
  if (opts.emitDts.length > 0) {
    return "--emit-dts"
  }
  if (buildModeOf(opts, programs).closedWorld) {
    return ""
  }
  // With every other refusal of a closed build ruled out above, what is left
  // is the link itself: none was asked for, or a C library is in it.
  if (opts.link.length === 0) {
    return "no --link, so a host may link the IR"
  }
  return "a declare function, so a C library is in the link"
}

/** Whether any field of `info` links to the class whose pointer type is `target`. */
const linksTo = (table: TypeTable, info: StructInfo, target: i32): boolean => {
  for (const field of info.fields) {
    if (isLinkTo(table, field, target)) {
      return true
    }
  }
  return false
}

/** Test 5's refusal for `info`, or `""`. */
const forbidden = (table: TypeTable, info: StructInfo): string => {
  if (info.layout) {
    return "a declare class"
  }
  for (const field of info.fields) {
    if (table.holdsSecret(field.type)) {
      return `holds a Secret in ${field.name}`
    }
  }
  return ""
}

/** The counts the summary line reads. */
export class LayoutReport {
  text: string
  classes: i32
  picked: i32

  constructor(text: string, classes: i32, picked: i32) {
    this.text = text
    this.classes = classes
    this.picked = picked
  }
}

/**
 * The `--explain-layout` report over `modules`: one line per class, in module
 * order and each module's source order, saying `compact` or the first test
 * that refuses it, with its size now and narrowed, and a summary line.
 */
export const explainLayout = (opts: Options, table: TypeTable, modules: LayoutModule[]): LayoutReport => {
  const wasm = isWasmBuild(opts)
  // Every class in the program, each generic class's instantiations
  // included, for test 2's and test 3's scan of the holders, and the index of
  // the module each one is declared in.
  const instances: StructInfo[] = []
  const homes: i32[] = []
  collectInstances(modules, instances, homes)
  const all: StructInfo[] = []
  const owners: i32[] = []
  const programs: CheckedProgram[] = []
  let m = 0
  while (m < modules.length) {
    const program = modules[m].program
    programs.push(program)
    collectClasses(m, program, instances, homes, all)
    while (owners.length < all.length) {
      owners.push(m)
    }
    m = m + 1
  }
  const native = notNative(opts, programs)
  const graph = buildGraph(modules)
  // Each class's shown name and call-graph key are made once, before the
  // report loop, so no pass of that loop allocates a string it keeps.
  const names: string[] = []
  const keys: string[] = []
  for (const each of all) {
    names.push(displayName(table, each))
    keys.push(classKey(each))
  }
  const lines = new StringBuilder()
  let classes = 0
  let picked = 0
  let k = 0
  while (k < all.length && k < owners.length && k < names.length && k < keys.length) {
    const info = all[k]
    const module = modules[owners[k]]
    const source = module.program.source
    const shownName = names[k]
    const key = keys[k]
    k = k + 1
    {
      classes = classes + 1
      const after = narrowedSize(table, info, info.type, wasm)
      let linked = false
      let saver = after < info.size ? shownName : ""
      let saving = after < info.size ? `${info.size} → ${after}` : ""
      let h = 0
      while (h < all.length && h < names.length) {
        const holder = all[h]
        const holderName = names[h]
        h = h + 1
        if (!linksTo(table, holder, info.type)) {
          continue
        }
        linked = true
        if (saver.length === 0 && holder !== info) {
          const narrowed = narrowedSize(table, holder, info.type, wasm)
          if (narrowed < holder.size) {
            saver = holderName
            saving = `${holder.size} → ${narrowed}`
          }
        }
      }
      let made = false
      for (const site of graph.sites) {
        if (site.key === key && (site.inLoop || graph.nodes[site.fn].recursive)) {
          made = true
        }
      }
      const forbids = forbidden(table, info)
      let verdict = "compact"
      if (native.length > 0) {
        verdict = `1 native: ${native}`
      } else if (!linked) {
        verdict = "2 no link"
      } else if (saver.length === 0) {
        verdict = "3 no saving"
      } else if (!made) {
        verdict = "4 not made in a loop or recursion"
      } else if (forbids.length > 0) {
        verdict = `5 forbidden: ${forbids}`
      }
      const shown = !linked || saver.length === 0 ? info.size : after
      const name = info.decl.children[0]
      lines.add(`${source.path}:${source.lineOf(name.start)}:${source.columnOf(name.start)}: layout: `)
      lines.add(`${shownName}${module.std ? " (std)" : ""}: ${verdict}, ${info.size} → ${shown} bytes`)
      if (verdict === "compact") {
        picked = picked + 1
      }
      // When the saving that passed test 3 is a holder's, not `R`'s own, the
      // line names that holder.
      if (linked && saver.length > 0 && saver !== shownName) {
        lines.add(`; ${saver} saves ${saving}`)
      }
      lines.add("\n")
    }
  }
  lines.add(`explain-layout: ${picked} of ${classes} classes compact`)
  return new LayoutReport(lines.toText(), classes, picked)
}
