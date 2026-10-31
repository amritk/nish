// JSON Merge Patch (RFC 7396) on a typed record, through typed JSON's
// `presence` option: a key left out keeps the member, a value replaces it, an
// array is replaced whole, `null` removes a `| null` member (a string, a class,
// an array and a map), an object merges one level down and into a member the
// target lacked, and `null` on a member that is not `| null` refuses the
// whole patch. One patch object is decoded into again and again, so each
// answer is the input's own.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_DECODE_OK, JSON_DECODE_TYPE, JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
import { Suite } from "nish/testing";

export class Inner {
  x: i32 = 0;
  y: i32 = 0;
}

export class Doc {
  title: string = "";
  note: string | null = null;
  inner: Inner | null = null;
  list: i32[] | null = null;
  labels: Map<string, string> | null = null;
  count: i32 = 0;
}

export class InnerPatch {
  static readonly json = { optional: ["x", "y"], presence: { x: "hasX", y: "hasY" } };
  x: i32 = 0;
  y: i32 = 0;
  hasX: boolean = false;
  hasY: boolean = false;
}

export class DocPatch {
  static readonly json = {
    optional: ["title", "note", "inner", "list", "labels", "count"],
    presence: { title: "hasTitle", note: "hasNote", inner: "hasInner", list: "hasList", labels: "hasLabels", count: "hasCount" },
  };
  title: string = "";
  note: string | null = null;
  inner: InnerPatch | null = null;
  list: i32[] | null = null;
  labels: Map<string, string> | null = null;
  count: i32 = 0;
  hasTitle: boolean = false;
  hasNote: boolean = false;
  hasInner: boolean = false;
  hasList: boolean = false;
  hasLabels: boolean = false;
  hasCount: boolean = false;
}

const applyInner = (target: Inner, patch: InnerPatch): void => {
  if (patch.hasX) {
    target.x = patch.x;
  }
  if (patch.hasY) {
    target.y = patch.y;
  }
};

const applyDoc = (target: Doc, patch: DocPatch): void => {
  if (patch.hasTitle) {
    target.title = patch.title;
  }
  if (patch.hasNote) {
    target.note = patch.note;
  }
  if (patch.hasInner) {
    const given = patch.inner;
    if (given === null) {
      target.inner = null;
    } else {
      const had = target.inner;
      const into = had !== null ? had : new Inner();
      applyInner(into, given);
      target.inner = into;
    }
  }
  if (patch.hasList) {
    target.list = patch.list;
  }
  if (patch.hasLabels) {
    target.labels = patch.labels;
  }
  if (patch.hasCount) {
    target.count = patch.count;
  }
};

const bytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

/** Decodes `text` into `patch` and, when it decoded, applies it to `target`. */
const merge = (target: Doc, patch: DocPatch, text: string): i32 => {
  const src = bytes(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  jsonDecode(d, patch);
  if (d.failed === JSON_DECODE_OK) {
    applyDoc(target, patch);
  }
  return d.failed;
};

const show = (doc: Doc): string => {
  const w = new JsonWriter(new Array<u8>(512), 0);
  jsonEncode(w, doc);
  return w.text();
};

export const main = (): i32 => {
  const t = new Suite("json_merge_patch");
  const doc = new Doc();
  const patch = new DocPatch();
  const empty = `{"title":"","note":null,"inner":null,"list":null,"labels":null,"count":0}`;

  t.eqI32("an empty patch: decodes", merge(doc, patch, `{}`), JSON_DECODE_OK);
  t.eqStr("an empty patch: changes nothing", show(doc), empty);

  merge(doc, patch, `{"title":"a","note":"n","list":[1,2],"labels":{"k":"v"},"count":3}`);
  t.eqStr("values: replace their members", show(doc),
    `{"title":"a","note":"n","inner":null,"list":[1,2],"labels":{"k":"v"},"count":3}`);

  merge(doc, patch, `{"count":4}`);
  t.eqStr("a key left out: keeps its member, though the last patch gave it", show(doc),
    `{"title":"a","note":"n","inner":null,"list":[1,2],"labels":{"k":"v"},"count":4}`);

  merge(doc, patch, `{"inner":{"x":1}}`);
  t.eqStr("an object: merges into a member the target lacked", show(doc),
    `{"title":"a","note":"n","inner":{"x":1,"y":0},"list":[1,2],"labels":{"k":"v"},"count":4}`);

  merge(doc, patch, `{"inner":{"y":2}}`);
  t.eqStr("an object: merges one level down, keeping what it leaves out", show(doc),
    `{"title":"a","note":"n","inner":{"x":1,"y":2},"list":[1,2],"labels":{"k":"v"},"count":4}`);

  merge(doc, patch, `{"list":[9]}`);
  t.eqStr("an array: is replaced whole", show(doc),
    `{"title":"a","note":"n","inner":{"x":1,"y":2},"list":[9],"labels":{"k":"v"},"count":4}`);

  merge(doc, patch, `{"note":null,"inner":null,"list":null,"labels":null}`);
  t.eqStr("null: removes a string, a class, an array and a map", show(doc),
    `{"title":"a","note":null,"inner":null,"list":null,"labels":null,"count":4}`);

  t.eqI32("null on a member that is not `| null`: refuses the patch", merge(doc, patch, `{"title":"b","count":null}`),
    JSON_DECODE_TYPE);
  t.eqStr("null on a member that is not `| null`: and nothing of it is applied", show(doc),
    `{"title":"a","note":null,"inner":null,"list":null,"labels":null,"count":4}`);

  t.eqI32("after a refusal: the next patch decodes", merge(doc, patch, `{"title":"c"}`), JSON_DECODE_OK);
  t.ok("after a refusal: only its own key is recorded",
    patch.hasTitle && !patch.hasCount && !patch.hasNote && !patch.hasInner && !patch.hasList && !patch.hasLabels);

  return t.done();
};
