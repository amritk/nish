// `async`, `namespace`, `module`, `declare`, `global`, `keyof` and `type` are
// identifiers to the lexer, and a program may use them as names. WP33 R1 reads
// each as the declaration word TypeScript reads it as only where a name could
// not stand — `async` before `function`, an arrow's parameters or a member's
// name on its line, `namespace` and `module` before a name or a string on
// theirs, `declare` before `global {` or a declared `namespace`, and `keyof`
// before a type on its line — so every use below compiles as it did before, to
// the same bytes: a variable, a parameter, a field and a method of each name,
// as an operand, an assignment target, a member and an element, at the end
// and the start of a line, and `keyof` as the name of a class in every type
// position. `names-declaration-calls.ts` calls a function of each name.
//
// `tests/run.js` compiles it and reads the names out of the IR.
class Words {
  async: i32 = 1
  namespace: i32 = 2
  module: i32 = 3
  declare: i32 = 4
  global: i32 = 5
  keyof: i32 = 6
  type: i32 = 7
}

class Methods {
  async(): i32 {
    return 1
  }

  namespace(): i32 {
    return 3
  }

  module<T>(x: T): i32 {
    return 4
  }

  declare(): i32 {
    return 5
  }

  global(): i32 {
    return 6
  }

  keyof(): i32 {
    return 7
  }

  type(): i32 {
    return 8
  }
}

// A class may be called `keyof`, and the word names it wherever no type
// follows it on its line: before `[]`, `|`, `=`, `,`, `)`, `>`, a body's `{`
// and the end of a line.
class keyof {
  v: i32 = 1
  next: keyof | null = null
}

const pick = (k: keyof, ks: keyof[]): i32 => k.v + ks.length

function made(): keyof {
  return new keyof()
}

const scale = (async: i32, module: i32): i32 => async * module

const offset = (namespace: i32, declare: i32, global: i32): i32 => namespace - declare + global

export const test = (): i32 => {
  let async: i32 = 1
  let namespace: i32 = 2
  let module: i32 = 3
  let declare: i32 = 4
  let global: i32 = 5
  let type: i32 = 7
  const w = new Words()
  const m = new Methods()
  const all: i32[] = [async, namespace, module, declare, global, type]
  let n: i32 = async + namespace * module - declare
  n = n + global % type
  n = async - 1
  n = module < global ? n : declare
  n = async++
  n = --namespace
  async = async + 1
  module += 1
  declare = 2
  global = global * 2
  type = 3
  w.async = w.module + w.keyof
  n = n + w.namespace + w.declare + w.global + w.type
  n = n + m.async() + m.namespace() + m.module(1) + m.declare() + m.global() + m.keyof() + m.type()
  n = n + all[global - 5]
  for (let i: i32 = async; i < module; i++) {
    n = n + i
  }
  for (const module of all) {
    n = n + module
  }
  const s = `${async}${namespace}${module}${global}`
  n = n + s.length + scale(async, module) + offset(namespace, declare, global)
  const k: keyof = made()
  const ks: keyof[] = [k]
  let maybe: keyof | null = null
  maybe = k.next
  n = n + pick(k, ks) + (maybe === null ? 0 : 1)
  n = async
  namespace = 3
  n = module
  declare = 1
  n = global
  type = 2
  n = namespace
  -1
  n = declare
  +global
  n = module
  ;[async, module][0]
  n = n + async + namespace + module + declare + global + type
  return n
}
