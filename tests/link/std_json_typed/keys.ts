// The keys `jsonEncode` writes: each field's key is quoted and escaped when
// the class is compiled and copied whole by `JsonWriter.keyQuoted`, which a
// minified writer with room takes and anything else hands to `key`. Each
// check here holds `jsonEncode` to a writer driven by hand through `key`, the
// path every key took before, at every buffer size from empty to roomy, so a
// fast path that wrote one byte differently, left `end` elsewhere or failed
// with another code would show. The texts are pinned too, as `JSON.stringify`
// writes them. The digits of `i32` and `i64` are held to the template string's.
import { JSON_WRITE_FULL, JSON_WRITE_TOO_DEEP, JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";
import { Suite } from "nish/testing";

/** Keys `key` has to escape: a quote, a backslash, control bytes, DEL and non-ASCII. */
export class Escaped {
  static readonly json = {
    rename: { quote: 'q"q', slash: "s\\s", line: "l\nl", bell: "b\u0001b", del: "d\u007fd", accent: "é", face: "😀" },
  };
  quote: i32 = 1;
  slash: i32 = 2;
  line: i32 = 3;
  bell: i32 = 4;
  del: i32 = 5;
  accent: i32 = 6;
  face: i32 = 7;
}

export class Empty {}

export class Inner {
  name: string = "";
  n: i64 = 0;
}

/** A field of every shape that opens its own value after the key. */
export class Outer {
  inner: Inner;
  maybe: Inner | null = null;
  list: Inner[];
  counts: Map<string, i32>;
  empty: Empty;
  last: boolean = false;

  constructor() {
    this.inner = new Inner();
    this.list = [];
    this.counts = new Map<string, i32>();
    this.empty = new Empty();
  }
}

export enum Shape {
  Dot,
  Box,
}

/** A tagged variant: its tag key, renamed, is written before its other fields. */
export class Dot {
  static readonly json = { rename: { kind: "type" } };
  readonly kind: Shape.Dot = Shape.Dot;
  x: i32 = 0;
}

export class Box {
  static readonly json = { rename: { kind: "type" } };
  readonly kind: Shape.Box = Shape.Box;
  w: i32 = 0;
}

export type Figure = Dot | Box;

/** A chain of objects, each the next one's `next`, for the writer's depth. */
export class Link {
  next: Link | null = null;
}

const ESCAPED_TEXT: string = `{"q\\"q":1,"s\\\\s":2,"l\\nl":3,"b\\u0001b":4,"d\u007fd":5,"é":6,"😀":7}`;
const OUTER_TEXT: string =
  `{"inner":{"name":"a","n":-1},"maybe":null,"list":[{"name":"b","n":0},{"name":"c","n":9223372036854775807}],` +
  `"counts":{"k":1,"j":2},"empty":{},"last":true}`;

/** `Escaped` through `key`, as the compiler wrote it before `keyQuoted`. */
const escapedByHand = (w: JsonWriter, v: Escaped): void => {
  w.beginObject();
  w.key('q"q');
  w.i32(v.quote);
  w.key("s\\s");
  w.i32(v.slash);
  w.key("l\nl");
  w.i32(v.line);
  w.key("b\u0001b");
  w.i32(v.bell);
  w.key("d\u007fd");
  w.i32(v.del);
  w.key("é");
  w.i32(v.accent);
  w.key("😀");
  w.i32(v.face);
  w.endObject();
};

const innerByHand = (w: JsonWriter, v: Inner): void => {
  w.beginObject();
  w.key("name");
  w.string(v.name);
  w.key("n");
  w.i64(v.n);
  w.endObject();
};

const outerByHand = (w: JsonWriter, v: Outer): void => {
  w.beginObject();
  w.key("inner");
  innerByHand(w, v.inner);
  w.key("maybe");
  const maybe = v.maybe;
  if (maybe === null) {
    w.nullValue();
  } else {
    innerByHand(w, maybe);
  }
  w.key("list");
  w.beginArray();
  for (const item of v.list) {
    innerByHand(w, item);
  }
  w.endArray();
  w.key("counts");
  w.beginObject();
  w.key("k");
  w.i32(1);
  w.key("j");
  w.i32(2);
  w.endObject();
  w.key("empty");
  w.beginObject();
  w.endObject();
  w.key("last");
  w.boolean(v.last);
  w.endObject();
};

/** Two figures in an array: the tag key first, then the fields. */
const figuresByHand = (w: JsonWriter): void => {
  w.beginArray();
  w.beginObject();
  w.key("type");
  w.string("Dot");
  w.key("x");
  w.i32(3);
  w.endObject();
  w.beginObject();
  w.key("type");
  w.string("Box");
  w.key("w");
  w.i32(-4);
  w.endObject();
  w.endArray();
};

const dotFigure = (): Figure => {
  const dot = new Dot();
  dot.x = 3;
  return dot;
};

const boxFigure = (): Figure => {
  const box = new Box();
  box.w = -4;
  return box;
};

const figuresEncoded = (w: JsonWriter): void => {
  w.beginArray();
  jsonEncode(w, dotFigure());
  jsonEncode(w, boxFigure());
  w.endArray();
};

/** `9223372036854775807`, which no literal here can spell: `2^62 - 1 + 2^62`. */
const i64Max = (): i64 => {
  let half: i64 = toI64(1);
  for (let i: i32 = 0; i < 62; i += 1) {
    half = half * toI64(2);
  }
  return half - toI64(1) + half;
};

/** `Link` chain through `key`. */
const deepByHand = (w: JsonWriter, l: Link): void => {
  w.beginObject();
  w.key("next");
  const next = l.next;
  if (next === null) {
    w.nullValue();
  } else {
    deepByHand(w, next);
  }
  w.endObject();
};

const makeOuter = (): Outer => {
  const o = new Outer();
  o.inner.name = "a";
  o.inner.n = toI64(-1);
  const b = new Inner();
  b.name = "b";
  const c = new Inner();
  c.name = "c";
  c.n = i64Max();
  o.list.push(b);
  o.list.push(c);
  o.counts.set("k", 1);
  o.counts.set("j", 2);
  o.last = true;
  return o;
};

/** What a writer holds: its code, its cursor and every byte of its buffer. */
const state = (w: JsonWriter, buf: u8[]): string => {
  let bytes = "";
  for (let i: i32 = 0; i < toI32(buf.length); i += 1) {
    bytes = `${bytes} ${buf[i]}`;
  }
  return `failed ${w.failed} written ${w.written()} bytes${bytes}`;
};

/**
 * The checks of one shape: `encoded` and `byHand` each into a fresh buffer of
 * every size from 0 to `room`, minified and with an indent of `indent`
 * (0 for none), leave the same code, cursor and bytes; at `room` both are
 * complete when `completes` says the value fits the writer at all. `wrap` starts each writer inside an object, after a key, so the
 * value is not the document's first.
 */
const sameAtEverySize = (
  t: Suite,
  name: string,
  room: i32,
  indent: i32,
  wrap: boolean,
  completes: boolean,
  encoded: (w: JsonWriter) => void,
  byHand: (w: JsonWriter) => void
): void => {
  let first = "";
  for (let size: i32 = 0; size <= room; size += 1) {
    const a = new Array<u8>(size);
    const b = new Array<u8>(size);
    const wa = new JsonWriter(a, 0);
    const wb = new JsonWriter(b, 0);
    if (indent > 0) {
      wa.setIndent(indent);
      wb.setIndent(indent);
    }
    if (wrap) {
      wa.beginObject();
      wa.key("v");
      wb.beginObject();
      wb.key("v");
    }
    encoded(wa);
    byHand(wb);
    if (wrap) {
      wa.endObject();
      wb.endObject();
    }
    const sa = state(wa, a);
    const sb = state(wb, b);
    if (sa !== sb && first === "") {
      first = `size ${size}: ${sa} | by hand ${sb}`;
    }
    if (size === room) {
      t.ok(`${name}: complete at ${room} bytes: ${completes}`, wa.complete() === completes && wb.complete() === completes);
    }
  }
  t.eqStr(`${name}: the same bytes, cursor and code as through key, at every size to ${room}`, first, "");
};

/** One text of `value`, encoded into a roomy buffer with the indent `indent`. */
const encodedText = (indent: i32, encode: (w: JsonWriter) => void): string => {
  const w = new JsonWriter(new Array<u8>(1024), 0);
  if (indent > 0) {
    w.setIndent(indent);
  }
  encode(w);
  return w.failed === 0 ? w.text() : `error ${w.failed}`;
};

const jtKeysEscaped = (t: Suite): void => {
  const e = new Escaped();
  t.eqStr(
    "keys: escaped keys are written as JSON.stringify writes them",
    encodedText(0, (w: JsonWriter): void => {
      jsonEncode(w, e);
    }),
    ESCAPED_TEXT
  );
  for (const indent of [0, 2]) {
    for (const wrap of [false, true]) {
      sameAtEverySize(
        t,
        `keys: escaped, indent ${indent}, wrapped ${wrap}`,
        150,
        indent,
        wrap,
        true,
        (w: JsonWriter): void => {
          jsonEncode(w, e);
        },
        (w: JsonWriter): void => {
          escapedByHand(w, e);
        }
      );
    }
  }
};

const jtKeysNested = (t: Suite): void => {
  const o = makeOuter();
  t.eqStr(
    "keys: nested, null, array, map and empty fields",
    encodedText(0, (w: JsonWriter): void => {
      jsonEncode(w, o);
    }),
    OUTER_TEXT
  );
  t.eqStr(
    "keys: an indented writer indents every key",
    encodedText(2, (w: JsonWriter): void => {
      jsonEncode(w, o.inner);
    }),
    `{\n  "name": "a",\n  "n": -1\n}`
  );
  t.eqStr(
    "keys: an empty class is an empty object",
    encodedText(0, (w: JsonWriter): void => {
      jsonEncode(w, new Empty());
    }),
    "{}"
  );
  for (const indent of [0, 2]) {
    for (const wrap of [false, true]) {
      sameAtEverySize(
        t,
        `keys: nested, indent ${indent}, wrapped ${wrap}`,
        320,
        indent,
        wrap,
        true,
        (w: JsonWriter): void => {
          jsonEncode(w, o);
        },
        (w: JsonWriter): void => {
          outerByHand(w, o);
        }
      );
    }
  }
};

const jtKeysTagged = (t: Suite): void => {
  t.eqStr(
    "keys: a tagged variant writes its tag key first",
    encodedText(0, figuresEncoded),
    `[{"type":"Dot","x":3},{"type":"Box","w":-4}]`
  );
  for (const indent of [0, 2]) {
    sameAtEverySize(t, `keys: tagged, indent ${indent}`, 120, indent, false, true, figuresEncoded, figuresByHand);
  }
};

const jtKeysFailed = (t: Suite): void => {
  // Sixty-five objects deep: the writer's depth ends the sixty-fifth.
  const head = new Link();
  let at = head;
  for (let i: i32 = 1; i < 65; i += 1) {
    const next = new Link();
    at.next = next;
    at = next;
  }
  t.eqStr(
    "keys: sixty-five objects deep is the writer's depth code",
    encodedText(0, (w: JsonWriter): void => {
      jsonEncode(w, head);
    }),
    `error ${JSON_WRITE_TOO_DEEP}`
  );
  sameAtEverySize(
    t,
    "keys: sixty-five deep",
    600,
    0,
    false,
    false,
    (w: JsonWriter): void => {
      jsonEncode(w, head);
    },
    (w: JsonWriter): void => {
      deepByHand(w, head);
    }
  );
  // A writer that has already failed writes no key: the four bytes keep what
  // the first encode wrote before the buffer ran out, as `key` leaves them.
  const w = new JsonWriter(new Array<u8>(4), 0);
  jsonEncode(w, new Escaped());
  t.eqI32("keys: a full writer keeps its code", w.failed, JSON_WRITE_FULL);
  jsonEncode(w, makeOuter().inner);
  t.eqStr("keys: and a second encode adds nothing", state(w, w.buf), "failed -5 written 1 bytes 123 34 113 0");
};

/** Every power of ten and its neighbours, as an `i32` and an `i64`, against the template string. */
const jtKeysDigits = (t: Suite): void => {
  let bad32 = "";
  let p: i32 = 1;
  for (let k: i32 = 0; k < 10; k += 1) {
    for (const v of [p - 1, p, -p, 1 - p, p + 1, -p - 1]) {
      const got = encodedText(0, (w: JsonWriter): void => {
        w.i32(v);
      });
      if (got !== `${v}` && bad32 === "") {
        bad32 = `${v} written ${got}`;
      }
    }
    if (k < 9) {
      p = p * 10;
    }
  }
  for (const v of [2147483647, -2147483647, -2147483648]) {
    const got = encodedText(0, (w: JsonWriter): void => {
      w.i32(v);
    });
    if (got !== `${v}` && bad32 === "") {
      bad32 = `${v} written ${got}`;
    }
  }
  t.eqStr("digits: i32 at every power of ten and its edges", bad32, "");
  let bad64 = "";
  let q: i64 = toI64(1);
  for (let k: i32 = 0; k < 19; k += 1) {
    for (const v of [q - toI64(1), q, -q, toI64(1) - q, q + toI64(1), -q - toI64(1)]) {
      const got = encodedText(0, (w: JsonWriter): void => {
        w.i64(v);
      });
      if (got !== `${v}` && bad64 === "") {
        bad64 = `${v} written ${got}`;
      }
    }
    if (k < 18) {
      q = q * toI64(10);
    }
  }
  const max: i64 = i64Max();
  for (const v of [max, -max, -max - toI64(1)]) {
    const got = encodedText(0, (w: JsonWriter): void => {
      w.i64(v);
    });
    if (got !== `${v}` && bad64 === "") {
      bad64 = `${v} written ${got}`;
    }
  }
  t.eqStr("digits: i64 at every power of ten and its edges", bad64, "");
};

/** The keys section of the suite. */
export const jtKeysChecks = (t: Suite): void => {
  jtKeysEscaped(t);
  jtKeysNested(t);
  jtKeysTagged(t);
  jtKeysFailed(t);
  jtKeysDigits(t);
};
