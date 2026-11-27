// `nish/net/http-fields`'s `mediaTypeParse`, `formDataDispositionParse` and
// `mediaTypeParam`: tokens and their case, quoted strings and their escapes,
// whitespace around `;` and `=`, a repeated parameter, the cap of 16
// parameters, and each shape refused.
// A form-data disposition keeps a backslash as a backslash (the HTML form
// submission algorithm escapes `"` as `%22` instead), which is the one place
// the two readers differ.
import { Suite } from "nish/testing";
import { formDataDispositionParse, httpFieldBytes, MediaType, mediaTypeParam, mediaTypeParse } from "nish/net/http-fields";

/** A media type written back as `type/subtype;name=value;...`, or `null`. */
const shown = (m: MediaType | null): string => {
  if (m === null) {
    return "null";
  }
  const parts: string[] = [`${m.type}/${m.subtype}`];
  const names: string[] = m.names;
  const values: string[] = m.values;
  for (let i: i32 = 0; i < toI32(names.length); i += 1) {
    if (i >= 0 && i < toI32(names.length) && i < toI32(values.length)) {
      parts.push(`${names[i]}=${values[i]}`);
    }
  }
  return parts.join(";");
};

/** `value` read as a `Content-Type`, written back by `shown`. */
const media = (value: string): string => {
  const v: u8[] = httpFieldBytes(value);
  return shown(mediaTypeParse(v, 0, toI32(v.length)));
};

/** `value` read as a form-data `Content-Disposition`, written back by `shown`. */
const disposition = (value: string): string => {
  const v: u8[] = httpFieldBytes(value);
  return shown(formDataDispositionParse(v, 0, toI32(v.length)));
};

/** Parameter `name` of `value` read as a `Content-Type`, or `null` either way. */
const param = (value: string, name: string): string => {
  const v: u8[] = httpFieldBytes(value);
  const m: MediaType | null = mediaTypeParse(v, 0, toI32(v.length));
  if (m === null) {
    return "no media type";
  }
  const p: string | null = mediaTypeParam(m, name);
  return p === null ? "null" : p;
};

/** `count` parameters `; p0=1; p1=1; ...` after `head`. */
const params = (head: string, count: i32): string => {
  const parts: string[] = [head];
  for (let k: i32 = 0; k < count; k += 1) {
    parts.push(`; p${k}=1`);
  }
  return parts.join("");
};

export const main = (): i32 => {
  const t: Suite = new Suite("net_media_type");

  t.eqStr("a bare type", media("text/plain"), "text/plain");
  t.eqStr("type and subtype are lowercased", media("Multipart/Form-Data"), "multipart/form-data");
  t.eqStr("a token parameter", media("multipart/form-data; boundary=abc"), "multipart/form-data;boundary=abc");
  t.eqStr("a parameter name is lowercased, its value is not", media("a/b; Boundary=AbC"), "a/b;boundary=AbC");
  t.eqStr("a quoted value loses its quotes", media("a/b; x=\"q r\""), "a/b;x=q r");
  t.eqStr("a quoted-pair escapes a quote", media("a/b; x=\"a\\\"b\""), "a/b;x=a\"b");
  t.eqStr("a quoted-pair escapes a backslash", media("a/b; x=\"a\\\\b\""), "a/b;x=a\\b");
  t.eqStr("an empty quoted value", media("a/b; x=\"\""), "a/b;x=");
  t.eqStr("whitespace before and after ;", media("a/b \t;\t x=1 ; y=2"), "a/b;x=1;y=2");
  t.eqStr("empty parameters are skipped", media("a/b;; ;x=1;"), "a/b;x=1");
  t.eqStr("parameters keep their order", media("a/b; z=1; a=2; m=3"), "a/b;z=1;a=2;m=3");
  t.eqStr("a tchar-only type", media("application/vnd.a+b-c_d!#$%&'*^`|~"), "application/vnd.a+b-c_d!#$%&'*^`|~");

  t.eqStr("refused: an empty value", media(""), "null");
  t.eqStr("refused: no slash", media("text"), "null");
  t.eqStr("refused: an empty subtype", media("text/"), "null");
  t.eqStr("refused: an empty type", media("/plain"), "null");
  t.eqStr("refused: a space inside the type", media("te xt/plain"), "null");
  t.eqStr("refused: a space around the slash", media("text /plain"), "null");
  t.eqStr("refused: a parameter with no =", media("a/b; x"), "null");
  t.eqStr("refused: whitespace before =", media("a/b; x =1"), "null");
  t.eqStr("refused: whitespace after =", media("a/b; x= 1"), "null");
  t.eqStr("refused: an empty token value", media("a/b; x="), "null");
  t.eqStr("refused: an unclosed quoted value", media("a/b; x=\"abc"), "null");
  t.eqStr("refused: a backslash ends the value", media("a/b; x=\"abc\\"), "null");
  t.eqStr("refused: a control character in quotes", media("a/b; x=\"a\x01b\""), "null");
  t.eqStr("refused: text after a quoted value", media("a/b; x=\"a\"b"), "null");
  t.eqStr("refused: a parameter named twice", media("a/b; x=1; x=2"), "null");
  t.eqStr("refused: named twice in two cases", media("a/b; boundary=1; BOUNDARY=2"), "null");
  t.ok("16 parameters parse", media(params("a/b", 16)) !== "null");
  t.eqStr("refused: a 17th parameter", media(params("a/b", 17)), "null");
  t.ok("16 parameters on a disposition parse", disposition(params("form-data", 16)) !== "null");
  t.eqStr("refused: a 17th parameter on a disposition", disposition(params("form-data", 17)), "null");
  t.eqStr("refused: a non-tchar in a token value", media("a/b; x=a,b"), "null");

  const v: u8[] = httpFieldBytes("xx text/plain; a=1 yy");
  t.eqStr("a window inside the array", shown(mediaTypeParse(v, 3, 19)), "text/plain;a=1");
  t.eqStr("refused: a window starting below 0", shown(mediaTypeParse(v, -1, 5)), "null");
  t.eqStr("refused: a window past the array", shown(mediaTypeParse(v, 3, 100)), "null");
  t.eqStr("refused: a window that ends before it starts", shown(mediaTypeParse(v, 10, 3)), "null");

  t.eqStr("a parameter looked up in another case", param("a/b; Boundary=xyz", "BOUNDARY"), "xyz");
  t.eqStr("an absent parameter is null", param("a/b; x=1", "y"), "null");
  t.eqStr("a quoted parameter looked up", param("a/b; charset=\"utf-8\"", "charset"), "utf-8");

  t.eqStr("a form-data disposition", disposition("form-data; name=\"a\""), "form-data/;name=a");
  t.eqStr("its type is lowercased", disposition("Form-Data; Name=\"a\""), "form-data/;name=a");
  t.eqStr("a filename beside the name", disposition("form-data; name=\"f\"; filename=\"x.txt\""), "form-data/;name=f;filename=x.txt");
  t.eqStr("a backslash in a form-data value is kept", disposition("form-data; name=\"f\"; filename=\"C:\\x.txt\""), "form-data/;name=f;filename=C:\\x.txt");
  t.eqStr("so a backslash before the closing quote does not escape it", disposition("form-data; name=\"a\\\""), "form-data/;name=a\\");
  t.eqStr("a percent-escaped quote is kept as given", disposition("form-data; name=\"a%22b\""), "form-data/;name=a%22b");
  t.eqStr("a token name", disposition("form-data; name=a"), "form-data/;name=a");
  t.eqStr("refused: a disposition named twice", disposition("form-data; name=a; NAME=b"), "null");
  t.eqStr("refused: no type", disposition("; name=a"), "null");
  t.eqStr("refused: an unclosed name", disposition("form-data; name=\"a"), "null");
  t.eqStr("refused: a quote after a kept backslash", disposition("form-data; name=\"a\\\"b\""), "null");
  return t.done();
};
