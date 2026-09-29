// `typeof`, `delete`, `void`, `instanceof`, `in`, `yield`, `await`,
// `satisfies`, `as` and `of` are identifiers to the lexer, and a program may
// use them as names. WP33 R1 reads each as the operator TypeScript reads it as
// only where a name could not stand — a prefix word followed on its line by an
// operand, an infix word on the line of the operand before it — so every use
// below compiles as it did before, to the same bytes: a variable, a parameter
// and a field of each name, as an operand, an assignment target, a member, an
// element, in a `for` head, a template and an arrow's body, and at the end and
// the start of a line, where semicolon insertion splits the statement.
// `names-operator-calls.ts` calls a function of each name.
//
// `tsc` reserves most of these words, so the file lives here rather than in
// `tests/cases/`, and `tests/run.js` compiles it and reads the names out of the
// IR.
class Words {
  typeof: i32 = 1
  delete: i32 = 2
  void: i32 = 3
  instanceof: i32 = 4
  in: i32 = 5
  yield: i32 = 6
  await: i32 = 7
  satisfies: i32 = 8
  as: i32 = 9
  of: i32 = 10
}

interface Pair {
  in: i32
  as: i32
}

const scale = (typeof: i32, void: i32): i32 => typeof * void

const offset = (in: i32, instanceof: i32): i32 => in - instanceof

export const test = (): i32 => {
  let typeof: i32 = 1
  let delete: i32 = 2
  let void: i32 = 3
  let instanceof: i32 = 4
  let in: i32 = 5
  let yield: i32 = 6
  let await: i32 = 7
  let satisfies: i32 = 8
  let as: i32 = 9
  let of: i32 = 10
  const w = new Words()
  const p: Pair = { in: 1, as: 2 }
  let n: i32 = typeof + delete * void - instanceof
  n = n + in % yield
  n = n + await - satisfies + as + of
  n = typeof - 1
  n = void + -1
  n = delete - -n
  n = await / 2
  n = typeof < in ? n : yield
  n = yield++
  n = --satisfies
  typeof = typeof + 1
  in = in + 1
  as = as * 2
  of += 1
  w.in = w.in + w.typeof
  w.as = p.as + p.in
  n = n + w.delete + w.void + w.instanceof + w.yield + w.await + w.satisfies + w.as + w.of
  const xs: i32[] = [typeof, delete, void, in, instanceof, as]
  n = n + xs[typeof - 2]
  for (let i: i32 = in; i < as; i++) {
    n = n + i
  }
  for (in = 0; in < 2; in++) {
    n = n + in
  }
  for (const of of xs) {
    n = n + of
  }
  for (const in of xs) {
    n = n + in
  }
  for (const x of [yield, await]) {
    n = n + x
  }
  const s = `${typeof}${in}${as}${void}`
  n = n + s.length + scale(typeof, void) + offset(in, instanceof)
  n = typeof
  in = 3
  n = in
  instanceof = 1
  n = as
  as = 2
  n = satisfies
  satisfies = 5
  n = void
  -1
  n = await
  +yield
  n = delete
  ;[delete, typeof][0]
  n = n + in + instanceof + as + satisfies + yield + await
  return n
}
