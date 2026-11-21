// WP48: a compact class through `nish/json-typed` and through a copy. The
// decoder stores `captain` and `next` with the field store, so they land as
// offsets; the encoder reads them back with the field load.
import { Compact } from "nish:compact"
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"

class Player implements Compact {
  name: string = ""
  score: i32 = 0
  next: Player | null = null
}

class Team implements Compact {
  players: Player[]
  captain: Player | null = null

  constructor() {
    this.players = []
  }
}

const bytesOf = (text: string): u8[] => {
  const out = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(text.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** A new team holding the same players, linked the same way: a copy of a compact-holding object. */
const copyOf = (team: Team): Team => {
  const out = new Team()
  for (const p of team.players) {
    out.players.push(p)
  }
  out.captain = team.captain
  return out
}

export const main = (): i32 => {
  const body = bytesOf(
    `{"players":[{"name":"Ann","score":3,"next":{"name":"Bo","score":4,"next":null}}],"captain":{"name":"Cy","score":5,"next":null}}`
  )
  const d = new JsonDecoder(body, 0, toI32(body.length), new JsonLimits())
  const team = new Team()
  const code = jsonDecode(d, team)
  if (code !== 0) {
    console.log(`error ${code} at byte ${d.errorAt}`)
    return 1
  }
  const w = new JsonWriter(new Array<u8>(512), 0)
  jsonEncode(w, team)
  console.log(w.text())
  const copy = copyOf(team)
  const captain = copy.captain
  const first = copy.players[0]
  const second = first.next
  console.log(`${captain === null ? -1 : captain.score} ${second === null ? -1 : second.score}`)
  const w2 = new JsonWriter(new Array<u8>(512), 0)
  jsonEncode(w2, copy)
  console.log(w2.text())
  return 0
};
