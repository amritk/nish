// The verdict tests/run.js holds `fuzz.ts`'s listing to, natively and under
// Node: each case's strict, lenient and pair lines against `decodeURIComponent`,
// `URLSearchParams` and a regex of the strict rule. It lives beside the program
// it reads so that tests/run.js stays under Biome's file-size limit.

/** What is wrong with a fuzz.ts listing, held to Node's decoders: the case count and the first failures. */
export const urlFuzzVerdict = (text) => {
  const bad = []
  let cases = 0
  let pending = null
  // URLSearchParams decodes as the WHATWG decoder does (BOM kept), replacement characters and all.
  const utf8 = (h) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(Buffer.from(h, "hex"))
  const isUtf8 = (h) => {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(h, "hex"))
      return true
    } catch {
      return false
    }
  }
  const finish = () => {
    if (pending === null) {
      return
    }
    const c = pending
    const s = Buffer.from(c.input, "hex").toString("latin1")
    const where = `${c.input} (${JSON.stringify(s)})`
    // Node's decoders read a string, and a raw byte past 0x7F would reach them as
    // a Latin-1 character they re-encode as UTF-8; escaped, it is the byte itself.
    const escaped = s.replace(/[\x80-\xff]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
    // The strict rule: a `%` without two hex digits after it, or `%00`, whichever comes first.
    const first = /%(?![0-9A-Fa-f]{2})|%00/.exec(s)
    let strictWant = null
    if (first !== null) {
      strictWant = first[0] === "%00" ? -2 : -1
    }
    const decoded = (form) =>
      Buffer.from(
        s.replace(/%([0-9A-Fa-f]{2})|\+/g, (m, h) => {
          if (h !== undefined) {
            return String.fromCharCode(Number.parseInt(h, 16))
          }
          return form ? " " : m
        }),
        "latin1"
      ).toString("hex")
    if (strictWant !== null) {
      if (c.strict !== strictWant) {
        bad.push(`${where}: strict answered ${c.strict}, the rule ${strictWant}`)
      }
    } else {
      const want = decoded(false)
      if (c.strict !== want.length / 2 || c.strictHex !== want) {
        bad.push(`${where}: strict wrote ${c.strictHex}, want ${want}`)
      }
      let dec = null
      try {
        dec = decodeURIComponent(escaped)
      } catch {
        dec = null
      }
      if (dec !== null && Buffer.from(dec, "utf8").toString("hex") !== c.strictHex) {
        bad.push(`${where}: strict wrote ${c.strictHex}, decodeURIComponent ${JSON.stringify(dec)}`)
      }
      if ((dec === null) === isUtf8(c.strictHex)) {
        bad.push(
          `${where}: decodeURIComponent ${dec === null ? "threw" : "decoded"} where strict wrote ${c.strictHex}`
        )
      }
    }
    if (c.loose !== decoded(true)) {
      bad.push(`${where}: lenient wrote ${c.loose}, want ${decoded(true)}`)
    }
    const got = c.pairs.map(([k, v]) => [utf8(k), v === "!" ? "" : utf8(v)])
    const want = [...new URLSearchParams(escaped)]
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      bad.push(`${where}: pairs ${JSON.stringify(got)}, URLSearchParams ${JSON.stringify(want)}`)
    }
    // urlDecode: the strict bytes where they are UTF-8, as decodeURIComponent reads them.
    let decWant = "null"
    try {
      decWant = Buffer.from(decodeURIComponent(escaped), "utf8").toString("hex")
    } catch {
      decWant = "null"
    }
    if (strictWant !== null) {
      decWant = "null"
    }
    if (c.decode !== decWant) {
      bad.push(`${where}: urlDecode gave ${c.decode}, decodeURIComponent ${decWant}`)
    }
    // urlQueryGet on the value `v=` + the input up to its first `&`: strict form
    // decoding, null where it is malformed or not UTF-8, else URLSearchParams.get.
    const value = s.split("&")[0]
    let getWant = "null"
    if (!/%(?![0-9A-Fa-f]{2})|%00/.test(value)) {
      const bytes = Buffer.from(
        value.replace(/%([0-9A-Fa-f]{2})|\+/g, (_m, h) =>
          h === undefined ? " " : String.fromCharCode(Number.parseInt(h, 16))
        ),
        "latin1"
      ).toString("hex")
      if (isUtf8(bytes)) {
        const param = new URLSearchParams(`v=${escaped}`).get("v")
        getWant = Buffer.from(param ?? "", "utf8").toString("hex")
        if (param === null || getWant !== bytes) {
          bad.push(`${where}: URLSearchParams.get ${JSON.stringify(param)}, the strict form bytes ${bytes}`)
        }
      }
    }
    if (c.get !== getWant) {
      bad.push(`${where}: urlQueryGet gave ${c.get}, want ${getWant}`)
    }
    if (c.end !== 0) {
      bad.push(`${where}: the iterator ended with ${c.end}`)
    }
    cases += 1
    pending = null
  }
  for (const line of text.split("\n")) {
    const f = line.split(" ")
    if (f[0] === "I") {
      finish()
      pending = {
        input: f[1],
        strict: 0,
        strictHex: "",
        loose: "",
        pairs: [],
        end: null,
        decode: null,
        get: null,
      }
    } else if (pending === null) {
      // A line before the first input belongs to no case.
    } else if (f[0] === "S") {
      pending.strict = Number(f[1])
      pending.strictHex = f[2] === "-" ? "" : f[2]
    } else if (f[0] === "L") {
      pending.loose = f[1]
    } else if (f[0] === "P") {
      pending.pairs.push([f[1], f[2]])
    } else if (f[0] === "E") {
      pending.end = Number(f[1])
    } else if (f[0] === "D") {
      pending.decode = f[1]
    } else if (f[0] === "G") {
      pending.get = f[1]
    }
  }
  finish()
  return { cases, bad }
}
