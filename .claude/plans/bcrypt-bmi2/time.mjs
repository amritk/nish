// Interleaved rounds: user CPU of each program, per hash. argv: rounds, then name=exe:per pairs
import { spawnSync } from "node:child_process"
const rounds = Number(process.argv[2])
const progs = process.argv.slice(3).map((a) => { const [name, rest] = a.split("="); const [exe, per, mode] = rest.split(":"); return { name, exe, per: Number(per), mode, t: [] } })
const user = (exe) => {
  const r = spawnSync("bash", ["-c", `TIMEFORMAT=%3U; time ${exe} > /dev/null`], { encoding: "utf8" })
  return Number(r.stderr.trim().split("\n").pop())
}
for (let round = 0; round <= rounds; round++) {
  for (const p of progs) { const u = user(p.exe); if (round > 0) p.t.push(u * 1000 / p.per) }
}
for (const p of progs) {
  const s = [...p.t].sort((a, b) => a - b)
  console.log(`${p.name.padEnd(22)} ${s[s.length >> 1].toFixed(2)} ms/hash (${s[0].toFixed(2)}–${s[s.length - 1].toFixed(2)})`)
}
