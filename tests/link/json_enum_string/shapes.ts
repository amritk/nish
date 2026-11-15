import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecodeUnion, jsonEncode } from "nish/json-typed";

// A tagged union whose tag enum is a string enum: each variant's tag is its
// member's string on the wire, unless `static json = { tag }` names another.
export enum Shape {
  Circle = "circle",
  Square = "square",
  Blob = "blob",
}

export class Circle {
  readonly kind: Shape.Circle = Shape.Circle;
  r: f64 = 0;
}

export class Square {
  readonly kind: Shape.Square = Shape.Square;
  side: f64 = 0;
}

export class Blob {
  static readonly json = { tag: "amoeba" };
  readonly kind: Shape.Blob = Shape.Blob;
}

export type Figure = Circle | Square | Blob;

const shapeBytes = (text: string): u8[] => {
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  return src;
};

const circle = (): Figure => new Circle();

export const figure = (text: string): void => {
  const src = shapeBytes(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const got = jsonDecodeUnion(d, circle());
  const w = new JsonWriter(new Array<u8>(256), 0);
  jsonEncode(w, got);
  console.log(`${d.failed} ${String(got.kind)} ${w.text()} ${w.text() === text}`);
};
