// Each module imported here is handed a holder of `Box<i32>` as a type
// argument and then calls a generic answering the same holder itself, so
// its IR declares `Box$i32.get`, which this module never calls. Before, the
// holder's member stayed layout-only, and `llvm-as` refused those modules.
import { deep, many, maybe, nest, res, wrap } from "./lib";
import { viaAnnotation } from "./annotated";
import { viaArray } from "./array";
import { viaDeep } from "./deep";
import { viaField } from "./field";
import { viaNest } from "./nest";
import { viaNullable } from "./nullable";
import { viaResult } from "./result";
import { direct, take } from "./reverse";

export const main = (): i32 => {
  const w = wrap(1);
  const sum =
    viaField(w) +
    viaArray(many(1)) +
    viaNullable(maybe(1)) +
    viaResult(res(1)) +
    viaDeep(deep(1)) +
    viaNest(nest(1)) +
    viaAnnotation(w) +
    direct() +
    take(w);
  console.log(`${sum}`);
  return w.b.value;
};
