// A JSON Merge Patch (RFC 7396) applied to a typed record, with typed JSON's
// `presence` option telling a key that was left out from one that was given:
//
//     build/nish examples/merge-patch.ts --link build/merge-patch
//     build/merge-patch
//
// The patch is its own class: every field optional, so a missing key is no
// error, and every field recorded in `presence`, so the apply step knows
// which keys the patch gave. RFC 7396's rules then read off the fields:
//
//   - a key left out leaves the target's member as it was;
//   - a key given a value replaces the member, and an array is replaced
//     whole, never merged;
//   - a key given `null` removes the member, which a typed record says as
//     `null` on a `| null` field; on a field that is not `| null` the
//     decoding refuses the patch (`JSON_DECODE_TYPE`) before anything is
//     applied, and `tags`, an array, is removed by being emptied;
//   - an object given for an object member is merged into it, by the same
//     rules, one level down.
//
// A patch that is not an object (`[1]`, `"x"`) replaces the whole target in
// RFC 7396; here it fails the decode with `JSON_DECODE_TYPE`, and nothing is
// applied. Each patch decodes into a patch object of its own: a decode
// refills arrays and maps in place, so a reused one shares them with the
// target.
//
// It prints the record before and after each patch and exits 0 when every
// result is the one RFC 7396 gives.
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_DECODE_OK, JSON_DECODE_TYPE, JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"

class Address {
  street: string = ""
  city: string = ""
}

class Profile {
  name: string = ""
  email: string | null = null
  address: Address | null = null
  tags: string[]
  age: i32 = 0

  constructor() {
    this.tags = []
  }
}

/** `Address` as a patch: every key may be left out, and each that is given is recorded. */
class AddressPatch {
  static readonly json = {
    optional: ["street", "city"],
    presence: { street: "hasStreet", city: "hasCity" },
  }
  street: string = ""
  city: string = ""
  hasStreet: boolean = false
  hasCity: boolean = false
}

/**
 * `Profile` as a patch. `name` and `age` are not `| null`, so a patch cannot
 * remove them. `tags` is `| null` here because an array field's initializer
 * cannot be a literal, so `"tags": null` decodes and empties the list.
 */
class ProfilePatch {
  static readonly json = {
    optional: ["name", "email", "address", "tags", "age"],
    presence: { name: "hasName", email: "hasEmail", address: "hasAddress", tags: "hasTags", age: "hasAge" },
  }
  name: string = ""
  email: string | null = null
  address: AddressPatch | null = null
  tags: string[] | null = null
  age: i32 = 0
  hasName: boolean = false
  hasEmail: boolean = false
  hasAddress: boolean = false
  hasTags: boolean = false
  hasAge: boolean = false
}

const applyAddress = (target: Address, patch: AddressPatch): void => {
  if (patch.hasStreet) {
    target.street = patch.street
  }
  if (patch.hasCity) {
    target.city = patch.city
  }
}

const applyProfile = (target: Profile, patch: ProfilePatch): void => {
  if (patch.hasName) {
    target.name = patch.name
  }
  if (patch.hasEmail) {
    target.email = patch.email
  }
  if (patch.hasAddress) {
    const given = patch.address
    if (given === null) {
      target.address = null
    } else {
      // RFC 7396 merges into a member that is an object, and into an empty
      // one when the target had none.
      const into = target.address
      const address = into !== null ? into : new Address()
      applyAddress(address, given)
      target.address = address
    }
  }
  if (patch.hasTags) {
    const tags = patch.tags
    target.tags = tags !== null ? tags : []
  }
  if (patch.hasAge) {
    target.age = patch.age
  }
}

const bytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    out[i] = toU8(s.charCodeAt(i))
  }
  return out
}

/** Decodes `text` as a patch and applies it to `target`: the decoding's code, and nothing applied unless it is `JSON_DECODE_OK`. */
const mergePatch = (target: Profile, text: string): i32 => {
  const src = bytes(text)
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits())
  const patch = new ProfilePatch()
  jsonDecode(d, patch)
  if (d.failed === JSON_DECODE_OK) {
    applyProfile(target, patch)
  }
  return d.failed
}

/** A patch and the decoding code RFC 7396's rules give it against `Profile`. */
class Step {
  patch: string
  want: i32

  constructor(patch: string, want: i32) {
    this.patch = patch
    this.want = want
  }
}

const show = (p: Profile): string => {
  const w = new JsonWriter(new Array<u8>(512), 0)
  jsonEncode(w, p)
  return w.text()
}

export const main = (): i32 => {
  const p = new Profile()
  p.name = "Ada"
  p.email = "ada@example.com"
  p.tags = ["math", "engines"]
  p.age = 36
  console.log(`start  ${show(p)}`)

  const steps: Step[] = [
    new Step(`{"age":37}`, JSON_DECODE_OK),
    new Step(`{"email":null,"tags":["poetry"]}`, JSON_DECODE_OK),
    new Step(`{"address":{"city":"London"}}`, JSON_DECODE_OK),
    new Step(`{"address":{"street":"St James's Square"}}`, JSON_DECODE_OK),
    new Step(`{"address":null}`, JSON_DECODE_OK),
    new Step(`{"name":null}`, JSON_DECODE_TYPE),
  ]
  let wrong: i32 = 0
  for (const step of steps) {
    const code = mergePatch(p, step.patch)
    if (code !== step.want) {
      wrong += 1
    }
    console.log(`patch  ${step.patch}  ->  ${code === JSON_DECODE_OK ? show(p) : `refused (${code})`}`)
  }
  const end = `{"name":"Ada","email":null,"address":null,"tags":["poetry"],"age":37}`
  if (show(p) !== end) {
    wrong += 1
  }
  return wrong
}
