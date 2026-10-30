// `nish/json-pointer`'s tokens, escapes and resolutions on RFC 6901's
// examples and every way a pointer names nothing, and the two form checks.
import {
  JSON_POINTER_ERR_SYNTAX,
  JSON_POINTER_NONE,
  isJsonPointer,
  isRelativeJsonPointer,
  jsonPointerEscape,
  jsonPointerParse,
  jsonPointerResolve,
} from "nish/json-pointer";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument, JsonValue } from "nish/json-value";
import { Suite } from "nish/testing";

/** The tokens of `p` joined by `|`, or `null` when it is refused. */
const jpTokens = (p: string): string => {
  const tokens = jsonPointerParse(p);
  return tokens === null ? "null" : `${tokens.length}:${tokens.join("|")}`;
};

const jpParse = (t: Suite): void => {
  t.eqStr("parse: the empty pointer has no tokens", jpTokens(""), "0:");
  t.eqStr("parse: / is one empty token", jpTokens("/"), "1:");
  t.eqStr("parse: ~1 and ~0 decode", jpTokens("/a~1b//~0"), "3:a/b||~");
  t.eqStr("parse: ~01 is ~ then 1, not /", jpTokens("/~01"), "1:~1");
  t.eqStr("parse: a pointer not led by / is refused", jpTokens("a"), "null");
  t.eqStr("parse: a bare ~ is refused", jpTokens("/a~"), "null");
  t.eqStr("parse: ~2 is refused", jpTokens("/~2"), "null");
};

const jpEscape = (t: Suite): void => {
  t.eqStr("escape: / and ~", jsonPointerEscape("a/b~c"), "a~1b~0c");
  t.eqStr("escape: nothing to escape", jsonPointerEscape("plain"), "plain");
  t.eqStr("escape: round trips through parse", jpTokens(`/${jsonPointerEscape("~/~1")}`), "1:~/~1");
  t.eqStr("escape: text past U+00FF is copied whole", jsonPointerEscape("é/€~Ā"), "é~1€~0Ā");
  t.eqStr("parse: text past U+00FF is copied whole", jpTokens("/€~1Ā/é~0"), "2:€/Ā|é~");
};

const jpResolve = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  // RFC 6901 §5's document.
  const root: JsonValue = doc.parseText(
    '{"foo":["bar","baz"],"":0,"a/b":1,"c%d":2,"e^f":3,"g|h":4,"i\\\\j":5,"k\\"l":6," ":7,"m~n":8,"big":[10,20,30]}'
  );
  t.eqBool("resolve: the empty pointer is the root", jsonPointerResolve(doc, root, "") === root, true);
  t.eqStr("resolve: /foo/0", doc.string(jsonPointerResolve(doc, root, "/foo/0")), "bar");
  const rfc: string[] = ["/", "/a~1b", "/c%d", "/e^f", "/g|h", "/i\\j", '/k"l', "/ ", "/m~0n"];
  const got: string[] = [];
  for (const p of rfc) {
    got.push(`${doc.i64(jsonPointerResolve(doc, root, p))}`);
  }
  t.eqStr("resolve: RFC 6901's examples", got.join(" "), "0 1 2 3 4 5 6 7 8");
  t.eqI32("resolve: /big/2", toI32(doc.i64(jsonPointerResolve(doc, root, "/big/2"))), 30);
  t.eqI32("resolve: a missing key", jsonPointerResolve(doc, root, "/nope"), JSON_POINTER_NONE);
  t.eqI32("resolve: - names nothing", jsonPointerResolve(doc, root, "/big/-"), JSON_POINTER_NONE);
  t.eqI32("resolve: an index past the end", jsonPointerResolve(doc, root, "/big/3"), JSON_POINTER_NONE);
  t.eqI32("resolve: a leading zero", jsonPointerResolve(doc, root, "/big/01"), JSON_POINTER_NONE);
  t.eqI32("resolve: an index that is not digits", jsonPointerResolve(doc, root, "/big/1a"), JSON_POINTER_NONE);
  t.eqI32("resolve: an empty index", jsonPointerResolve(doc, root, "/big/"), JSON_POINTER_NONE);
  t.eqI32(
    "resolve: an index past any integer, without overflow",
    jsonPointerResolve(doc, root, "/big/99999999999999999999999999999999"),
    JSON_POINTER_NONE
  );
  t.eqI32("resolve: a token on a scalar", jsonPointerResolve(doc, root, "/big/0/x"), JSON_POINTER_NONE);
  t.eqI32("resolve: past a missing member", jsonPointerResolve(doc, root, "/nope/0/1"), JSON_POINTER_NONE);
  t.eqI32("resolve: a root naming no value", jsonPointerResolve(doc, -1, ""), JSON_POINTER_NONE);
  t.eqI32("resolve: a text that is not a pointer", jsonPointerResolve(doc, root, "foo"), JSON_POINTER_ERR_SYNTAX);
  t.eqI32("resolve: a bad escape", jsonPointerResolve(doc, root, "/m~2n"), JSON_POINTER_ERR_SYNTAX);
  const empty: JsonValue = doc.parseText("[]");
  t.eqI32("resolve: /0 of an empty array", jsonPointerResolve(doc, empty, "/0"), JSON_POINTER_NONE);
};

const jpForms = (t: Suite): void => {
  const pointers: string[] = ["", "/", "/a", "//", "/~0~1", "/a b/%25"];
  const notPointers: string[] = ["a", "#", "#/a", "/~", "/~2", "/a~", "~0", " /"];
  const relative: string[] = ["0", "1", "10", "0#", "1#", "0/", "2/a~1b", "120/0/1", "0/~0", "0+1", "1-1/a", "2+0", "0-0", "0+10/a", "3-2/"];
  const notRelative: string[] = ["", "#", "/a", "01", "-1", "+1", "0##", "1#/a", "0~0", "1 ", "0/~", "a", "0+1#", "1-1#", "0+01", "0+", "0-", "0+1+1", "0+-1", "0++1", "+0", "0+a", "0-1~"];
  const wrong: string[] = [];
  for (const s of pointers) {
    if (!isJsonPointer(s)) {
      wrong.push(`"${s}" is a pointer`);
    }
  }
  for (const s of notPointers) {
    if (isJsonPointer(s)) {
      wrong.push(`"${s}" is not a pointer`);
    }
  }
  for (const s of relative) {
    if (!isRelativeJsonPointer(s)) {
      wrong.push(`"${s}" is relative`);
    }
  }
  for (const s of notRelative) {
    if (isRelativeJsonPointer(s)) {
      wrong.push(`"${s}" is not relative`);
    }
  }
  t.eqStr("forms: every text is judged", wrong.join("; "), "");
};

export const jpUnits = (t: Suite): void => {
  jpParse(t);
  jpEscape(t);
  jpResolve(t);
  jpForms(t);
};
