// The page half of tests/page: `HostTable`, the ring both ways over module
// storage, and the default reporter. Run by tests/run.js's `page` section,
// which passes the loader and the bytes and copies runtime/page.mjs and
// page.d.ts in beside it as nish-page.mjs (the `nish/page` export); tsc checks
// it against main.d.ts and that declaration.
import type * as Loader from "./main"
import { HostTable, reportPanic, ringOver } from "./nish-page.mjs"

const threw = (call: () => unknown): string => {
  try {
    return `ok ${String(call())}`
  } catch (e) {
    return (e as Error).name
  }
}

export const run = (l: typeof Loader, bytes: BufferSource): string[] => {
  const out: string[] = []

  const table = new HostTable<{ name: string }>()
  const a = table.add({ name: "a" })
  const b = table.add({ name: "b" })
  out.push(`handles ${a} ${b} size ${table.size}`)
  out.push(`get ${table.get(b).name}`)
  out.push(`take ${table.take(a).name} size ${table.size}`)
  out.push(`taken ${threw(() => table.get(a))}`)
  out.push(`zero ${threw(() => table.get(0))} forged ${threw(() => table.get(99))} fraction ${threw(() => table.get(1.5))}`)
  const c = table.add({ name: "c" })
  out.push(`reused ${c} ${table.get(c).name}`)

  const m = l.loadSync(bytes)
  const input = ringOver(m.memory, m.layout.INPUT)
  const output = ringOver(m.memory, m.layout.OUTPUT)
  out.push(`capacity ${input.capacity} ${output.capacity}`)
  out.push(`push ${input.push(1)} ${input.push(2)} ${input.push(-3)} waiting ${m.waiting()}`)
  out.push(`tick ${m.tick()} input ${input.size()} output ${output.size()}`)
  out.push(`drain ${output.shift()} ${output.shift()} ${output.shift()} empty ${output.shift()} ${output.size()}`)
  out.push(`fill ${m.fill(10)} free ${output.free()}`)
  out.push(`page push to a full ring ${output.push(9)}`)
  const words: number[] = []
  while (output.size() > 0) words.push(output.shift())
  out.push(`drain ${words.join(" ")}`)
  for (let i = 0; i < 6; i++) input.push(i)
  out.push(`full from the page ${input.size()} free ${input.free()}`)
  input.clear()
  out.push(`clear ${input.size()} ${m.waiting()}`)

  const logged: string[] = []
  const error = console.error
  console.error = (line: string) => logged.push(line)
  reportPanic({ message: "index out of range: 9 >= 4" })
  console.error = error
  out.push(`report ${logged.join("|")}`)
  return out
}
