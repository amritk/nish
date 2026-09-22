// A worker that runs a bytes-in Nish module over batches of documents.
//
// This is the other half of `web/worker.mjs`. That one compiles Nish and needs
// a fresh instance per request, because the compiler ends its run with
// `proc_exit` and the arena only grows. A bytes-in module returns like an
// ordinary function, so this worker keeps **one** instance for its lifetime and
// gives the arena back with `nish_arena_mark` / `nish_arena_release` around
// each batch. Instantiation stops being per-request work.
//
// Protocol — one request, one reply, matched by `id`:
//
//   in   { id, wasm }                              load the module, reply { ready }
//   in   { id, docs: [Uint8Array, ...], mode? }    mode: "validate" (default) | "guard"
//   out  { id, results: Int32Array }               one entry per document
//
// `mode: "echo"` accepts the documents and answers their lengths without
// touching the module. It exists so that a benchmark can price the worker
// boundary on its own — a 25 MB payload spends far longer being scanned than
// being handed over, and the two costs have to be separable to be read.
//
// **Batches, not documents.** `bench/worker.mjs` measures an empty round trip
// here at about 61 us, against about 0.8 us to copy one 164-byte document into
// linear memory and scan it. A worker that answers one document per message
// therefore spends about 99% of its time in `postMessage`, which is why `docs`
// is a list: the 61 us is paid once and amortises over the batch, and a batch
// of 1,000 came out at 648 ns per document against 512 ns inline. Below the
// break-even — roughly 74 of these documents, or about 12 KB in one — the right
// answer is not a bigger batch but no worker at all, so `scanBatch` is exported
// for the main thread to call directly. Above it, the remaining argument for a
// worker is keeping the main thread free rather than throughput.
//
// Every `ArrayBuffer` that crosses is transferred rather than cloned (the
// caller passes the transfer list; `results` is transferred back from here).
// Handing over 25 MB measured 4.8 ms transferred against 29 ms cloned.

/** The compiled module, set by the first `{ wasm }` message and kept. */
let compiled = null;

/** The single instance every batch runs on, and the exports we reach for. */
let instance = null;

/** `WebAssembly.compile` the module once; every later batch reuses it. */
const load = async (source) => {
  if (source instanceof WebAssembly.Module) return source;
  if (typeof source === "string") return WebAssembly.compileStreaming(fetch(source));
  return WebAssembly.compile(source);
};

// Views over linear memory, rebuilt only when `memory.grow` replaces the
// backing `ArrayBuffer`. Taking a fresh `DataView` and `Uint8Array` per
// document cost about 170 ns of the 947 ns a document used to take here, which
// is the same lesson the copy-out path teaches: at this size the allocator, not
// the copy, is the boundary. The identity check is the whole invalidation
// strategy — a grown memory is a different `ArrayBuffer` object.
let cachedBuffer = null;
let cachedBytes = null;
let cachedFields = null;

const views = (exports) => {
  const buffer = exports.memory.buffer;
  if (buffer !== cachedBuffer) {
    cachedBuffer = buffer;
    cachedBytes = new Uint8Array(buffer);
    cachedFields = new DataView(buffer);
  }
  return { bytes: cachedBytes, fields: cachedFields };
};

/**
 * Scan a batch of documents on one instance, answering one `i32` per document.
 *
 * Exported so that a caller who should not be using a worker at all — which is
 * most callers, see the header — can run the same code inline.
 *
 * The batch gets **one** arena allocation, not one per document: a buffer as
 * wide as the longest document, and one array header whose `len` field is
 * rewritten in place for each document in turn (`cap` and `data` are allocated
 * once and stay put, `cap` covering the widest document). That header is
 * arena memory this host owns, so rewriting it is allowed, and it takes the
 * per-document cost down to two `i32` stores, a `memcpy` and the call. The
 * alternative — `nish_alloc_array` per document — also forces a `BigInt` per
 * call for its `u64` parameters, which measured 31 ns on its own.
 *
 * TODO(WP30): all of this is hand-rolled because the interop generator has no
 * row for `u8[]` — `--emit-dts` reports a `u8[]` parameter as not exported and
 * writes no loader entry, so there is nothing generated to call. The language
 * and the runtime both have it already, so this becomes a generated `arrayIn`
 * the day that row lands, and the batching belongs in the generator with it.
 *
 * The field offsets are the array ABI from `docs/wp8-interop.md`:
 * `%struct.nish_array = type { i64 len, i64 cap, i8* data }` — `len` at 0,
 * `cap` at 8, `data` at 16.
 */
export const scanBatch = (exports, docs, mode = "validate") => {
  const results = new Int32Array(docs.length);
  if (mode === "echo") {
    for (let i = 0; i < docs.length; i++) results[i] = docs[i].length;
    return results;
  }
  const entry = mode === "guard" ? exports.isJsonShaped : exports.scanJson;
  if (docs.length === 0) return results;

  let widest = 0;
  for (let i = 0; i < docs.length; i++) {
    if (docs[i].length > widest) widest = docs[i].length;
  }

  const mark = exports.nish_arena_mark();
  try {
    const header = exports.nish_alloc_array(1n, BigInt(widest));
    // Read the views only after the allocation: it is the call that can grow
    // linear memory, and a view taken before it would be detached — silently,
    // with `length` 0 and every read `undefined`, rather than throwing.
    const { bytes, fields } = views(exports);
    const data = fields.getUint32(header + 16, true);
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      // `len` is an i64; write it as two i32s so that no `BigInt` is allocated
      // per document. A document longer than 4 GiB cannot exist in a wasm32
      // memory at all, so the high word is always zero.
      fields.setUint32(header, doc.length, true);
      fields.setUint32(header + 4, 0, true);
      bytes.set(doc, data);
      results[i] = entry(header);
    }
  } finally {
    // A trap inside the module leaves the arena wherever it stopped, so the
    // release belongs in a `finally` — otherwise one malformed document leaks
    // its bytes for the life of the worker, and linear memory never shrinks.
    exports.nish_arena_release(mark);
  }
  return results;
};

/** Handle one message; `{ wasm }` loads the module, anything else is a batch. */
export const handle = async (message) => {
  if (message.wasm !== undefined) {
    compiled = await load(message.wasm);
    instance = await WebAssembly.instantiate(compiled, {});
    return { reply: { id: message.id, ready: true }, transfer: [] };
  }
  if (instance === null) throw new Error("bytes-worker: send { wasm } before the first batch");
  const results = scanBatch(instance.exports, message.docs, message.mode);
  // Transfer the results back rather than cloning them: the caller is the only
  // reader and the buffer is ours to give away.
  return { reply: { id: message.id, results }, transfer: [results.buffer] };
};

// ---- The two host bindings ---------------------------------------------------
// Same bridge as `web/worker.mjs`: a browser worker talks through `self`, a Node
// worker through `parentPort`, and neither branch runs on a plain import, so
// `scanBatch` and `handle` stay callable without spawning anything.
if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = async (event) => {
    const { reply, transfer } = await handle(event.data);
    self.postMessage(reply, transfer);
  };
} else if (typeof process !== "undefined" && process.versions?.node) {
  const { parentPort } = await import("node:worker_threads");
  parentPort?.on("message", async (message) => {
    const { reply, transfer } = await handle(message);
    parentPort.postMessage(reply, transfer);
  });
}
