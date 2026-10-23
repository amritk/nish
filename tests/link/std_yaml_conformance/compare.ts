// Holds a parsed YAML document to the JSON the yaml-test-suite expects of it.
// There is no YAML-to-JSON writer in std/, so the comparer walks the YamlStream
// beside a JsonDocument: a scalar matches a JSON value of its resolved type (a
// number by value), a sequence an array in order, and a map an object by
// `keyText`, in any order, the last of duplicate keys winning and `<<` merge
// keys applied. Aliases are followed, and every node visited is counted
// against a budget, so an alias bomb fails its case instead of hanging.
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
} from "../../../std/json-value";
import {
  YAML_ALIAS,
  YAML_BOOL,
  YAML_FLOAT,
  YAML_INT,
  YAML_MAP,
  YAML_NULL,
  YAML_PLAIN,
  YAML_SCALAR,
  YAML_SEQ,
  YAML_STRING,
  YamlStream,
  keyText,
} from "../../../std/yaml";

/** The most alias hops followed in a row, and merge levels, as std/yaml allows. */
const YC_ALIAS_HOPS: i32 = 100;

/** The most nodes one case may visit, aliases expanded. */
export const YC_NODE_BUDGET: i32 = 100000;

/** A map's pairs as matched against an object: each key's text and its value node. */
class YcPairs {
  keys: string[];
  values: i32[];

  constructor() {
    this.keys = [];
    this.values = [];
  }

  /** Sets `key` to `value`, replacing an earlier pair with the key when `replace`. */
  put(key: string, value: i32, replace: boolean): void {
    let i: i32 = 0;
    while (i < toI32(this.keys.length)) {
      if (this.keys[i] === key) {
        if (replace) {
          this.values[i] = value;
        }
        return;
      }
      i += 1;
    }
    this.keys.push(key);
    this.values.push(value);
  }
}

/** One document's comparison: the first mismatch is kept in `detail`. */
export class YcComparer {
  stream: YamlStream;
  json: JsonDocument;
  /** How many nodes the comparison may visit, and has. */
  budget: i32 = 0;
  visited: i32 = 0;
  detail: string = "";

  constructor(stream: YamlStream, json: JsonDocument, budget: i32) {
    this.stream = stream;
    this.json = json;
    this.budget = budget;
  }

  /** Records a mismatch at `where`; answers `false`. */
  differ(where: string, what: string): boolean {
    if (this.detail === "") {
      this.detail = `${where}: ${what}`;
    }
    return false;
  }

  /** Node `n` with its aliases followed; `-1` for an unresolved alias or too many hops. */
  follow(n: i32): i32 {
    let at: i32 = n;
    let hops: i32 = 0;
    while (at >= 0 && this.stream.kind(at) === YAML_ALIAS) {
      if (hops === YC_ALIAS_HOPS) {
        return -1;
      }
      at = this.stream.target(at);
      hops += 1;
    }
    return at;
  }

  /** Whether pair `pair`'s key is a merge key: a plain `<<`, untagged or `!!merge`. */
  isMerge(pair: i32): boolean {
    const key: i32 = this.stream.key(pair);
    return (
      key >= 0 &&
      this.stream.kind(key) === YAML_SCALAR &&
      this.stream.style(key) === YAML_PLAIN &&
      (this.stream.tag(key) === "" || this.stream.tag(key) === "merge") &&
      this.stream.text(key) === "<<"
    );
  }

  /** Adds map `map`'s pairs to `into`: its own (the last duplicate winning) over its merged ones (the first listed winning). */
  collect(map: i32, into: YcPairs, own: boolean, depth: i32): boolean {
    const stream = this.stream;
    if (depth > YC_ALIAS_HOPS) {
      return false;
    }
    const count: i32 = stream.count(map);
    const mine = new YcPairs();
    for (let i: i32 = 0; i < count; i += 1) {
      const pair: i32 = stream.child(map, i);
      if (!this.isMerge(pair)) {
        mine.put(keyText(stream, stream.key(pair)), stream.value(pair), true);
      }
    }
    for (let i: i32 = 0; i < toI32(mine.keys.length); i += 1) {
      into.put(mine.keys[i], mine.values[i], own);
    }
    for (let i: i32 = 0; i < count; i += 1) {
      const pair: i32 = stream.child(map, i);
      if (!this.isMerge(pair)) {
        continue;
      }
      const value: i32 = this.follow(stream.value(pair));
      if (value >= 0 && stream.kind(value) === YAML_MAP) {
        if (!this.collect(value, into, false, depth + 1)) {
          return false;
        }
      } else if (value >= 0 && stream.kind(value) === YAML_SEQ) {
        for (let j: i32 = 0; j < stream.count(value); j += 1) {
          const item: i32 = this.follow(stream.child(value, j));
          if (item < 0 || stream.kind(item) !== YAML_MAP || !this.collect(item, into, false, depth + 1)) {
            return false;
          }
        }
      } else {
        return false;
      }
    }
    return true;
  }

  /** Whether node `n` of the stream equals JSON value `v`; `where` names it in a mismatch. */
  same(n: i32, v: i32, where: string): boolean {
    this.visited += 1;
    if (this.visited > this.budget) {
      return this.differ(where, `more than ${this.budget} nodes`);
    }
    const stream = this.stream;
    const json = this.json;
    const at: i32 = this.follow(n);
    if (n >= 0 && at < 0) {
      return this.differ(where, "an alias that resolves to no node");
    }
    const kind: i32 = json.kind(v);
    const yamlKind: i32 = at < 0 ? YAML_SCALAR : stream.kind(at);
    if (yamlKind === YAML_SCALAR) {
      const type: i32 = at < 0 ? YAML_NULL : stream.type(at);
      if (kind === JSON_VALUE_NULL) {
        return type === YAML_NULL || this.differ(where, `expected null, got type ${type}`);
      }
      if (kind === JSON_VALUE_BOOLEAN) {
        return (
          (type === YAML_BOOL && stream.boolValue(at) === json.boolean(v)) ||
          this.differ(where, `expected ${json.boolean(v)}, got type ${type}`)
        );
      }
      if (kind === JSON_VALUE_NUMBER) {
        return (
          ((type === YAML_INT || type === YAML_FLOAT) && stream.floatValue(at) === json.f64(v)) ||
          this.differ(where, `expected ${json.numberText(v)}, got type ${type} ${stream.text(at)}`)
        );
      }
      if (kind === JSON_VALUE_STRING) {
        const text: string = at < 0 ? "" : stream.text(at);
        return (
          (type === YAML_STRING && text === json.string(v)) ||
          this.differ(where, `expected "${json.string(v)}", got type ${type} "${text}"`)
        );
      }
      return this.differ(where, "expected a collection, got a scalar");
    }
    if (yamlKind === YAML_SEQ) {
      if (kind !== JSON_VALUE_ARRAY) {
        return this.differ(where, "expected no array, got a sequence");
      }
      const count: i32 = stream.count(at);
      if (count !== json.length(v)) {
        return this.differ(where, `expected ${json.length(v)} items, got ${count}`);
      }
      for (let i: i32 = 0; i < count; i += 1) {
        if (!this.same(stream.child(at, i), json.at(v, i), `${where}[${i}]`)) {
          return false;
        }
      }
      return true;
    }
    if (yamlKind === YAML_MAP) {
      if (kind !== JSON_VALUE_OBJECT) {
        return this.differ(where, "expected no object, got a map");
      }
      const pairs = new YcPairs();
      if (!this.collect(at, pairs, true, 0)) {
        return this.differ(where, "a merge key that names no map");
      }
      const count: i32 = toI32(pairs.keys.length);
      if (count !== json.length(v)) {
        return this.differ(where, `expected ${json.length(v)} keys, got ${count}`);
      }
      for (let i: i32 = 0; i < count; i += 1) {
        const key: string = pairs.keys[i];
        const member: i32 = json.get(v, key);
        if (member < 0) {
          return this.differ(where, `no expected key "${key}"`);
        }
        if (!this.same(pairs.values[i], member, `${where}.${key}`)) {
          return false;
        }
      }
      return true;
    }
    return this.differ(where, `an unexpected node kind ${yamlKind}`);
  }
}

/** Each top-level value of a JSON stream, as text; `null` when it is not one. */
export const ycSplitJson = (text: string): string[] | null => {
  const out: string[] = [];
  const n: i32 = toI32(text.length);
  let i: i32 = 0;
  while (true) {
    while (i < n && ycIsSpace(toI32(text.charCodeAt(i)))) {
      i += 1;
    }
    if (i >= n) {
      return out;
    }
    const from: i32 = i;
    let depth: i32 = 0;
    let quoted: boolean = false;
    while (i < n) {
      const c: i32 = toI32(text.charCodeAt(i));
      if (quoted) {
        if (c === 92) {
          i += 1;
        } else if (c === 34) {
          quoted = false;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      } else if (c === 34) {
        quoted = true;
      } else if (c === 123 || c === 91) {
        depth += 1;
      } else if (c === 125 || c === 93) {
        depth -= 1;
        if (depth < 0) {
          return null;
        }
        if (depth === 0) {
          i += 1;
          break;
        }
      } else if (depth === 0 && ycIsSpace(c)) {
        break;
      }
      i += 1;
    }
    if (quoted || depth !== 0) {
      return null;
    }
    out.push(text.slice(from, i));
  }
};

const ycIsSpace = (c: i32): boolean => c === 32 || c === 9 || c === 10 || c === 13;
