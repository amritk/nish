// Typed JSON from `nish/json-typed`: a request body decoded into a class and
// the reply encoded from one, with code the compiler writes from the fields.
// Each call becomes a call of a function of this module's own, one per class
// and direction (`.json.decode.Greeting`, `.json.encode.Greeting`), whose body
// is a call of the decoder's or the writer's method per field.
import { JsonWriter } from "nish/json"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"

class Greeting {
  name: string = ""
  times: i32 = 0
}

export const greet = (d: JsonDecoder, w: JsonWriter): i32 => {
  const g = new Greeting()
  const code = jsonDecode(d, g)
  if (code === 0) {
    jsonEncode(w, g)
  }
  return code
}
