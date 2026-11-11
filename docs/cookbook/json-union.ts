// Typed JSON over a tagged union: `jsonDecodeUnion` reads the tag, then the
// variant's fields; `jsonEncode` writes the tag first. Each union gets one
// decoding and one encoding function, `.json.decode.union.<U>` and
// `.json.encode.union.<U>`, which every use of the union calls.
import { JsonWriter } from "nish/json"
import { JsonDecoder, jsonDecodeUnion, jsonEncode } from "nish/json-typed"

enum Kind {
  Num,
  Neg,
}

class Num {
  readonly kind: Kind.Num = Kind.Num
  value: f64 = 0
}

class Neg {
  static readonly json = { tag: "negate" }
  readonly kind: Kind.Neg = Kind.Neg
  value: f64 = 0
}

type Expr = Num | Neg

export const readExpr = (d: JsonDecoder, prev: Expr): Expr => jsonDecodeUnion(d, prev)

export const writeExpr = (w: JsonWriter, e: Expr): void => {
  jsonEncode(w, e)
}
