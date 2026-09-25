// The driver for the Wave C support library (docs/wp14-selfhost.md §3): it
// prints what `self/strings.ts`, `self/map.ts` and `self/paths.ts` compute for
// every case in `tests/self/cases.txt` plus the ranges generated below, and
// `tests/self/support_oracle.js` prints the same thing from Node — from
// its golden for the answers recorded from stage0, from `node:path` for
// the path functions, and from `JSON.stringify`, `Buffer.compare` and `Map`
// for the rest — and diffs.
//
// Rule 3 of §6 is why this exists: nothing in `self/` is checked against a
// golden somebody typed. Every line below has an implementation on the other
// side that was written first and is already trusted.

import {
  compareStrings,
  f32Hex,
  f64Hex,
  hexOfI64,
  irEscape,
  jsonQuote,
  repeatString,
  splitByte,
  StringBuilder,
} from "../../self/strings";
import { hashString, StringMap, StringSet } from "../../self/map";
import { nishExportTarget } from "../../self/manifest";
import { parseBareSpecifier } from "../../self/packages";
import {
  basename,
  basenameWithout,
  dirname,
  joinPath,
  normalizePath,
  relativePath,
  resolveModule,
  resolvePath,
} from "../../self/paths";

const TAB: i32 = 9;
const NEWLINE: i32 = 10;
const HASH: i32 = 35;

/** The non-comment, non-blank lines of the case file. */
function caseLines(text: string): string[] {
  const lines: string[] = [];
  for (const line of splitByte(text, NEWLINE)) {
    if (line.length > 0 && line.charCodeAt(0) !== HASH) {
      lines.push(line);
    }
  }
  return lines;
}

/** Every string function, over one case from the `text` section. */
function reportText(out: string[], value: string): void {
  out.push(`json ${jsonQuote(value)}`);
  out.push(`ir ${irEscape(value)}`);
  out.push(`hash ${hashString(value)}`);
  out.push(`split ${jsonQuote(splitByte(value, 47).join("|"))}`);
  out.push(`repeat ${jsonQuote(repeatString(value, 3))}`);
}

/** Every path function, over one `base<TAB>spec` case. */
function reportPath(out: string[], base: string, spec: string): void {
  out.push(`normalize ${jsonQuote(normalizePath(base))}`);
  out.push(`dirname ${jsonQuote(dirname(base))}`);
  out.push(`basename ${jsonQuote(basename(base))}`);
  out.push(`stem ${jsonQuote(basenameWithout(base, ".ts"))}`);
  out.push(`resolve ${jsonQuote(resolvePath(base, spec))}`);
  out.push(`module ${jsonQuote(resolveModule(base, spec))}`);
}

/** `relativePath`, over one `from<TAB>to` case; both are rooted at the same base. */
function reportRelative(out: string[], from: string, to: string): void {
  out.push(`relative ${jsonQuote(relativePath(from, to))}`);
}

/**
 * `self/manifest.ts` and `self/packages.ts`, over one `pkg` or `spec` case
 * (WP21 S2). These are the two halves of resolving a bare specifier, and they
 * are here because both are hand-written scanners with a stage0 twin that has
 * to select the *same file for the same manifest*: a package that resolved
 * under one compiler and not the other is a program that compiles with one and
 * not the other, which no golden of one compiler's own output would catch.
 */
function reportPackage(out: string[], subpath: string, primary: string, fallback: string, manifest: string): void {
  const target = nishExportTarget(manifest, subpath, primary, fallback);
  out.push(`pkg ${target === null ? "null" : jsonQuote(target)}`);
}

/** `parseBareSpecifier`, over one `spec` case: the name and the `exports` key. */
function reportSpecifier(out: string[], specifier: string): void {
  const parsed = parseBareSpecifier(specifier);
  if (parsed === null) {
    out.push("spec null");
    return;
  }
  out.push(`spec ${jsonQuote(parsed.name)} ${jsonQuote(parsed.subpath)}`);
}

/**
 * The map, against the same cases: insert in order, look every key up, then
 * overwrite. The oracle drives a JavaScript `Map` through the same script, so
 * what is compared is the iteration order too — the reason for the dense
 * entry list in `self/map.ts`.
 */
function reportMap(out: string[], keys: string[]): void {
  const map = new StringMap();
  let i = 0;
  while (i < keys.length) {
    map.set(keys[i], i);
    i = i + 1;
  }
  out.push(`map size ${map.size()}`);
  i = 0;
  while (i < map.size()) {
    out.push(`map entry ${i} ${jsonQuote(map.keyAt(i))} ${map.valueAt(i)}`);
    i = i + 1;
  }
  for (const key of keys) {
    out.push(`map get ${jsonQuote(key)} ${map.get(key, -1)}`);
  }
  out.push(`map missing ${map.get("no such key", -1)} ${map.has("no such key") ? 1 : 0}`);
  // Overwriting must not append an entry, and must not move the one it hits.
  for (const key of keys) {
    map.set(key, 1000);
  }
  out.push(`map size after overwrite ${map.size()}`);
  out.push(`map first after overwrite ${jsonQuote(map.keyAt(0))} ${map.valueAt(0)}`);

  const set = new StringSet();
  let added = 0;
  for (const key of keys) {
    if (set.add(key)) {
      added = added + 1;
    }
  }
  out.push(`set size ${set.size()} added ${added}`);
}

/**
 * Growth: 300 keys is past four rehashes from the initial 16 buckets, so this
 * is the check that `grow` re-files every entry and keeps insertion order.
 */
function reportGrowth(out: string[]): void {
  const map = new StringMap();
  let i = 0;
  while (i < 300) {
    map.set(`key${i}`, i * 7);
    i = i + 1;
  }
  let sum = 0;
  i = 0;
  while (i < 300) {
    sum = sum + map.get(`key${i}`, -1);
    i = i + 1;
  }
  out.push(`grow size ${map.size()} sum ${sum} slots ${map.slots.length}`);
  out.push(`grow order ${jsonQuote(map.keyAt(0))} ${jsonQuote(map.keyAt(299))}`);

  // 100000 keys take the table to 2^18 buckets, past the 2^16 where the
  // bucket index starts to draw on the bits the fold XORs in. Every re-file
  // is from the stored hashes, so a wrong one loses a key here. The 2^24 - 1
  // entry cap is not driven: reaching it is gigabytes of arena for a panic.
  const big = new StringMap();
  i = 0;
  while (i < 100000) {
    big.set(`n${i}`, i);
    i = i + 1;
  }
  let wrong = 0;
  let strays = 0;
  i = 0;
  while (i < 100000) {
    if (big.get(`n${i}`, -1) !== i) {
      wrong = wrong + 1;
    }
    if (big.has(`m${i}`)) {
      strays = strays + 1;
    }
    i = i + 1;
  }
  out.push(`grow size ${big.size()} wrong ${wrong} slots ${big.slots.length} strays ${strays}`);
  out.push(`grow order ${jsonQuote(big.keyAt(0))} ${jsonQuote(big.keyAt(99999))}`);
}

/**
 * The probe's two filters, each turned away on purpose. The first is a key
 * with the resident key's fingerprint and home bucket (of a fresh map's 16)
 * but another hash: the probe looks into the entry and the stored hash sends
 * it on. The second is a real FNV-1a collision, found by a birthday search:
 * the hash matches too, and only the string compare tells the keys apart.
 */
function reportProbe(out: string[]): void {
  const resident = hashString("k0");
  let i = 1;
  let twin = "";
  while (twin.length === 0) {
    const candidate = `k${i}`;
    const hash = hashString(candidate);
    const sameFingerprint = toU32(hash) >>> 24 === toU32(resident) >>> 24;
    const sameHome = ((hash ^ (hash >>> 16)) & 15) === ((resident ^ (resident >>> 16)) & 15);
    if (sameFingerprint && sameHome && hash !== resident) {
      twin = candidate;
    }
    i = i + 1;
  }
  const map = new StringMap();
  map.set("k0", 1);
  const before = map.get(twin, -1);
  map.set(twin, 2);
  out.push(`probe fingerprint ${jsonQuote(twin)} ${before} ${map.get("k0", -1)} ${map.get(twin, -1)} ${map.size()}`);

  const collided = new StringMap();
  collided.set("c2ya8", 1);
  const missed = collided.get("czki6", -1);
  collided.set("czki6", 2);
  out.push(
    `probe collision ${hashString("c2ya8")} ${hashString("czki6")} ${missed} ${collided.get("c2ya8", -1)} ${collided.get("czki6", -1)} ${collided.size()} ${jsonQuote(collided.keyAt(1))}`
  );
  const set = new StringSet();
  const first = set.add("c2ya8");
  const second = set.add("czki6");
  const again = set.add("c2ya8");
  out.push(`probe set ${first ? 1 : 0} ${second ? 1 : 0} ${again ? 1 : 0} ${set.size()}`);
}

export function main(): number {
  if (process.argv.length < 2) {
    console.error("usage: support <cases.txt>");
    return 2;
  }
  const source = readFileSyncOrNull(process.argv[1]);
  if (source === null) {
    console.error(`support: cannot read ${process.argv[1]}`);
    return 1;
  }

  const out: string[] = [];
  const texts: string[] = [];
  for (const line of caseLines(source)) {
    const fields = splitByte(line, TAB);
    const section = fields[0];
    if (section === "text") {
      texts.push(fields[1]);
      out.push(`# text ${jsonQuote(fields[1])}`);
      reportText(out, fields[1]);
    } else if (section === "path") {
      out.push(`# path ${jsonQuote(fields[1])} ${jsonQuote(fields[2])}`);
      reportPath(out, fields[1], fields[2]);
    } else if (section === "rel") {
      out.push(`# rel ${jsonQuote(fields[1])} ${jsonQuote(fields[2])}`);
      reportRelative(out, fields[1], fields[2]);
    } else if (section === "pkg") {
      out.push(`# pkg ${jsonQuote(fields[1])} ${fields[2]} ${fields[3]} ${jsonQuote(fields[4])}`);
      reportPackage(out, fields[1], fields[2], fields[3], fields[4]);
    } else if (section === "spec") {
      out.push(`# spec ${jsonQuote(fields[1])}`);
      reportSpecifier(out, fields[1]);
    } else if (section === "num") {
      out.push(`# num ${fields[1]}`);
      out.push(`f64 ${f64Hex(Number(fields[1]))}`);
      out.push(`f32 ${f32Hex(Number(fields[1]))}`);
    } else {
      console.error(`support: unknown section \`${section}\``);
      return 1;
    }
  }

  // Ordering, over every pair of text cases: the sign is what a sort reads.
  for (const a of texts) {
    for (const b of texts) {
      out.push(`compare ${jsonQuote(a)} ${jsonQuote(b)} ${compareStrings(a, b)}`);
    }
  }

  // Every byte, which is where the two escapes differ from each other.
  let byte = 0;
  while (byte < 256) {
    const one = String.fromCharCode(byte);
    out.push(`byte ${byte} ${irEscape(one)}`);
    if (byte < 128) {
      out.push(`byte json ${byte} ${jsonQuote(one)}`);
    }
    byte = byte + 1;
  }

  // Every bit position, which is where the hex formatter's shifting is.
  let bit = 0;
  while (bit < 64) {
    out.push(`bit ${bit} ${hexOfI64(toI64(1) << toI64(bit), 16)}`);
    bit = bit + 1;
  }

  out.push(`join ${jsonQuote(joinPath(["a", "", "b/../c", "."]))}`);
  const builder = new StringBuilder();
  out.push(`builder empty ${builder.isEmpty() ? 1 : 0} ${builder.length()}`);
  builder.add("ab");
  builder.addChar(99);
  out.push(`builder ${jsonQuote(builder.toText())} ${builder.length()} ${builder.isEmpty() ? 1 : 0}`);
  builder.reset();
  out.push(`builder reset ${jsonQuote(builder.toText())} ${builder.isEmpty() ? 1 : 0}`);

  reportMap(out, texts);
  reportGrowth(out);
  reportProbe(out);

  write(`${out.join("\n")}\n`);
  return 0;
}
