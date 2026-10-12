// Typed JSON from `nish/json-typed`: a request body decoded into a class and
// the reply encoded from one, with code the compiler writes from the fields.
// Each call becomes a call of a function of this module's own, one per class
// and direction (`.json.decode.Greeting`, `.json.encode.Greeting`), whose body
// is a call of the decoder's or the writer's method per field, after a switch
// on the key's length and, for `name`, `mood` and `kind`, on its first byte.
// The class's options give `times` the key `visits`, and make it optional, so
// a missing `visits` stores `0`; `amount` is a `JsonNumber`, read and written
// whole as its text.
import { JsonWriter } from "nish/json"
import { JsonDecoder, JsonNumber, jsonDecode, jsonEncode } from "nish/json-typed"

enum Mood {
  Calm = 1,
  Glad = 2,
}

class Greeting {
  static readonly json = { rename: { times: "visits" }, optional: ["times"] }
  id: u64 = 0
  name: string = ""
  amount: JsonNumber
  times: i32 = 0
  kind: i32 = 0
  mood: Mood

  constructor() {
    this.amount = new JsonNumber()
    this.mood = Mood.Calm
  }
}

export const greet = (d: JsonDecoder, w: JsonWriter): i32 => {
  const g = new Greeting()
  const code = jsonDecode(d, g)
  if (code === 0) {
    jsonEncode(w, g)
  }
  return code
}
