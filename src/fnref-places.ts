// Function reference sets and dispatchers (WP51 stage 1,
// docs/wp51-function-references.md §2.2 and §2.3).
//
// Once every body has checked clean, this pass numbers the functions the
// program names in a value position, works out which of them each place can
// hold, and gives every call through a reference a dispatcher of its own set:
// a generated function whose `switch` on the tag makes the direct calls.
//
// A place is a local or parameter, a function's return, a field (by name and
// reference type), or the elements of every array of one reference type. A
// value flows into a place by a declaration, an assignment, an argument, a
// `return`, an array or object literal or a `for...of`; a place's set is the
// union of what flows into it, iterated until nothing moves. A value the
// pass cannot follow — a module constant, a call whose result it does not
// model — is wide: every function of its signature.

import { checkSignatureBody } from "./checker"
import { CheckContext } from "./context"
import { referenceTypeOf } from "./fnrefs"
import { StringMap } from "./map"
import {
  N_ARRAY,
  N_ARROW,
  N_AS,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CASE,
  N_CLASS,
  N_CONDITIONAL,
  N_DEFAULT,
  N_EMPTY,
  N_EXPR_STMT,
  N_FIELD,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_MODULE_CONST,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_PARAM,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_SPREAD,
  N_SWITCH,
  N_VAR,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { ParentTable } from "./parents"
import { basename } from "./paths"
import {
  CheckedProgram,
  ConstInfo,
  FunctionBindings,
  FunctionSig,
  Instantiation,
  ROLE_FUNCTION,
} from "./program"
import { Local, Scope, STORAGE_PARAM } from "./symbols"
import { T_ERROR, T_I32, T_VOID, TypeTable } from "./types"

/** One module as the pass sees it: what it checked, its context, its tree and its parents. */
export class RefModule {
  program: CheckedProgram
  ctx: CheckContext
  file: Node
  parents: ParentTable
  nodeCount: i32

  constructor(program: CheckedProgram, ctx: CheckContext, file: Node, parents: ParentTable, nodeCount: i32) {
    this.program = program
    this.ctx = ctx
    this.file = file
    this.parents = parents
    this.nodeCount = nodeCount
  }

  /** Grow the module's node tables, and each generic instance's, to cover the nodes the pass added. */
  growTables(): void {
    this.program.growTables(this.nodeCount)
    for (const sig of this.program.functions) {
      const instance = sig.instance
      if (instance !== null) {
        instance.growTables(this.nodeCount)
      }
    }
  }
}

/** The places, the stores between them, and the calls through a reference the walk found. */
class RefPass {
  table: TypeTable
  /** Every function named in a value position, in tag order, and its reference type. */
  members: FunctionSig[]
  memberTypes: i32[]
  /** A keyed place's id; locals and call sites take an unkeyed one. */
  keys: StringMap
  placeTypes: i32[]
  placeMembers: i32[][]
  placeWide: boolean[]
  /** A store: `storeTarget` receives `storePlace`'s set, or the one member `storeMember`. */
  storeTarget: i32[]
  storePlace: i32[]
  storeMember: i32[]
  /** Where each store is written: the value stored and its module, for the diagnostics that name it. */
  storeNode: Node[]
  storeModule: i32[]
  /** The calls through a reference: the node, its table, its module, and the place its callee's value went to. */
  siteCalls: Node[]
  siteTables: (FunctionSig | null)[][]
  siteModules: i32[]
  sitePlaces: i32[]
  // The body being walked: its tables, its module, and its function (null for a module's own code).
  types: i32[]
  locals: (Local | null)[]
  constants: (ConstInfo | null)[]
  callees: (FunctionSig | null)[]
  fnRefs: (FunctionSig | null)[]
  program: CheckedProgram
  sig: FunctionSig | null
  sigCount: i32
  module: i32

  constructor(table: TypeTable, first: CheckedProgram) {
    this.table = table
    this.members = []
    this.memberTypes = []
    this.keys = new StringMap()
    this.placeTypes = []
    this.placeMembers = []
    this.placeWide = []
    this.storeTarget = []
    this.storePlace = []
    this.storeMember = []
    this.storeNode = []
    this.storeModule = []
    this.sigCount = 0
    this.siteCalls = []
    this.siteTables = []
    this.siteModules = []
    this.sitePlaces = []
    this.types = first.nodeTypes
    this.locals = first.nodeLocals
    this.constants = first.nodeConstants
    this.callees = first.nodeCallees
    this.fnRefs = first.nodeFnRefs
    this.program = first
    this.module = 0
    this.sig = null
  }

  /**
   * The reference type `node`'s value holds: its own, or the one under a
   * nullable or a maybe such as `Map.get`'s `Op | undefined`; -1 for any
   * other value. A nullable reference is followed as the reference it holds,
   * so a place it reaches is not left empty.
   */
  refType(node: Node): i32 {
    const type = this.typeOf(node)
    if (this.table.isFnRef(type)) {
      return type
    }
    const holder = this.table.isNullable(type) || this.table.isMaybe(type)
    if (holder && this.table.isFnRef(this.table.refOf(type))) {
      return this.table.refOf(type)
    }
    return -1
  }

  isRef(node: Node): boolean {
    return this.refType(node) >= 0
  }

  typeOf(node: Node): i32 {
    // A node the checker gave no type, such as `console` in `console.log`,
    // reads as the error type: every table predicate answers false for it.
    const type = node.id >= 0 && node.id < this.types.length ? this.types[node.id] : -1
    return type < 0 ? T_ERROR : type
  }

  newPlace(type: i32): i32 {
    const members: i32[] = []
    this.placeTypes.push(type)
    this.placeMembers.push(members)
    this.placeWide.push(false)
    return this.placeTypes.length - 1
  }

  keyed(key: string, type: i32): i32 {
    const found = this.keys.get(key, -1)
    if (found >= 0) {
      return found
    }
    const place = this.newPlace(type)
    this.keys.set(key, place)
    return place
  }

  sigPlace(sig: FunctionSig): i32 {
    if (sig.refPlace < 0) {
      sig.refPlace = this.sigCount
      this.sigCount = this.sigCount + 1
    }
    return sig.refPlace
  }

  returnPlace(sig: FunctionSig, type: i32): i32 {
    return this.keyed(`r${this.sigPlace(sig)}`, type)
  }

  paramPlace(sig: FunctionSig, index: i32, type: i32): i32 {
    return this.keyed(`p${this.sigPlace(sig)}.${index}`, type)
  }

  fieldPlace(name: string, type: i32): i32 {
    return this.keyed(`f${name}.${type}`, type)
  }

  elementPlace(type: i32): i32 {
    return this.keyed(`e${type}`, type)
  }

  /** A local's place: a parameter's is its function's, a capture's the local it was made from. */
  localPlace(local: Local, type: i32): i32 {
    const outer = local.captureOf
    if (outer !== null) {
      return this.localPlace(outer, type)
    }
    const sig = this.sig
    if (local.storage === STORAGE_PARAM && sig !== null) {
      let i = 0
      while (i < sig.paramNames.length) {
        if (sig.paramNames[i] === local.name) {
          return this.paramPlace(sig, i, type)
        }
        i = i + 1
      }
    }
    if (local.place < 0) {
      local.place = this.newPlace(type)
    }
    return local.place
  }

  storeFrom(target: i32, place: i32, node: Node): void {
    this.storeTarget.push(target)
    this.storePlace.push(place)
    this.storeMember.push(-1)
    this.storeNode.push(node)
    this.storeModule.push(this.module)
  }

  storeOne(target: i32, sig: FunctionSig, node: Node): void {
    let k = 0
    while (k < this.members.length) {
      if (this.members[k] === sig) {
        this.storeTarget.push(target)
        this.storePlace.push(-1)
        this.storeMember.push(k)
        this.storeNode.push(node)
        this.storeModule.push(this.module)
        return
      }
      k = k + 1
    }
  }

  /**
   * The store that first names member `k` in a place whose set flows into
   * `place`, or -1 when `k` came in only by widening.
   */
  storeOf(place: i32, k: i32): i32 {
    const into: boolean[] = []
    while (into.length < this.placeTypes.length) {
      into.push(false)
    }
    into[place] = true
    let moved = true
    while (moved) {
      moved = false
      let s = 0
      while (s < this.storeTarget.length) {
        const from = this.storePlace[s]
        if (from >= 0 && from < into.length && into[this.storeTarget[s]] && !into[from]) {
          into[from] = true
          moved = true
        }
        s = s + 1
      }
    }
    let s = 0
    while (s < this.storeTarget.length) {
      if (this.storeMember[s] === k && into[this.storeTarget[s]]) {
        return s
      }
      s = s + 1
    }
    return -1
  }

  /** `node`'s value flows into `target` (-1: nowhere the pass follows); its parts are walked. */
  flow(node: Node, target: i32): void {
    if (target < 0 || !this.isRef(node)) {
      this.scan(node)
      return
    }
    const type = this.refType(node)
    switch (node.kind) {
      case N_PAREN:
      case N_AS:
        this.flow(node.children[0], target)
        return
      case N_CONDITIONAL:
        this.scan(node.children[0])
        this.flow(node.children[1], target)
        this.flow(node.children[2], target)
        return
      case N_BINARY:
        if (node.text === "??" || node.text === "||" || node.text === "&&") {
          this.flow(node.children[0], target)
          this.flow(node.children[1], target)
          return
        }
        if (node.text === "=") {
          this.scan(node)
          this.flow(node.children[0], target)
          return
        }
        break
      case N_NULL:
        return
      case N_IDENT: {
        const named = this.fnRefs[node.id]
        if (named !== null) {
          this.storeOne(target, named, node)
          return
        }
        const local = this.locals[node.id]
        if (local !== null) {
          this.storeFrom(target, this.localPlace(local, type), node)
          return
        }
        break
      }
      case N_MEMBER:
        this.scan(node.children[0])
        this.storeFrom(target, this.fieldPlace(node.text, type), node)
        return
      case N_INDEX:
        this.scan(node.children[0])
        this.scan(node.children[1])
        this.storeFrom(target, this.elementPlace(type), node)
        return
      case N_CALL: {
        const site = this.scanCall(node)
        if (!site) {
          const callee = this.callees[node.id]
          // A call whose callee returns something else, such as the probe
          // `Map.get` lowers to, has no return place to read: it widens.
          if (callee !== null && !callee.dispatcher && callee.returnType === type) {
            this.storeFrom(target, this.returnPlace(callee, type), node)
            return
          }
          if (this.arrayMethod(node, false) >= 0) {
            this.storeFrom(target, this.elementPlace(type), node)
            return
          }
        }
        this.placeWide[target] = true
        return
      }
      default:
        break
    }
    this.scan(node)
    this.placeWide[target] = true
  }

  /**
   * The element type of the array a builtin method call `xs.m(...)` reads or
   * writes elements of, when they are references: `pop`/`shift`/`at`/`find`
   * yield one (`yields`), `push`/`unshift`/`fill`/`splice`/`includes`/`indexOf`
   * take one. -1 for every other call.
   */
  arrayMethod(call: Node, takes: boolean): i32 {
    const callee = call.children[0]
    if (callee.kind !== N_MEMBER || this.callees[call.id] !== null) {
      return -1
    }
    const receiver = this.typeOf(callee.children[0])
    if (!this.table.isArray(receiver)) {
      return -1
    }
    const element = this.table.refOf(receiver)
    if (!this.table.isFnRef(element)) {
      return -1
    }
    const name = callee.text
    if (takes) {
      const writes =
        name === "push" ||
        name === "unshift" ||
        name === "fill" ||
        name === "splice" ||
        name === "includes" ||
        name === "indexOf" ||
        name === "lastIndexOf"
      return writes ? element : -1
    }
    const reads =
      name === "pop" || name === "shift" || name === "at" || name === "find" || name === "findLast"
    return reads ? element : -1
  }

  /** A call: a call through a reference is recorded; arguments flow to their parameters. Whether it was one. */
  scanCall(call: Node): boolean {
    const callee = call.children[0]
    const args = call.children[1]
    let k = 0
    while (k < this.program.refCalls.length) {
      if (this.program.refCalls[k] === call && this.program.refCallTables[k] === this.callees) {
        const type = this.program.refCallTypes[k]
        const place = this.newPlace(type)
        this.flow(callee, place)
        this.scanRefArgs(type, args)
        this.siteCalls.push(call)
        this.siteTables.push(this.callees)
        this.siteModules.push(this.module)
        this.sitePlaces.push(place)
        return true
      }
      k = k + 1
    }
    this.scan(callee)
    this.scanArgs(this.callees[call.id], args, this.arrayMethod(call, true))
    return false
  }

  /**
   * The arguments of a call through a reference of type `type`: a reference
   * argument may reach the parameter of any function of that type, so it
   * flows to that parameter of every one. Wider than the call's own set, never
   * narrower, since the set is not known until `solve`.
   */
  scanRefArgs(type: i32, args: Node): void {
    let i = 0
    while (i < args.children.length) {
      const arg = args.children[i]
      if (this.isRef(arg)) {
        const from = this.newPlace(this.refType(arg))
        this.flow(arg, from)
        let k = 0
        while (k < this.members.length) {
          const member = this.members[k]
          if (this.memberTypes[k] === type && i < member.writtenArity()) {
            this.storeFrom(this.paramPlace(member, i, this.refType(arg)), from, arg)
          }
          k = k + 1
        }
      } else {
        this.scan(arg)
      }
      i = i + 1
    }
  }

  scanArgs(sig: FunctionSig | null, args: Node, element: i32): void {
    // A method's or a constructor's `this` is its parameter 0, so argument `i` is its parameter `i + 1`.
    let self = 0
    if (sig !== null && sig.owner !== null) {
      self = 1
    }
    let i = 0
    while (i < args.children.length) {
      const arg = args.children[i]
      const at = i + self
      if (this.isRef(arg)) {
        if (sig !== null && !sig.dispatcher && at < sig.writtenArity() && !sig.isCompileTime(at)) {
          this.flow(arg, this.paramPlace(sig, at, this.refType(arg)))
        } else if (element >= 0) {
          this.flow(arg, this.elementPlace(element))
        } else {
          this.scan(arg)
        }
      } else {
        this.scan(arg)
      }
      i = i + 1
    }
  }

  /** The place an assignment's left side names, or -1. */
  target(node: Node, type: i32): i32 {
    switch (node.kind) {
      case N_PAREN:
        return this.target(node.children[0], type)
      case N_IDENT: {
        const local = this.locals[node.id]
        return local === null ? -1 : this.localPlace(local, type)
      }
      case N_MEMBER:
        this.scan(node.children[0])
        return this.fieldPlace(node.text, type)
      case N_INDEX:
        this.scan(node.children[0])
        this.scan(node.children[1])
        return this.elementPlace(type)
      default:
        this.scan(node)
        return -1
    }
  }

  /** Walk a statement or an expression whose value goes nowhere the pass follows. */
  scan(node: Node): void {
    switch (node.kind) {
      case N_ARROW:
        // A lifted arrow is a function of its own, walked as one.
        return
      case N_VAR_DECL: {
        const init = node.children[2]
        const local = this.locals[node.id]
        if (init.kind !== N_EMPTY && local !== null && this.isRef(init)) {
          this.flow(init, this.localPlace(local, this.refType(init)))
        } else {
          this.scan(init)
        }
        return
      }
      case N_BINARY: {
        const op = node.text
        if ((op === "=" || op === "??=" || op === "||=" || op === "&&=") && this.isRef(node.children[1])) {
          const place = this.target(node.children[0], this.refType(node.children[1]))
          this.flow(node.children[1], place)
          return
        }
        break
      }
      case N_CALL:
        this.scanCall(node)
        return
      case N_NEW:
        this.scan(node.children[0])
        this.scanArgs(this.callees[node.id], node.children[2], -1)
        return
      case N_RETURN: {
        const sig = this.sig
        const value = node.children.length > 0 ? node.children[0] : node
        if (sig !== null && value !== node && this.isRef(value)) {
          this.flow(value, this.returnPlace(sig, this.refType(value)))
          return
        }
        break
      }
      case N_ARRAY:
        for (const element of node.children) {
          if (element.kind === N_SPREAD) {
            this.scan(element)
          } else if (this.isRef(element)) {
            this.flow(element, this.elementPlace(this.refType(element)))
          } else {
            this.scan(element)
          }
        }
        return
      case N_PROPERTY:
        if (node.children.length > 0 && this.isRef(node.children[0])) {
          this.flow(node.children[0], this.fieldPlace(node.text, this.refType(node.children[0])))
          return
        }
        break
      case N_FOR_OF: {
        const head = node.children[0]
        if (head.kind === N_VAR && head.children.length > 0 && head.children[0].children.length > 0) {
          const decl = head.children[0].children[0]
          const local = this.locals[decl.id]
          if (local !== null && this.table.isFnRef(local.type)) {
            this.storeFrom(this.localPlace(local, local.type), this.elementPlace(local.type), node)
          }
        }
        this.scan(node.children[1])
        this.scan(node.children[2])
        return
      }
      default:
        break
    }
    for (const child of node.children) {
      this.scan(child)
    }
  }

  /** Enter one body's tables. */
  enter(program: CheckedProgram, module: i32, sig: FunctionSig | null): void {
    this.program = program
    this.module = module
    this.sig = sig
    this.fnRefs = program.nodeFnRefs
    let instance: Instantiation | null = null
    if (sig !== null) {
      instance = sig.instance
    }
    if (instance !== null) {
      this.types = instance.nodeTypes
      this.locals = instance.nodeLocals
      this.constants = instance.nodeConstants
      this.callees = instance.nodeCallees
    } else {
      this.types = program.nodeTypes
      this.locals = program.nodeLocals
      this.constants = program.nodeConstants
      this.callees = program.nodeCallees
    }
  }

  /** A module's own code: its constants' initialisers and its classes' field initialisers. */
  walkModule(file: Node): void {
    for (const decl of file.children) {
      if (decl.kind === N_MODULE_CONST) {
        this.scan(decl)
      } else if (decl.kind === N_CLASS) {
        for (const member of decl.children[3].children) {
          if (member.kind === N_FIELD && member.children[2].kind !== N_EMPTY) {
            const init = member.children[2]
            if (this.isRef(init)) {
              this.flow(init, this.fieldPlace(member.children[0].text, this.refType(init)))
            } else {
              this.scan(init)
            }
          }
        }
      }
    }
  }

  walkFunction(sig: FunctionSig): void {
    const body = sig.body()
    if (body === null) {
      return
    }
    if (body.kind === N_BLOCK) {
      this.scan(body)
    } else if (this.isRef(body)) {
      this.flow(body, this.returnPlace(sig, this.refType(body)))
    } else {
      this.scan(body)
    }
  }

  /** Union every store until nothing moves; then a wide place holds every function of its type. */
  solve(): void {
    let moved = true
    while (moved) {
      moved = false
      let s = 0
      while (s < this.storeTarget.length) {
        const target = this.storeTarget[s]
        const from = this.storePlace[s]
        if (from >= 0) {
          if (this.placeWide[from] && !this.placeWide[target]) {
            this.placeWide[target] = true
            moved = true
          }
          for (const member of this.placeMembers[from]) {
            if (this.addMember(target, member)) {
              moved = true
            }
          }
        } else if (this.addMember(target, this.storeMember[s])) {
          moved = true
        }
        s = s + 1
      }
    }
    let p = 0
    while (p < this.placeTypes.length) {
      if (this.placeWide[p]) {
        let k = 0
        while (k < this.members.length) {
          if (this.memberTypes[k] === this.placeTypes[p]) {
            this.addMember(p, k)
          }
          k = k + 1
        }
      }
      p = p + 1
    }
  }

  addMember(place: i32, member: i32): boolean {
    const list = this.placeMembers[place]
    for (const held of list) {
      if (held === member) {
        return false
      }
    }
    // Kept in tag order, which is member order.
    let at = list.length
    list.push(member)
    while (at > 0 && at < list.length && list[at - 1] > member) {
      list[at] = list[at - 1]
      at = at - 1
    }
    list[at] = member
    return true
  }
}

/**
 * Where store `s` is written, as a diagnostic names it: the statement around
 * the stored value and its file and line, `` `k.f = u3` (main.ts:12) ``.
 */
const storeText = (pass: RefPass, modules: RefModule[], s: i32): string => {
  const module = modules[pass.storeModule[s]]
  let node = pass.storeNode[s]
  const value = node
  let up = module.parents.parentOf(node)
  while (up !== null && up.kind !== N_BLOCK && up.kind !== N_EXPR_STMT && up.kind !== N_ARROW) {
    const above = module.parents.parentOf(up)
    if (above === null || (up.kind === N_LIST && above.kind !== N_CALL && above.kind !== N_NEW)) {
      break
    }
    node = up
    up = above
  }
  const source = module.program.source
  let text = source.text.substring(node.start, node.end)
  if (text.indexOf("\n") >= 0) {
    node = value
    text = source.text.substring(node.start, node.end)
  }
  if (text.endsWith(";")) {
    text = text.substring(0, text.length - 1)
  }
  const file = basename(source.path)
  return `\`${text}\` (${file}:${source.lineOf(node.start)})`
}

/** Number the functions named in a value position: by module, then by where each is declared. */
const numberMembers = (pass: RefPass, modules: RefModule[]): void => {
  for (const module of modules) {
    const found: FunctionSig[] = []
    for (const other of modules) {
      for (const sig of other.program.nodeFnRefs) {
        if (sig !== null && sig.definedIn(module.program.source)) {
          let seen = false
          for (const held of found) {
            if (held === sig) {
              seen = true
            }
          }
          if (!seen) {
            let at = found.length
            found.push(sig)
            while (at > 0 && at < found.length && found[at - 1].decl.start > sig.decl.start) {
              found[at] = found[at - 1]
              at = at - 1
            }
            if (at >= 0 && at < found.length) {
              found[at] = sig
            }
          }
        }
      }
    }
    for (const sig of found) {
      pass.members.push(sig)
      pass.memberTypes.push(referenceTypeOf(pass.table, sig))
    }
  }
  // A tag is the position among the functions of one signature, from 1.
  let k = 0
  while (k < pass.members.length) {
    let tag = 1
    let j = 0
    while (j < k) {
      if (pass.memberTypes[j] === pass.memberTypes[k]) {
        tag = tag + 1
      }
      j = j + 1
    }
    pass.members[k].refTag = tag
    pass.table.fnRefMembers[pass.table.refOf(pass.memberTypes[k])].push(pass.members[k].sourceName)
    k = k + 1
  }
}

/** Builds a dispatcher's tree, numbering each node in its module's id space. */
class Builder {
  module: RefModule

  constructor(module: RefModule) {
    this.module = module
  }

  node(kind: i32, text: string, children: Node[]): Node {
    const made = new Node(kind, 0, 0)
    made.id = this.module.nodeCount
    this.module.nodeCount = this.module.nodeCount + 1
    made.text = text
    made.children = children
    return made
  }

  empty(): Node {
    const none: Node[] = []
    return this.node(N_EMPTY, "", none)
  }

  ident(name: string): Node {
    const none: Node[] = []
    return this.node(N_IDENT, name, none)
  }

  /** `return $mk($a0, ...)`, or the call and a bare `return` when the result is `void`. */
  arm(k: i32, arity: i32, returnType: i32): Node {
    const args: Node[] = []
    let i = 0
    while (i < arity) {
      args.push(this.ident(`$a${i}`))
      i = i + 1
    }
    const call = this.node(N_CALL, "", [this.ident(`$m${k}`), this.node(N_LIST, "", args)])
    if (returnType === T_VOID) {
      return this.node(N_BLOCK, "", [
        this.node(N_EXPR_STMT, "", [call]),
        this.node(N_RETURN, "", [this.empty()]),
      ])
    }
    return this.node(N_BLOCK, "", [this.node(N_RETURN, "", [call])])
  }
}

/**
 * The dispatcher for `members` (tag order) of reference type `type`, defined
 * in `module`: `$t` is the tag, `$a0...` the arguments. Each member is an arm
 * of a `switch` on the tag and the last is its `default`, so the switch has no
 * way out but a call (§2.3); a set of one is the call alone. An empty set — a
 * call through a place nothing was ever stored in — has no body to check, and
 * the emitter makes it a trap.
 */
const makeDispatcher = (
  table: TypeTable,
  module: RefModule,
  name: string,
  type: i32,
  members: FunctionSig[]
): FunctionSig => {
  const build = new Builder(module)
  const params = table.fnRefParamsOf(type)
  const returnType = table.fnRefResultOf(type)
  const paramNodes: Node[] = [build.node(N_PARAM, "", [build.ident("$t"), build.empty()])]
  let i = 0
  while (i < params.length) {
    paramNodes.push(build.node(N_PARAM, "", [build.ident(`$a${i}`), build.empty()]))
    i = i + 1
  }
  const statements: Node[] = []
  if (members.length === 1) {
    for (const statement of build.arm(0, params.length, returnType).children) {
      statements.push(statement)
    }
  } else if (members.length > 1) {
    const clauses: Node[] = []
    let k = 0
    for (const member of members) {
      const arm = build.arm(k, params.length, returnType)
      if (k === members.length - 1) {
        clauses.push(build.node(N_DEFAULT, "", [arm]))
      } else {
        const none: Node[] = []
        const label = build.node(N_NUMBER, `${member.refTag}`, none)
        clauses.push(build.node(N_CASE, "", [label, arm]))
      }
      k = k + 1
    }
    statements.push(build.node(N_SWITCH, "", [build.ident("$t"), build.node(N_LIST, "", clauses)]))
  }
  const typeParams: Node[] = []
  const arrow = build.node(N_ARROW, "", [
    build.empty(),
    build.node(N_LIST, "", paramNodes),
    build.empty(),
    build.node(N_BLOCK, "", statements),
    build.node(N_LIST, "", typeParams),
  ])
  const ctx = module.ctx
  const fn = new FunctionSig(name, name, arrow)
  fn.origin = ctx.source
  fn.role = ROLE_FUNCTION
  fn.returnType = returnType
  fn.dispatcher = true
  for (const member of members) {
    fn.refMembers.push(member)
  }
  const scope = new Scope(null)
  const tag = new Local("$t", T_I32, false, STORAGE_PARAM)
  scope.declare(tag)
  fn.paramNames.push("$t")
  fn.paramTypes.push(T_I32)
  i = 0
  while (i < params.length) {
    const param = params[i]
    const local = new Local(`$a${i}`, param, false, STORAGE_PARAM)
    scope.declare(local)
    fn.paramNames.push(`$a${i}`)
    fn.paramTypes.push(param)
    i = i + 1
  }
  module.growTables()
  if (members.length > 0) {
    const bindings = new FunctionBindings()
    let k = 0
    while (k < members.length) {
      bindings.add(`$m${k}`, members[k])
      k = k + 1
    }
    const savedCurrent = ctx.current
    const savedFunctions = ctx.functionBindings
    const savedErrored = ctx.errored
    const savedLoopKinds = ctx.loopKinds
    const savedLoopBreaks = ctx.loopBreaks
    const savedLoopLabels = ctx.loopLabels
    const savedLoopFrames = ctx.loopFrames
    const savedFlowFrames = ctx.flowFrames
    const savedStatement = ctx.statementExpression
    const savedAwaitStatement = ctx.awaitStatement
    ctx.current = fn
    ctx.functionBindings = bindings
    ctx.errored = false
    ctx.loopKinds = []
    ctx.loopBreaks = []
    ctx.loopLabels = []
    ctx.loopFrames = []
    ctx.flowFrames = []
    ctx.statementExpression = null
    ctx.awaitStatement = null
    checkSignatureBody(ctx, fn, scope, false)
    ctx.current = savedCurrent
    ctx.functionBindings = savedFunctions
    ctx.errored = savedErrored
    ctx.loopKinds = savedLoopKinds
    ctx.loopBreaks = savedLoopBreaks
    ctx.loopLabels = savedLoopLabels
    ctx.loopFrames = savedLoopFrames
    ctx.flowFrames = savedFlowFrames
    ctx.statementExpression = savedStatement
    ctx.awaitStatement = savedAwaitStatement
  }
  module.program.functions.push(fn)
  return fn
}

/**
 * A member another module defines is declared in this one, and one that
 * module does not export is given a symbol the link can reach (`refHidden`),
 * which keeps its entry facts, unlike a `hidden` instantiation's (§2.3).
 */
/**
 * The dispatcher `key` names in `made`, made under `name` the first time the
 * key is asked for, with each member exposed to the module that calls it.
 */
const dispatcherFor = (
  table: TypeTable,
  module: RefModule,
  dispatchers: StringMap,
  made: FunctionSig[],
  key: string,
  name: string,
  type: i32,
  members: FunctionSig[]
): FunctionSig => {
  const index = dispatchers.get(key, -1)
  if (index >= 0 && index < made.length) {
    return made[index]
  }
  for (const member of members) {
    exposeMember(module, member)
  }
  const dispatcher = makeDispatcher(table, module, name, type, members)
  dispatchers.set(key, made.length)
  made.push(dispatcher)
  return dispatcher
}

const exposeMember = (module: RefModule, sig: FunctionSig): void => {
  if (sig.definedIn(module.program.source)) {
    return
  }
  if (!sig.exported && !sig.foreign()) {
    sig.refHidden = true
  }
  if (module.program.externalInstanceNames.add(sig.name)) {
    module.program.externalInstances.push(sig)
  }
}

/**
 * Puts every reference call of `program` back in the shape it was written in
 * (`written`), with the reference as its callee, or in the shape the emitter
 * reads, with the dispatcher as its callee and the reference as its first
 * argument. `--emit-ts` writes the program as written, so it reads the calls
 * in the first shape and leaves them in the second. A generic body's call is
 * one node listed once per instance, so each node moves only from the shape
 * it is in.
 */
export const shapeReferenceCalls = (program: CheckedProgram, written: boolean): void => {
  let s = 0
  while (s < program.refSites.length) {
    const call = program.refSites[s]
    const dispatcher = program.refSiteCallees[s]
    const list = call.children[1]
    if (written && call.children[0] === dispatcher) {
      call.children[0] = list.children[0]
      const args: Node[] = []
      let i = 1
      while (i < list.children.length) {
        args.push(list.children[i])
        i = i + 1
      }
      list.children = args
    } else if (!written && call.children[0] !== dispatcher) {
      const args: Node[] = [call.children[0]]
      for (const arg of list.children) {
        args.push(arg)
      }
      call.children[0] = dispatcher
      list.children = args
    }
    s = s + 1
  }
}

/**
 * Resolve every function reference of the program: number the functions named
 * as values, walk each module for the places references reach, solve those
 * places, and rewrite each call through a reference into a call of the
 * dispatcher for its module and member set.
 *
 * @param table The program's type table.
 * @param modules Every module of the program, in compile order.
 * @returns Whether any reference exists, so dispatchers were made.
 */
export const resolveReferences = (table: TypeTable, modules: RefModule[]): boolean => {
  let any = false
  for (const module of modules) {
    if (module.program.refCalls.length > 0) {
      any = true
    }
    for (const sig of module.program.nodeFnRefs) {
      if (sig !== null) {
        any = true
      }
    }
  }
  if (!any || modules.length === 0) {
    return false
  }
  const pass = new RefPass(table, modules[0].program)
  numberMembers(pass, modules)
  let m = 0
  while (m < modules.length) {
    const module = modules[m]
    pass.enter(module.program, m, null)
    pass.walkModule(module.file)
    // A function is walked by the module that defines it, in its own tables.
    for (const sig of module.program.functions) {
      if (sig.definedIn(module.program.source) && !sig.dispatcher) {
        pass.enter(module.program, m, sig)
        pass.walkFunction(sig)
      }
    }
    m = m + 1
  }
  pass.solve()
  // One dispatcher per module and member set.
  const dispatchers = new StringMap()
  const made: FunctionSig[] = []
  const rewritten: Node[] = []
  let s = 0
  while (s < pass.siteCalls.length) {
    const call = pass.siteCalls[s]
    const module = modules[pass.siteModules[s]]
    const place = pass.sitePlaces[s]
    const type = pass.placeTypes[place]
    const members: FunctionSig[] = []
    const parts: string[] = [`${pass.siteModules[s]}`, `${type}`]
    for (const k of pass.placeMembers[place]) {
      members.push(pass.members[k])
      parts.push(`${k}`)
    }
    const name = `$ref.${pass.siteModules[s]}.${table.fnRefMangle(type)}.${made.length}`
    const dispatcher = dispatcherFor(table, module, dispatchers, made, parts.join(":"), name, type, members)
    // A generic body checked once per instantiation is one site per instance
    // but one node: it is rewritten once, and each instance's table names its
    // own dispatcher.
    if (rewritten.indexOf(call) < 0) {
      rewritten.push(call)
      const build = new Builder(module)
      const callee = build.ident(dispatcher.name)
      const args: Node[] = [call.children[0]]
      for (const arg of call.children[1].children) {
        args.push(arg)
      }
      call.children[0] = callee
      call.children[1].children = args
    }
    module.growTables()
    pass.siteTables[s][call.id] = dispatcher
    // What the diagnostics after the attribute fixpoint name (§2.2): the
    // callee as written and where each member came into its place.
    const via: string[] = []
    for (const k of pass.placeMembers[place]) {
      const store = pass.storeOf(place, k)
      via.push(store >= 0 ? storeText(pass, modules, store) : "")
    }
    const shown = call.children[1].children[0]
    module.program.refSites.push(call)
    module.program.refSiteCallees.push(call.children[0])
    module.program.refSiteDispatchers.push(dispatcher)
    module.program.refSiteShown.push(module.program.source.text.substring(shown.start, shown.end))
    module.program.refSiteVia.push(via)
    s = s + 1
  }
  // The parents of every new node, and of the arguments that moved.
  for (const module of modules) {
    const none: Node | null = null
    while (module.parents.parents.length < module.nodeCount) {
      module.parents.parents.push(none)
    }
    module.parents.link(module.file)
    for (const sig of module.program.functions) {
      if (sig.dispatcher && sig.definedIn(module.program.source)) {
        module.parents.link(sig.decl)
      }
    }
  }
  return true
}
