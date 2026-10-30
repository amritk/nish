// `nish/json-value` source ranges (std/json-value.ts, `keepRanges`): every
// value kind and every key read back as the exact bytes it was parsed from,
// through nesting, a window that does not start at 0, both duplicate-key
// policies, a reparse with ranges on and off, a document that keeps none, and
// a tree built with `new*` and given its ranges by the setters.
import { JSON_TOK_ERR_TRUNCATED, JsonLimits } from "nish/json-tokenizer";
import {
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_ERR_DUPLICATE,
  JSON_VALUE_ERR_HANDLE,
  JSON_VALUE_ERR_RANGE,
  JSON_VALUE_OK,
  JsonDocument,
  JsonValue,
} from "nish/json-value";
import { Suite } from "nish/testing";

/** The bytes of `s`, one per `charCodeAt`. */
const jrBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length);
  const out = new Array<u8>(n);
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    out[i] = toU8(toI32(s.charCodeAt(i)));
  }
  return out;
};

/** `text[a, b)`, or `-` when the range is not one: what a test compares a recorded range by. */
const jrSlice = (text: string, a: i32, b: i32): string =>
  a < 0 || b < a || b > toI32(text.length) ? `- ${a} ${b}` : text.substring(a, b);

/** The bytes value `v` was read from. */
const jrValue = (doc: JsonDocument, text: string, v: JsonValue): string => jrSlice(text, doc.start(v), doc.end(v));

/** The bytes the key of member `i` of `o` was read from. */
const jrKey = (doc: JsonDocument, text: string, o: JsonValue, i: i32): string =>
  jrSlice(text, doc.keyStart(o, i), doc.keyEnd(o, i));

/** A ranged document, cleared so that it keeps ranges from its first build on. */
const jrRanged = (): JsonDocument => {
  const doc = new JsonDocument(new JsonLimits());
  doc.keepRanges = true;
  doc.clear();
  return doc;
};

const jrKinds = (t: Suite): void => {
  const doc = jrRanged();
  const text = ' { "s" : "a\\"b\\u0041" , "t":true,"f": false ,"z":null, "n" : -12.5e+1 ,"a":[ 1 ,[], {} ] } ';
  const root = doc.parseText(text);
  if (!t.ok("kinds: the document parses", root >= 0)) {
    return;
  }
  t.eqStr("kinds: the root runs from its brace to its brace", jrValue(doc, text, root), text.substring(1, toI32(text.length) - 1));
  t.eqStr("kinds: a string with escapes, quotes and escapes as written", jrValue(doc, text, doc.get(root, "s")), '"a\\"b\\u0041"');
  t.eqStr("kinds: true", jrValue(doc, text, doc.get(root, "t")), "true");
  t.eqStr("kinds: false", jrValue(doc, text, doc.get(root, "f")), "false");
  t.eqStr("kinds: null", jrValue(doc, text, doc.get(root, "z")), "null");
  t.eqStr("kinds: a number as written", jrValue(doc, text, doc.get(root, "n")), "-12.5e+1");
  const a = doc.get(root, "a");
  t.eqStr("kinds: an array, blanks inside it included", jrValue(doc, text, a), "[ 1 ,[], {} ]");
  t.eqStr("kinds: an element", jrValue(doc, text, doc.at(a, 0)), "1");
  t.eqStr("kinds: an empty array", jrValue(doc, text, doc.at(a, 1)), "[]");
  t.eqStr("kinds: an empty object", jrValue(doc, text, doc.at(a, 2)), "{}");
  t.eqI32("kinds: start is a byte offset", doc.start(doc.get(root, "s")), 9);
  t.eqI32("kinds: end is one past the last byte", doc.end(doc.get(root, "s")), 21);
  const keys: string[] = [];
  for (let i: i32 = 0; i < doc.length(root); i += 1) {
    keys.push(jrKey(doc, text, root, i));
  }
  t.eqStr("keys: every key, quotes included", keys.join(","), '"s","t","f","z","n","a"');
  t.eqI32("keys: keyStart is the opening quote", doc.keyStart(root, 0), 3);
  t.eqI32("keys: keyEnd is one past the closing quote", doc.keyEnd(root, 0), 6);
  t.eqI32("keys: an array's member has no key range", doc.keyStart(a, 0), -1);
  t.eqI32("keys: nor a key end", doc.keyEnd(a, 0), -1);
  t.eqI32("keys: a member past the last has none", doc.keyStart(root, 6), -1);
  t.eqI32("keys: nor a negative one", doc.keyEnd(root, -1), -1);
  t.eqI32("kinds: a handle that names nothing has no start", doc.start(-1), -1);
  t.eqI32("kinds: nor an end", doc.end(12345), -1);
};

const jrNesting = (t: Suite): void => {
  const doc = jrRanged();
  const text = '{"outer":{"mid":[{"in":[true,{"deep":"x"}]}],"after":7},"tail":{"k":[]}}';
  const root = doc.parseText(text);
  if (!t.ok("nesting: the document parses", root >= 0)) {
    return;
  }
  const outer = doc.get(root, "outer");
  const mid = doc.get(outer, "mid");
  const inner = doc.at(mid, 0);
  const deep = doc.at(doc.get(inner, "in"), 1);
  t.eqStr("nesting: the outer object", jrValue(doc, text, outer), '{"mid":[{"in":[true,{"deep":"x"}]}],"after":7}');
  t.eqStr("nesting: an array inside it", jrValue(doc, text, mid), '[{"in":[true,{"deep":"x"}]}]');
  t.eqStr("nesting: an object in the array", jrValue(doc, text, inner), '{"in":[true,{"deep":"x"}]}');
  t.eqStr("nesting: the deepest object", jrValue(doc, text, deep), '{"deep":"x"}');
  t.eqStr("nesting: the deepest key", jrKey(doc, text, deep, 0), '"deep"');
  t.eqStr("nesting: the deepest value", jrValue(doc, text, doc.get(deep, "deep")), '"x"');
  t.eqStr("nesting: a container's key after its members' keys", jrKey(doc, text, root, 0), '"outer"');
  t.eqStr("nesting: the key after a nested container", jrKey(doc, text, outer, 1), '"after"');
  t.eqStr("nesting: the value after a nested container", jrValue(doc, text, doc.get(outer, "after")), "7");
  t.eqStr("nesting: the last member's key", jrKey(doc, text, root, 1), '"tail"');
  t.eqStr("nesting: the last member", jrValue(doc, text, doc.get(root, "tail")), '{"k":[]}');
};

const jrWindow = (t: Suite): void => {
  // Ranges are offsets into the array `parse` was given, so a window from 4 starts its root at 4.
  const doc = jrRanged();
  const text = 'xxx [ {"a":"b"} ] yyy';
  const bytes = jrBytes(text);
  const root = doc.parse(bytes, 3, 15);
  if (!t.ok("window: the window parses", root >= 0)) {
    return;
  }
  t.eqI32("window: the root starts at its offset in the array", doc.start(root), 4);
  t.eqStr("window: the root", jrValue(doc, text, root), '[ {"a":"b"} ]');
  t.eqStr("window: a key", jrKey(doc, text, doc.at(root, 0), 0), '"a"');
  t.eqStr("window: a value", jrValue(doc, text, doc.get(doc.at(root, 0), "a")), '"b"');
};

const jrDuplicates = (t: Suite): void => {
  const doc = jrRanged();
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  const text = '{"a":1,"b":2,"a":[3]}';
  const root = doc.parseText(text);
  if (!t.ok("duplicates: last parses", root >= 0)) {
    return;
  }
  t.eqI32("duplicates: one member per key", doc.length(root), 2);
  t.eqI32("duplicates: the member keeps its first key's range", doc.keyStart(root, 0), 1);
  t.eqStr("duplicates: and holds the last value, with its range", jrValue(doc, text, doc.get(root, "a")), "[3]");
  t.eqStr("duplicates: the next member keeps its own key", jrKey(doc, text, root, 1), '"b"');
  // Nine members take the sorted path of the duplicate check.
  const wide = '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"k7":7,"k1":"one"}';
  const w = doc.parseText(wide);
  if (!t.ok("duplicates: a wide object parses", w >= 0)) {
    return;
  }
  t.eqStr("duplicates: sorted, the member keeps its first key", jrKey(doc, wide, w, 1), '"k1"');
  t.eqI32("duplicates: at the first key's offset", doc.keyStart(w, 1), 8);
  t.eqStr("duplicates: sorted, the last value with its range", jrValue(doc, wide, doc.at(w, 1)), '"one"');
  t.eqStr("duplicates: sorted, the last member keeps its key", jrKey(doc, wide, w, 7), '"k7"');
  doc.duplicates = 0;
  t.eqI32("duplicates: refused, the parse fails", doc.parseText(wide), JSON_VALUE_ERR_DUPLICATE);
  t.eqI32("duplicates: errorAt is the repeated key", doc.errorAt, 57);
  t.eqI32("duplicates: a value built on the old root's index has no range", doc.start(doc.newObject()), -1);
};

const jrOff = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const text = '{"a":[1,"x",null],"b":{"c":true}}';
  const root = doc.parseText(text);
  if (!t.ok("off: the document parses", root >= 0)) {
    return;
  }
  t.ok("off: keepRanges is off by default", !doc.keepRanges && !doc.ranged);
  t.eqI32("off: start answers -1", doc.start(root), -1);
  t.eqI32("off: end answers -1", doc.end(doc.get(root, "a")), -1);
  t.eqI32("off: keyStart answers -1", doc.keyStart(root, 0), -1);
  t.eqI32("off: keyEnd answers -1", doc.keyEnd(root, 1), -1);
  const ranges: i32 =
    toI32(doc.valueStart.length) +
    toI32(doc.valueEnd.length) +
    toI32(doc.slotKeyStart.length) +
    toI32(doc.slotKeyEnd.length) +
    toI32(doc.openKeyEnd.length) +
    toI32(doc.pendingKeyEnd.length);
  t.eqI32("off: no range array holds anything", ranges, 0);
  t.eqI32("off: setRange is refused", doc.setRange(root, 0, 1), JSON_VALUE_ERR_RANGE);
  t.eqI32("off: setKeyRange is refused", doc.setKeyRange(root, 0, 1, 4), JSON_VALUE_ERR_RANGE);
  // `keepRanges` waits for the next parse or clear, so the contents already there stay without.
  doc.keepRanges = true;
  t.eqI32("off: turned on, the current contents still have none", doc.start(root), -1);
  t.eqI32("off: and a setter is still refused", doc.setRange(root, 0, 1), JSON_VALUE_ERR_RANGE);
};

const jrReparse = (t: Suite): void => {
  const doc = jrRanged();
  const first = '[1,2,{"a":"b"}]';
  const r1 = doc.parseText(first);
  t.eqStr("reparse: the first document's ranges", jrValue(doc, first, doc.at(r1, 2)), '{"a":"b"}');
  const second = '  {"zz":  [ ]  }';
  const r2 = doc.parseText(second);
  if (!t.ok("reparse: the second document parses", r2 >= 0)) {
    return;
  }
  t.eqStr("reparse: the second document's root", jrValue(doc, second, r2), '{"zz":  [ ]  }');
  t.eqStr("reparse: its key", jrKey(doc, second, r2, 0), '"zz"');
  t.eqStr("reparse: its value", jrValue(doc, second, doc.get(r2, "zz")), "[ ]");
  t.eqI32("reparse: a handle from the first document has no range", doc.start(r1), -1);
  // The first document had five values and the second two: an index only the first one ranged answers -1.
  const third = doc.newNull();
  t.ok("reparse: a value built past the second document has no range", third >= 0 && doc.start(third) === -1 && doc.end(third) === -1);
  doc.keepRanges = false;
  const r3 = doc.parseText(first);
  t.ok("reparse: ranges off, the document parses", r3 >= 0);
  t.eqI32("reparse: ranges off, a reparse answers -1", doc.start(r3), -1);
  t.eqI32("reparse: ranges off, for keys too", doc.keyStart(doc.at(r3, 2), 0), -1);
  doc.keepRanges = true;
  const r4 = doc.parseText(first);
  t.eqStr("reparse: on again, the ranges are back", jrKey(doc, first, doc.at(r4, 2), 0), '"a"');
  t.eqI32("reparse: a failed parse fails", doc.parseText('{"a":'), JSON_TOK_ERR_TRUNCATED);
  const after = doc.newArray();
  t.ok("reparse: and leaves no range behind", after >= 0 && doc.start(after) === -1 && doc.end(after) === -1);
};

const jrBuilders = (t: Suite): void => {
  const doc = jrRanged();
  const o = doc.newObject();
  const values: JsonValue[] = [
    doc.newNull(),
    doc.newBoolean(true),
    doc.newString("s"),
    doc.newI64(toI64(-5)),
    doc.newU64(toU64(7)),
    doc.newF64(toF64(3)),
    doc.newNumber("1e3"),
    doc.newArray(),
  ];
  let unranged: i32 = 0;
  for (const v of values) {
    if (doc.start(v) === -1 && doc.end(v) === -1) {
      unranged += 1;
    }
  }
  t.eqI32("builders: every new value has no range", unranged, toI32(values.length));
  t.eqI32("builders: nor the new object", doc.start(o), -1);
  for (let i: i32 = 0; i < toI32(values.length); i += 1) {
    doc.set(o, `k${i}`, values[i]);
  }
  t.eqI32("builders: a new key has no range", doc.keyStart(o, 0), -1);
  t.eqI32("builders: nor an end", doc.keyEnd(o, 7), -1);
  t.eqI32("builders: setRange", doc.setRange(values[2], 10, 13), JSON_VALUE_OK);
  t.eqI32("builders: start reads it back", doc.start(values[2]), 10);
  t.eqI32("builders: end reads it back", doc.end(values[2]), 13);
  t.eqI32("builders: an empty range is one", doc.setRange(o, 4, 4), JSON_VALUE_OK);
  t.eqI32("builders: setKeyRange", doc.setKeyRange(o, 2, 6, 9), JSON_VALUE_OK);
  t.ok("builders: keyStart and keyEnd read it back", doc.keyStart(o, 2) === 6 && doc.keyEnd(o, 2) === 9);
  t.eqI32("builders: another key keeps none", doc.keyStart(o, 3), -1);
  t.eqI32("builders: setRange on nothing", doc.setRange(-1, 0, 1), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: setRange before 0", doc.setRange(o, -1, 1), JSON_VALUE_ERR_RANGE);
  t.eqI32("builders: setRange ending before it starts", doc.setRange(o, 5, 4), JSON_VALUE_ERR_RANGE);
  t.eqI32("builders: setKeyRange on an array", doc.setKeyRange(values[7], 0, 0, 1), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: setKeyRange past the last member", doc.setKeyRange(o, 8, 0, 1), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: setKeyRange on nothing", doc.setKeyRange(-1, 0, 0, 1), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: setKeyRange before 0", doc.setKeyRange(o, 0, -2, 1), JSON_VALUE_ERR_RANGE);
  t.eqI32("builders: setKeyRange ending before it starts", doc.setKeyRange(o, 0, 3, 2), JSON_VALUE_ERR_RANGE);
  // Replacing the value keeps the member, and so its key's range; the new value brings its own.
  const replacement = doc.newString("r");
  doc.setRange(replacement, 20, 23);
  t.eqI32("builders: set over an existing key", doc.set(o, "k2", replacement), JSON_VALUE_OK);
  t.ok("builders: the member keeps its key range", doc.keyStart(o, 2) === 6 && doc.keyEnd(o, 2) === 9);
  t.ok("builders: and has the new value's range", doc.start(doc.get(o, "k2")) === 20 && doc.end(doc.get(o, "k2")) === 23);
  t.eqI32("builders: the old value keeps its own", doc.start(values[2]), 10);
  t.eqI32("builders: a push onto an array", doc.push(values[7], doc.newNull()), JSON_VALUE_OK);
  t.eqI32("builders: the pushed value has no range", doc.start(doc.at(values[7], 0)), -1);
};

const jrGrowth = (t: Suite): void => {
  // A parsed object has exactly the slots it needs, so `set` of a new key moves them all: the key ranges move with them.
  const doc = jrRanged();
  const text = '{"one":1,"two":2,"inner":{"x":0}}';
  const root = doc.parseText(text);
  if (!t.ok("growth: the document parses", root >= 0)) {
    return;
  }
  t.eqI32("growth: set of a new key", doc.set(root, "four", doc.newNull()), JSON_VALUE_OK);
  t.eqI32("growth: and of another, past the first growth's room", doc.set(root, "five", doc.newNull()), JSON_VALUE_OK);
  const keys: string[] = [];
  for (let i: i32 = 0; i < 3; i += 1) {
    keys.push(jrKey(doc, text, root, i));
  }
  t.eqStr("growth: the parsed keys keep their ranges after the move", keys.join(","), '"one","two","inner"');
  t.eqI32("growth: the added keys have none", doc.keyStart(root, 3), -1);
  t.eqI32("growth: the last added key has none", doc.keyEnd(root, 4), -1);
  t.eqI32("growth: a range set on an added key", doc.setKeyRange(root, 4, 40, 46), JSON_VALUE_OK);
  t.eqI32("growth: survives the next move", doc.set(root, "six", doc.newNull()) + doc.set(root, "seven", doc.newNull()), 0);
  t.ok("growth: reads back after it", doc.keyStart(root, 4) === 40 && doc.keyEnd(root, 4) === 46);
  t.eqStr("growth: a parsed value keeps its range", jrValue(doc, text, doc.get(root, "inner")), '{"x":0}');
  // `clear` with `keepRanges` on starts contents that keep ranges, so a loader builds into it.
  doc.clear();
  const v = doc.newString("y");
  t.eqI32("growth: after clear, a new value has no range", doc.start(v), -1);
  t.eqI32("growth: and takes one", doc.setRange(v, 0, 3), JSON_VALUE_OK);
};

const jrParsedEdits = (t: Suite): void => {
  // `set` over a parsed member replaces its value in place: the key keeps its parsed range, the value is the new one's.
  const doc = jrRanged();
  const text = '{"a":1,"b":[true]}';
  const root = doc.parseText(text);
  if (!t.ok("parsed edits: the document parses", root >= 0)) {
    return;
  }
  const old = doc.get(root, "a");
  t.eqI32("parsed edits: set over a parsed key", doc.set(root, "a", doc.newString("z")), JSON_VALUE_OK);
  t.eqStr("parsed edits: the key keeps its parsed range", jrKey(doc, text, root, 0), '"a"');
  t.eqI32("parsed edits: the new value has none", doc.start(doc.get(root, "a")), -1);
  t.eqStr("parsed edits: the replaced value keeps its own", jrValue(doc, text, old), "1");
  const given = doc.newI64(toI64(9));
  doc.setRange(given, 30, 31);
  t.eqI32("parsed edits: set again, with a value that has a range", doc.set(root, "a", given), JSON_VALUE_OK);
  t.ok("parsed edits: the member reads that range", doc.start(doc.get(root, "a")) === 30 && doc.end(doc.get(root, "a")) === 31);
  t.eqStr("parsed edits: and still its parsed key", jrKey(doc, text, root, 0), '"a"');
  // A push onto a parsed array goes through `append`, which moves the full parsed slots.
  const b = doc.get(root, "b");
  t.eqI32("parsed edits: a push onto a parsed array", doc.push(b, doc.newNull()), JSON_VALUE_OK);
  t.eqStr("parsed edits: the parsed element keeps its range", jrValue(doc, text, doc.at(b, 0)), "true");
  t.eqI32("parsed edits: the pushed one has none", doc.start(doc.at(b, 1)), -1);
  // Across documents: the next parse reuses the indices and slots the first one ranged, and a build writes -1 over them.
  const longer = '{"p":[1,2,3,4,5,6,7,8],"q":{"r":"s","t":"u"}}';
  const first = doc.parseText(longer);
  t.ok("parsed edits: a longer document parses", first >= 0);
  const second = doc.parseText('{"k":0}');
  t.ok("parsed edits: then a shorter one", second >= 0);
  const fresh = doc.newArray();
  t.ok("parsed edits: a value built on an index the longer one ranged has none", doc.start(fresh) === -1 && doc.end(fresh) === -1);
  t.eqI32("parsed edits: a set of a new key", doc.set(second, "n", fresh), JSON_VALUE_OK);
  t.ok("parsed edits: on a slot the longer one ranged has none", doc.keyStart(second, 1) === -1 && doc.keyEnd(second, 1) === -1);
  t.eqI32("parsed edits: a handle from the longer document is not adopted", doc.set(second, "m", doc.get(first, "q")), JSON_VALUE_ERR_HANDLE);
  t.eqI32("parsed edits: and adds no member", doc.length(second), 2);
};

const jrLimits = (t: Suite): void => {
  // `parseRanged` has its own refusals: each must answer what `parse` answers, at the same offset.
  const text = '[1,{"a":[2,3]},"s",[[[]]]]';
  const verdicts: string[] = [];
  for (let ranged: i32 = 0; ranged < 2; ranged += 1) {
    const limits = new JsonLimits();
    limits.maxDepth = 3;
    const doc = new JsonDocument(limits);
    doc.keepRanges = ranged === 1;
    doc.clear();
    const got: string[] = [];
    for (const cap of [2, 4, 6]) {
      doc.maxValues = cap;
      got.push(`${doc.parseText(text)}@${doc.errorAt}`);
    }
    doc.maxValues = 100;
    got.push(`${doc.parseText(text)}@${doc.errorAt}`);
    got.push(`${doc.parseText('{"a":1,"a":2}')}@${doc.errorAt}`);
    const ok = doc.parseText('[1,{"a":[2]}]');
    got.push(ok >= 0 ? doc.stringify(ok) : `${ok}`);
    verdicts.push(got.join(" "));
  }
  // An opener refused at the cap, two scalars refused at it, the depth limit, a duplicate, then a parse that succeeds.
  t.eqStr("limits: ranges off", verdicts[0], "-34@3 -34@9 -34@15 -9@21 -30@7 [1,{\"a\":[2]}]");
  t.eqStr("limits: ranges on answers the same", verdicts[1], verdicts[0]);
};

const jrMoves = (t: Suite): void => {
  // A longer document first, so that the slots past the next one's hold key ranges a move must not bring back.
  const doc = jrRanged();
  const parts: string[] = [];
  for (let i: i32 = 0; i < 64; i += 1) {
    parts.push(`"k${i}":${i}`);
  }
  t.ok("moves: a wide document parses", doc.parseText(`{${parts.join(",")}}`) >= 0);
  const text = '{"a":{"x":1},"b":{"y":2}}';
  const root = doc.parseText(text);
  if (!t.ok("moves: the document parses", root >= 0)) {
    return;
  }
  const a = doc.get(root, "a");
  const b = doc.get(root, "b");
  // `a`'s slot moves to the end with room for more, so the ranged slots stop short of the slot top.
  t.eqI32("moves: set of a new key on the first container", doc.set(a, "x2", doc.newNull()), JSON_VALUE_OK);
  // `b`'s slot is below the ranged ones and moves past `a`'s room: the slots between keep no range.
  t.eqI32("moves: and on the second", doc.set(b, "y2", doc.newNull()), JSON_VALUE_OK);
  t.eqStr("moves: the first container's parsed key keeps its range", jrKey(doc, text, a, 0), '"x"');
  t.ok("moves: its added key has none", doc.keyStart(a, 1) === -1 && doc.keyEnd(a, 1) === -1);
  t.eqStr("moves: the second container's parsed key keeps its range", jrKey(doc, text, b, 0), '"y"');
  t.ok("moves: its added key has none", doc.keyStart(b, 1) === -1 && doc.keyEnd(b, 1) === -1);
  t.eqI32("moves: a third key on the first container, in the room it had", doc.set(a, "x3", doc.newNull()), JSON_VALUE_OK);
  t.ok("moves: has no range, though the wide document ranged that slot", doc.keyStart(a, 2) === -1 && doc.keyEnd(a, 2) === -1);
  t.eqStr("moves: and the root's keys keep theirs", `${jrKey(doc, text, root, 0)},${jrKey(doc, text, root, 1)}`, '"a","b"');
};

export const main = (): number => {
  const t = new Suite("std/json-value ranges");
  jrKinds(t);
  jrNesting(t);
  jrWindow(t);
  jrDuplicates(t);
  jrOff(t);
  jrReparse(t);
  jrBuilders(t);
  jrGrowth(t);
  jrParsedEdits(t);
  jrLimits(t);
  jrMoves(t);
  return t.done();
};
