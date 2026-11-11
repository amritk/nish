// A union whose variants rename their tag key to `type`, one of them writing
// its tag as `open` instead of its member's name. `Open.hand` is a member
// that tags a variant of `Hand`, not `Open`'s own tag, so it keeps its
// member's name.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecodeUnion, jsonEncode } from "nish/json-typed";

export enum Ev {
  Open,
  Close,
}

export enum Side {
  Left,
  Right,
}

export class Left {
  readonly side: Side.Left = Side.Left;
}

export class Right {
  readonly side: Side.Right = Side.Right;
}

export type Hand = Left | Right;

export class Open {
  static readonly json = { rename: { kind: "type" }, tag: "open", optional: ["hand"] };
  readonly kind: Ev.Open = Ev.Open;
  readonly hand: Side.Left = Side.Left;
  path: string = "";
}

export class Close {
  static readonly json = { rename: { kind: "type" }, optional: ["code"] };
  readonly kind: Ev.Close = Ev.Close;
  code: i32 = 0;
}

export type Event = Open | Close;

const first = (): Event => new Close();

/** Decodes `text` as an `Event` and prints the code, the error offset and the encoding. */
export const event = (text: string): void => {
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const got = jsonDecodeUnion(d, first());
  const w = new JsonWriter(new Array<u8>(128), 0);
  jsonEncode(w, got);
  console.log(`event ${d.failed} ${d.errorAt} ${w.text()}`);
};

/** Encodes a `Hand`, whose tag `Open.hand` shares. */
export const hand = (h: Hand): void => {
  const w = new JsonWriter(new Array<u8>(32), 0);
  jsonEncode(w, h);
  console.log(`hand ${w.text()}`);
};
