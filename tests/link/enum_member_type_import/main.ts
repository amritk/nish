// An enum member type names the exporter's enum through the importer's name:
// `K.Array` here is `kinds.ts`'s `Kind.Array`, so the field `ArrayTag`
// declares and the parameter `widen` takes both accept it, and the member's
// integer, 5, crosses the module boundary as a plain `i32`.
import { ArrayTag, Kind as K, widen } from "./kinds";

const scalar = (): K.Scalar => K.Scalar;

export const main = (): number => {
  const tag = new ArrayTag();
  const k: K.Array = tag.kind;
  const s: K = scalar();
  console.log(widen(k) === K.Array && s === K.Scalar ? "tagged" : "untagged");
  return 0;
};
