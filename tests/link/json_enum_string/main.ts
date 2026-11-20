// Typed JSON over a string enum: a field, an array, a `| null` array, a
// `Map` value and a union tag read the member's string and write it back,
// and one document in `shapes.ts` holds a field, an array, a `| null` array and
// a union tag at once.
// A string that is no member's value, and a value that is not a string, are
// `JSON_DECODE_TYPE` (-20), and the field keeps the member it held. Each line
// that ends in `true`/`false` says whether the encoding is the input again.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
import { Shape, account, figure } from "./shapes.ts";

enum Role {
  Admin = "admin",
  Guest = "guest",
  Owner = "owner",
  Anon = "",
  Cafe = "café",
  Quote = "a\"b\\c\n\u0001",
}

class User {
  role: Role = Role.Guest;
  roles: Role[];
  past: Role[] | null = null;
  grants: Map<string, Role>;
  constructor() {
    const none: Role[] = [];
    this.roles = none;
    this.grants = new Map<string, Role>();
  }
}

const bytes = (text: string): u8[] => {
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  return src;
};

const decoder = (text: string): JsonDecoder => {
  const src = bytes(text);
  return new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
};

const user = (text: string): void => {
  const d = decoder(text);
  const u = new User();
  const code = jsonDecode(d, u);
  const w = new JsonWriter(new Array<u8>(512), 0);
  jsonEncode(w, u);
  console.log(`${code} ${d.errorAt} ${String(u.role)} ${w.text()} ${w.text() === text}`);
};

// A member whose string needs escaping: the encoder escapes it, and the
// decoder reads the escaped form back as that member.
const quoted = (): void => {
  const u = new User();
  u.role = Role.Quote;
  const w = new JsonWriter(new Array<u8>(512), 0);
  jsonEncode(w, u);
  const text = w.text();
  const back = new User();
  const code = jsonDecode(decoder(text), back);
  console.log(`${text} ${code} ${back.role === Role.Quote}`);
};

export const main = (): i32 => {
  user(`{"role":"admin","roles":["owner","guest",""],"past":null,"grants":{"a":"admin"}}`);
  user(`{"role":"café","roles":[],"past":["admin"],"grants":{}}`);
  // Escaped, the string is still the member's: the encoding writes it plain.
  user(`{"role":"\\u0061dmin","roles":["gu\\u0065st"],"past":null,"grants":{}}`);
  // No member's string, a prefix of one, and a value that is not a string.
  user(`{"role":"root","roles":[],"past":null,"grants":{}}`);
  user(`{"role":"admi","roles":[],"past":null,"grants":{}}`);
  user(`{"role":"admins","roles":[],"past":null,"grants":{}}`);
  user(`{"role":0,"roles":[],"past":null,"grants":{}}`);
  user(`{"role":"guest","roles":["admin","nobody"],"past":null,"grants":{}}`);
  user(`{"role":"guest","roles":[],"past":null,"grants":{"x":"Admin"}}`);
  // A non-member and a non-string element in the `| null` array.
  user(`{"role":"guest","roles":[],"past":["admin","root"],"grants":{}}`);
  user(`{"role":"guest","roles":[],"past":["admin",1],"grants":{}}`);
  quoted();
  figure(`{"kind":"circle","r":1}`);
  figure(`{"kind":"square","side":2}`);
  figure(`{"kind":"amoeba"}`);
  figure(`{"kind":"blob"}`);
  figure(`{"kind":"Circle","r":1}`);
  account(`{"shape":"blob","shapes":["square","circle"],"past":["circle"],"figure":{"kind":"amoeba"}}`);
  account(`{"shape":"circle","shapes":[],"past":null,"figure":{"kind":"square","side":2}}`);
  // The enum's strings cross the module boundary with its type.
  console.log(String(Shape.Blob));
  return 0;
};
