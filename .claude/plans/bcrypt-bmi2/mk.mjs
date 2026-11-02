// Build bcryptHashN programs at widths 1..6, default and --cpu x86-64-v3.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
const D = process.argv[2], hashes = Number(process.argv[3] || 8), cost = 10
const src = (width) => `import { bcryptHashN } from "nish/crypto/bcrypt"
import { Secret, secret, wipe } from "nish:secret"

const given = (k: i32): Secret<u8[]> | null => {
  if (k >= ${width}) {
    return null
  }
  const raw: u8[] = [85, 42, 85]
  return secret(raw)
}

export const main = (): i32 => {
  const r0: u8[] = [85, 42, 85]
  const p0: Secret<u8[]> = secret(r0)
  const p1: Secret<u8[]> | null = given(1)
  const p2: Secret<u8[]> | null = given(2)
  const p3: Secret<u8[]> | null = given(3)
  const p4: Secret<u8[]> | null = given(4)
  const p5: Secret<u8[]> | null = given(5)
  const salts: u8[] = new Array<u8>(96)
  let last: string[] = []
  for (let i: i32 = 0; i < ${hashes}; i++) {
    const h: Result<string[], string> = bcryptHashN(p0, p1, p2, p3, p4, p5, salts, ${cost})
    if (h.isOk()) {
      last = h.value
    }
  }
  wipe(p0)
  if (p1 !== null) {
    wipe(p1)
  }
  if (p2 !== null) {
    wipe(p2)
  }
  if (p3 !== null) {
    wipe(p3)
  }
  if (p4 !== null) {
    wipe(p4)
  }
  if (p5 !== null) {
    wipe(p5)
  }
  for (const hash of last) {
    if (hash !== "") {
      console.log(hash)
    }
  }
  return 0
}
`
for (let w = 1; w <= 6; w++) {
  fs.writeFileSync(`${D}/w${w}.ts`, src(w))
  for (const [tag, extra] of [["base", []], ["v3", ["--cpu", "x86-64-v3"]]]) {
    const r = spawnSync("/home/user/nish/build/nish", [`${D}/w${w}.ts`, "-o", `${D}/w${w}-${tag}-out/`, "--link", `${D}/w${w}-${tag}`, ...extra], { cwd: "/home/user/nish", encoding: "utf8" })
    if (r.status !== 0) { console.error(r.stderr); process.exit(1) }
  }
}
