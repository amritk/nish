// Module storage in the TypeScript reading (WP50 §5.4).
//
// The wasm build lays every module storage out in linear memory and the page
// reads it through `memory.buffer` and `layout` (§5.2). A page must run the
// same against the TypeScript reading, so `--emit-ts` writes one more file,
// `nish-storage.ts`: one `ArrayBuffer` laid out as `layout` says, `memory`
// holding it as `buffer`, `layout` itself, and each storage as a view of it.
// A module's storage `new` is written as that view, `s<slot>` (`newRow` in
// `src/emit-ts-records.ts`), so every read and write the module makes lands in
// the buffer the page sees.
//
// - A scalar storage is the typed array its element reads as
//   (`new Int32Array(heap, at, length)`); a `boolean` one is that byte array
//   behind a proxy that reads `!== 0` and writes `1` or `0`, and whose
//   iterator yields the flags, so `for (const f of flags)` reads booleans.
// - A record storage is an array of plain objects, one per element, whose
//   fields are accessors over the heap's views at
//   `(at + i * stride + offset) >> shift`. Every access is `name[i].field`
//   (§5.1 refuses an element reference), so each one reads or writes the
//   buffer, and a whole-element copy (`storeIdx`) is `Object.assign`, which
//   runs each getter of the source and each setter of the target: field by
//   field, as the native copy is.
//
// The offsets are the reading's own: each storage starts on an 8-byte
// boundary from 0. A page reads them from `layout`, as it reads the wasm
// build's, and never spells one.

import { StorageLayout, heapViewsNew } from "./interop-wasm"

/** The file the storage of a whole program is written to, beside its modules. */
export const STORAGE_FILE: string = "nish-storage.ts"

/** The name a module imports `STORAGE_FILE` as. */
export const STORAGE_NAMESPACE: string = "__nishStorage"

/** log2 of a view's element size: the shift from a byte address to its index. */
const viewShift = (view: string): i32 => {
  if (view === "Uint8Array" || view === "Int8Array") {
    return 0
  }
  if (view === "Uint16Array" || view === "Int16Array") {
    return 1
  }
  if (view === "Float64Array" || view === "BigInt64Array" || view === "BigUint64Array") {
    return 3
  }
  return 2
}

/** `n` rounded up to a multiple of 8. */
const align8 = (n: i32): i32 => n + ((8 - (n % 8)) % 8)

/** `n` rounded up to a multiple of 8, in `i64`. */
const align8Wide = (n: i64): i64 => n + ((toI64(8) - (n % toI64(8))) % toI64(8))

/**
 * The size of the reading's heap: every storage of `layouts`, each from an
 * 8-byte boundary. Summed in `i64`, since nine storages at the cap pass 2^31.
 */
const storageEnd = (layouts: StorageLayout[]): i64 => {
  let at = toI64(0)
  for (const s of layouts) {
    at = align8Wide(at) + toI64(s.length) * toI64(s.stride)
  }
  return align8Wide(at)
}

/** The heap-wide view a record field reads through, named for its type; `storageFileText` spells it inline. */
const heapView = (view: string): string => `heap${view}`

/** One field of a record element as a getter and a setter over its heap view. */
const fieldAccessors = (name: string, view: string, offset: i32, flag: boolean): string => {
  const shift = viewShift(view)
  const slot = shift === 0 ? `at + ${offset}` : `(at + ${offset}) >> ${shift}`
  const array = heapView(view)
  if (flag) {
    return `get ${name}() { return ${array}[${slot}] !== 0 }, set ${name}(v) { ${array}[${slot}] = v ? 1 : 0 }`
  }
  return `get ${name}() { return ${array}[${slot}] }, set ${name}(v) { ${array}[${slot}] = v }`
}

/** `STORAGE_FILE`'s text for `layouts`, which is not empty. */
export const storageFileText = (layouts: StorageLayout[]): string => {
  const lines: string[] = []
  lines.push("// Module storage for the TypeScript reading (WP50 §5.4), written by `nish --emit-ts`:")
  lines.push("// one buffer laid out as `layout` says, each storage a view of it, so a page")
  lines.push("// reads `memory.buffer` and `layout` here as it reads them from the wasm build.")
  lines.push(`const heap = new ArrayBuffer(${storageEnd(layouts)})`)
  const views: string[] = []
  for (const s of layouts) {
    for (const f of s.fields) {
      if (views.indexOf(f.type) < 0) {
        views.push(f.type)
      }
    }
  }
  for (const view of views) {
    lines.push(`const heap${view} = new ${view}(heap)`)
  }
  let anyFlag = false
  for (const s of layouts) {
    if (s.flag) {
      anyFlag = true
    }
  }
  if (anyFlag) {
    lines.push("// A `boolean` storage: its bytes, read as `!== 0` and written as `1` or `0`.")
    lines.push(
      'const isSlot = (k: string | symbol): k is string => typeof k === "string" && /^[0-9]+$/.test(k)'
    )
    lines.push("const flags = (bytes: Uint8Array): boolean[] =>")
    lines.push("  new Proxy(bytes, {")
    lines.push("    get: (t, k) => {")
    lines.push("      if (isSlot(k)) return t[Number(k)] !== 0")
    lines.push("      // `for of` reads the flags, not the bytes; any other method runs on the bytes.")
    lines.push("      if (k === Symbol.iterator) return function* () { for (const b of t) yield b !== 0 }")
    lines.push("      const v = (t as unknown as Record<string | symbol, unknown>)[k]")
    lines.push('      return typeof v === "function" ? v.bind(t) : v')
    lines.push("    },")
    lines.push("    set: (t, k, v) => {")
    lines.push("      if (isSlot(k)) t[Number(k)] = v ? 1 : 0")
    lines.push("      return true")
    lines.push("    },")
    lines.push("  }) as unknown as boolean[]")
  }
  lines.push("/** The reading's memory: `heap`, which never moves, so `grow` is refused. */")
  lines.push("export const memory = {")
  lines.push("  buffer: heap,")
  lines.push("  grow: (_pages: number): number => {")
  lines.push('    throw new RangeError("the TypeScript reading\'s memory is fixed: it cannot grow")')
  lines.push("  },")
  lines.push("}")
  lines.push("export const layout = {")
  // Each storage starts on an 8-byte boundary, as `storageEnd` counts them.
  let at = 0
  for (const s of layouts) {
    at = align8(at)
    const fields: string[] = []
    for (const f of s.fields) {
      fields.push(`${f.name}: ${f.offset}`)
    }
    const tail = s.fields.length > 0 ? `, fields: { ${fields.join(", ")} }` : ""
    lines.push(`  ${s.key}: { at: ${at}, length: ${s.length}, stride: ${s.stride}${tail} },`)
    at = at + s.length * s.stride
  }
  lines.push("}")
  at = 0
  let k = 0
  for (const s of layouts) {
    at = align8(at)
    if (s.fields.length === 0) {
      const view = `new ${s.view}(heap, ${at}, ${s.length})`
      // `any`: the module spells the storage's own type, which this file does not know.
      lines.push(`export const s${k}: any = ${s.flag ? `flags(${view})` : view}`)
    } else {
      const accessors: string[] = []
      for (const f of s.fields) {
        accessors.push(fieldAccessors(f.name, f.type, f.offset, f.flag))
      }
      lines.push(`export const s${k}: any = Array.from({ length: ${s.length} }, (_, i) => {`)
      lines.push(`  const at = ${at} + i * ${s.stride}`)
      lines.push(`  return { ${accessors.join(", ")} }`)
      lines.push("})")
    }
    at = at + s.length * s.stride
    k = k + 1
  }
  for (const line of readingLoader(layouts)) {
    lines.push(line)
  }
  lines.push("")
  return lines.join("\n")
}

/**
 * `views()`, `loadSync` and `load` as the wasm loader offers them (§5.2), so a
 * page runs the same against either reading. `heap` never moves, so `views()`
 * answers one object for good. The loaders take the module's exports, the
 * reading's instance, where the wasm build's take its bytes.
 */
const readingLoader = (layouts: StorageLayout[]): string[] => {
  const lines: string[] = []
  lines.push("const buffer = heap")
  lines.push("const viewsOnce = {")
  lines.push("  buffer,")
  for (const entry of heapViewsNew()) {
    lines.push(`  ${entry},`)
  }
  lines.push("  storage: {")
  for (const s of layouts) {
    if (s.fields.length === 0) {
      lines.push(`    ${s.key}: new ${s.view}(buffer, layout.${s.key}.at, ${s.length}),`)
    }
  }
  lines.push("  },")
  lines.push("}")
  lines.push(
    "/** Typed arrays over `memory.buffer`, the wasm loader's `views()`: one object, as the heap never moves. */"
  )
  lines.push("export const views = () => viewsOnce")
  lines.push(
    "/** The wasm loader's `loadSync` for this reading: `exports` (the module's namespace) with `memory`, `layout` and `views`. */"
  )
  lines.push(
    "export const loadSync = <T extends object>(exports: T) => ({ ...exports, memory, layout, views })"
  )
  lines.push("/** `loadSync` behind a promise, as the wasm loader's `load`. */")
  lines.push("export const load = async <T extends object>(exports: T) => loadSync(exports)")
  return lines
}
