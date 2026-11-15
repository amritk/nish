// The API-style side of the typed-encode benchmarks: one page of a user
// listing, as a JSON API answers it, written with `jsonEncode` into one
// reused buffer. citm_catalog (bench/json-compare) is mostly integers and
// short keys; this is mostly strings, with a nested object, an array of
// records, numbers, booleans and nulls.
//
//   main <count>         encode the page `count` times and print a checksum
//                        of every byte written, then the time the clock saw
//   main 0 print         print the page once, the golden `expected.json`
//
// Before each write one user's `id` moves on by one, so no two writes are the
// same. Every output byte is folded in outside the clock.
import { JsonWriter } from "nish/json"
import { jsonEncode } from "nish/json-typed"

class Address {
  street: string = ""
  city: string = ""
  postalCode: string = ""
  country: string = ""
}

class User {
  id: i64 = 0
  login: string = ""
  name: string = ""
  email: string = ""
  score: f64 = 0
  createdAt: string = ""
  avatarUrl: string | null = null
  address: Address
  roles: string[]
  followers: i32 = 0
  admin: boolean = false
  verified: boolean = false

  constructor() {
    this.address = new Address()
    this.roles = []
  }
}

class Page {
  status: string = "ok"
  page: i32 = 0
  perPage: i32 = 0
  total: i64 = 0
  next: string | null = null
  users: User[]

  constructor() {
    this.users = []
  }
}

/** Page 3 of a listing of 20 users a page. */
const makePage = (): Page => {
  const cities: string[] = ["Lisbon", "Osaka", "Toronto", "Nairobi", "Oslo"]
  const roles: string[] = ["reader", "writer", "reviewer", "owner"]
  const p = new Page()
  p.page = 3
  p.perPage = 20
  p.total = 1287
  p.next = "https://api.example.com/v1/users?page=4&per_page=20"
  for (let i: i32 = 0; i < 20; i += 1) {
    const u = new User()
    const n: i32 = 40 + i
    u.id = toI64(1000000 + n * 7919)
    u.login = `user${n}`
    u.name = `User Number ${n}`
    u.email = `user${n}@example.com`
    u.admin = i % 7 === 0
    u.verified = i % 3 !== 0
    u.score = toF64(n) * 1.5 + 0.25
    u.followers = n * n
    u.createdAt = `2024-0${1 + (i % 9)}-1${i % 10}T08:3${i % 6}:00Z`
    u.avatarUrl = i % 4 === 0 ? null : `https://cdn.example.com/avatars/${n}.png`
    u.address.street = `${n} Market Street`
    u.address.city = cities[i % 5]
    u.address.postalCode = `${10000 + n * 13}`
    u.address.country = "PT"
    u.roles.push(roles[i % 4])
    if (i % 2 === 0) {
      u.roles.push(roles[(i + 1) % 4])
    }
    p.users.push(u)
  }
  return p
}

/** `h * 31 + v`, wrapping. */
const fold = (h: u64, v: u64): u64 => h * toU64(31) + v

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error("usage: main <count> [print]")
    return 2
  }
  const count: i32 = toI32(parseInt(process.argv[1]))
  const page = makePage()
  const out = new Array<u8>(65536)
  const w = new JsonWriter(out, 0)
  if (process.argv.length > 2 && process.argv[2] === "print") {
    jsonEncode(w, page)
    if (!w.complete()) {
      panic(`print: the writer failed with code ${w.failed}`)
    }
    console.log(w.text())
    return 0
  }
  let h: u64 = 0
  let elapsed: i64 = 0
  for (let r: i32 = 0; r < count; r += 1) {
    const u: User = page.users[r % 20]
    u.id = u.id + toI64(1)
    const t0: i64 = monotonicNanos()
    w.reset(out, 0)
    jsonEncode(w, page)
    elapsed += monotonicNanos() - t0
    if (!w.complete()) {
      panic(`api: the writer failed with code ${w.failed}`)
    }
    const n: i32 = w.written()
    for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
      h = fold(h, toU64(out[i]))
    }
  }
  console.log(`checksum ${h} bytes ${w.written()} ns ${elapsed}`)
  return 0
}
