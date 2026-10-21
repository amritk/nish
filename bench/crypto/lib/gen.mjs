// The crypto twins' shared input generator and checksum fold, for Node: the
// same bytes and the same fold as lib/gen.ts, under the contract in
// bench/crypto/README.md. A family's node.mjs imports it as "../lib/gen.mjs".

/** FNV-1a 32 over `bytes`, from `sum`. */
export const fold = (sum, bytes) => {
  let h = sum
  for (let i = 0; i < bytes.length; i++) {
    h = Math.imul(h ^ bytes[i], 16777619) >>> 0
  }
  return h
}

/** FNV-1a 32's offset basis: the fold's start. */
export const FOLD_START = 2166136261

/** The key, nonce, AAD and message of `kernel` at `size`, drawn from one xorshift32 stream in that order. */
export const inputs = (kernel, size, keyLen, nonceLen, aadLen, msgLen) => {
  let x = fold(FOLD_START, Buffer.from(`${kernel}:${size}`, "latin1"))
  if (x === 0) {
    x = 1
  }
  const draw = (length) => {
    const out = Buffer.alloc(length)
    for (let i = 0; i < length; i++) {
      x = (x ^ (x << 13)) >>> 0
      x = (x ^ (x >>> 17)) >>> 0
      x = (x ^ (x << 5)) >>> 0
      out[i] = x & 255
    }
    return out
  }
  const key = draw(keyLen)
  const nonce = draw(nonceLen)
  const aad = draw(aadLen)
  return { key, nonce, aad, msg: draw(msgLen) }
}

/** Iteration `i`'s input: `bytes[at..at + 4)` set to `base` (the original four bytes) XOR `i`, little-endian. */
export const tweak = (bytes, at, base, i) => {
  bytes[at] = base[0] ^ (i & 255)
  bytes[at + 1] = base[1] ^ ((i >>> 8) & 255)
  bytes[at + 2] = base[2] ^ ((i >>> 16) & 255)
  bytes[at + 3] = base[3] ^ ((i >>> 24) & 255)
}

/** The command line: `{ kernel, size, iterations }`, or exit 2 with a usage line. */
export const parseArgs = (program) => {
  const [kernel, size, iterations] = process.argv.slice(2)
  const a = { kernel, size: Number(size), iterations: Number(iterations) }
  if (process.argv.length !== 5 || !(a.size >= 0) || !(a.iterations >= 1)) {
    console.error(`usage: ${program} <kernel> <size> <iterations>`)
    process.exit(2)
  }
  return a
}

/** The monotonic clock the timed loop reads, in nanoseconds. */
export const now = () => process.hrtime.bigint()

/** The contract's two lines: the checksum on stdout, the timed loop's nanoseconds on stderr. */
export const report = (sum, started) => {
  const ns = now() - started
  process.stdout.write(`checksum ${sum.toString(16).padStart(8, "0")}\n`)
  process.stderr.write(`ns ${ns}\n`)
}
