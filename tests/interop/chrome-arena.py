"""Chromium soaks examples/wasm-arena (docs/wp50-wasm-host.md §10, W9).

The interop workflow's `arena` job serves the directory
examples/wasm-arena/build.mjs writes on localhost (a secure context, as
WebGPU and WebTransport require) and runs this with Playwright's own
Chromium. The page runs as a player would see it: `requestAnimationFrame`
drives `frame(dtMs)`, and the script types the page's own `scripted` keys
as KeyboardEvents its listeners hear. It checks, for `seconds`:

  memory   `memory.buffer.byteLength` and the arena's mark (`nish_arena_mark`,
           read from the raw exports) are the same after every frame;
  heap     the used JS heap after a forced GC at one tenth of the run and at
           its end differs by at most HEAP_BAND bytes, and a HeapProfiler
           sampling profile over the same span, counting the objects GC
           took, allocated at most FRAME_BAND bytes a frame;

and writes what it saw to `out` as JSON: the figures, the renderer the page
chose (WebGPU when the adapter answers, WebGL 2 when not), and the input it
recorded, run-length coded, with the hash, for the job to replay natively
with build/arena/replay. It exits 1 when a check above fails.

Then two checks the note's §5.3 and §8 left to a browser, recorded in the
same JSON and not failing the run, since each records what Chromium does:

  datagram  (with --webtransport) a WebTransport datagram write copies its
            bytes: the view is overwritten after `write`, and the echo the
            interop server sends back must be the bytes as written;
  loadSync  the generated loader's `loadSync` of client.wasm padded with a
            custom section to just under 8 MiB, and to just over.

    python3 chrome-arena.py <page url> <seconds> <out.json>
        [--webtransport <quic port> <hash file>]

CHROMIUM names a browser binary to use in place of Playwright's own.
"""

import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

# The used heap may move this much between the two forced GCs: V8's own
# bookkeeping and the compiled code of functions that tier up late.
HEAP_BAND = 256 * 1024
# Bytes a frame may allocate, sampled: the loader's call wrapper and
# requestAnimationFrame's callback bookkeeping, and the renderer's per-frame
# objects (a command encoder and a texture view under WebGPU).
FRAME_BAND = 1024
# The sampling interval, in bytes: small enough that a few minutes of a
# 64-byte-a-frame allocation shows.
SAMPLING = 4096

# Runs before the page's own script: keeps the raw exports the loader keeps to
# itself, and hooks each frame to type the scripted keys and check memory.
WATCH = """
(() => {
  const Real = WebAssembly.Instance;
  let raw = null;
  WebAssembly.Instance = function Instance(module, imports) {
    const made = new Real(module, imports);
    if (raw === null) raw = made.exports;
    return made;
  };
  WebAssembly.Instance.prototype = Real.prototype;
  const watch = { frames: 0, moved: 0, length: -1, mark: -1, renderer: null, page: null };
  globalThis.arenaWatch = watch;
  import("./page.js").then((page) => { watch.page = page; });
  globalThis.arenaAfterFrame = (arena) => {
    if (watch.length < 0) {
      watch.length = arena.module.memory.buffer.byteLength;
      watch.mark = raw.nish_arena_mark();
    } else if (arena.module.memory.buffer.byteLength !== watch.length || raw.nish_arena_mark() !== watch.mark) {
      watch.moved++;
    }
    const page = watch.page;
    if (page !== null) {
      const word = page.scripted(watch.frames);
      for (let bit = 0; bit < 5; bit++) {
        if ((word >> bit) & 1) dispatchEvent(new KeyboardEvent("keydown", { code: page.CODES[bit] }));
        if ((word >> (bit + 8)) & 1) dispatchEvent(new KeyboardEvent("keyup", { code: page.CODES[bit] }));
      }
    }
    watch.frames++;
  };
})();
"""

# The run's record, read between two frames, so the hash and the log agree.
RECORD = """
async () => {
  const arena = await globalThis.arena;
  const watch = globalThis.arenaWatch;
  return {
    frames: watch.frames,
    moved: watch.moved,
    byteLength: watch.length,
    mark: watch.mark,
    webgpu: arena.webgpu,
    ticks: arena.module.ticks(),
    logged: arena.logged(),
    overflow: arena.overflow(),
    hash: arena.hash(),
    runs: watch.page.runs(arena.log, arena.logged()),
  };
}
"""

# §5.3: overwrite the view after each write; every echo must be the bytes written.
DATAGRAM = """
async ({ port, hash }) => {
  const pinned = new Uint8Array(hash.match(/../g).map((h) => parseInt(h, 16)));
  const wt = new WebTransport(`https://127.0.0.1:${port}/echo`, {
    serverCertificateHashes: [{ algorithm: "sha-256", value: pinned }],
  });
  await wt.ready;
  const writer = wt.datagrams.writable.getWriter();
  const reader = wt.datagrams.readable.getReader();
  const view = new Uint8Array(32);
  const echoes = [];
  let pending = null;
  for (let attempt = 0; attempt < 25 && echoes.length === 0; attempt++) {
    view.fill(0x41 + (attempt % 16));
    const written = Array.from(view);
    await writer.write(view);
    view.fill(0x7a);
    if (pending === null) pending = reader.read();
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 200));
    const got = await Promise.race([pending, timeout]);
    if (got !== null) {
      pending = null;
      echoes.push({ written, echoed: Array.from(got.value) });
    }
  }
  wt.close();
  if (echoes.length === 0) return { copied: null, detail: "no datagram came back in 25 tries" };
  const { written, echoed } = echoes[0];
  const copied = written.length === echoed.length && written.every((b, i) => echoed[i] === b);
  return { copied, detail: "wrote " + written.length + " bytes of " + written[0] + ", got back " + echoed.slice(0, 4).join(",") + "..." };
}
"""

# §8: loadSync on the main thread, of client.wasm padded to `size` bytes by a custom section.
LOAD_SYNC = """
async (sizes) => {
  const client = await import("./client.mjs");
  const host = await import("./host.js");
  const base = new Uint8Array(await (await fetch("./client.wasm")).arrayBuffer());
  const leb = (n) => { const out = []; do { let b = n & 127; n >>>= 7; if (n !== 0) b |= 128; out.push(b); } while (n !== 0); return out; };
  const padded = (size) => {
    const name = [0x70, 0x61, 0x64];
    // The section's payload length, for a total of `size`: the LEBs' widths settle in two rounds.
    let payload = size - base.length - 1 - 1 - name.length;
    for (let round = 0; round < 2; round++) {
      payload = size - base.length - 1 - leb(name.length + leb(name.length).length + payload).length - leb(name.length).length - name.length;
    }
    const head = [0, ...leb(leb(name.length).length + name.length + payload), ...leb(name.length), ...name];
    const bytes = new Uint8Array(base.length + head.length + payload);
    bytes.set(base, 0);
    bytes.set(head, base.length);
    return bytes;
  };
  const results = [];
  for (const size of sizes) {
    const bytes = padded(size);
    const t0 = performance.now();
    try {
      const module = client.loadSync(bytes, { host });
      results.push({ size: bytes.length, ok: true, ms: performance.now() - t0, detail: "loaded; memory " + module.memory.buffer.byteLength });
    } catch (e) {
      results.push({ size: bytes.length, ok: false, ms: performance.now() - t0, detail: String(e) });
    }
  }
  return results;
}
"""

MIB = 1024 * 1024


def sampled_bytes(profile):
    """The bytes a sampling profile's tree counts, and its five heaviest frames."""
    total = 0
    by_name = {}
    stack = [profile["head"]]
    while stack:
        node = stack.pop()
        size = node.get("selfSize", 0)
        total += size
        frame = node["callFrame"]
        name = f'{frame["functionName"] or "(anonymous)"} {frame["url"].rsplit("/", 1)[-1]}:{frame["lineNumber"] + 1}'
        by_name[name] = by_name.get(name, 0) + size
        stack.extend(node.get("children", []))
    top = sorted(by_name.items(), key=lambda kv: -kv[1])[:5]
    return total, [{"site": k, "bytes": v} for k, v in top if v > 0]


def used_heap(cdp):
    """The used JS heap after two forced GCs."""
    cdp.send("HeapProfiler.collectGarbage")
    cdp.send("HeapProfiler.collectGarbage")
    return cdp.send("Runtime.getHeapUsage")["usedSize"]


def frames(page):
    return page.evaluate("globalThis.arenaWatch.frames")


def main(argv):
    if len(argv) not in (3, 6) or (len(argv) == 6 and argv[3] != "--webtransport"):
        sys.stderr.write(__doc__)
        return 2
    url, seconds, out = argv[0], float(argv[1]), argv[2]
    early = seconds / 10
    report = {"url": url, "seconds": seconds, "heapBand": HEAP_BAND, "frameBand": FRAME_BAND}
    failures = []
    with sync_playwright() as p:
        launch = {"args": ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-webgpu-adapter=swiftshader"]}
        if os.environ.get("CHROMIUM"):
            launch["executable_path"] = os.environ["CHROMIUM"]
        browser = p.chromium.launch(**launch)
        report["chromium"] = browser.version
        page = browser.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script(WATCH)
        cdp = page.context.new_cdp_session(page)
        cdp.send("HeapProfiler.enable")
        page.goto(url)
        page.wait_for_function("globalThis.arenaWatch && globalThis.arenaWatch.frames > 0", timeout=30000)
        report["gpu"] = page.evaluate(
            """async () => {
              if (navigator.gpu === undefined) return "navigator.gpu is undefined";
              const adapter = await navigator.gpu.requestAdapter();
              if (adapter === null) return "requestAdapter() answered null";
              const info = adapter.info ?? {};
              return "adapter: " + [info.vendor, info.architecture, info.description].filter((s) => s).join(" / ");
            }"""
        )
        start = time.monotonic()

        page.wait_for_timeout(early * 1000)
        heap_early = used_heap(cdp)
        frames_early = frames(page)
        cdp.send(
            "HeapProfiler.startSampling",
            {
                "samplingInterval": SAMPLING,
                "includeObjectsCollectedByMajorGC": True,
                "includeObjectsCollectedByMinorGC": True,
            },
        )

        page.wait_for_timeout(max(0, seconds - (time.monotonic() - start)) * 1000)
        profile = cdp.send("HeapProfiler.stopSampling")["profile"]
        frames_late = frames(page)
        heap_late = used_heap(cdp)
        record = page.evaluate(RECORD)
        elapsed = time.monotonic() - start

        sampled, sites = sampled_bytes(profile)
        span = max(1, frames_late - frames_early)
        report.update(record)
        report["elapsed"] = round(elapsed, 1)
        report["heap"] = {
            "early": heap_early,
            "late": heap_late,
            "delta": heap_late - heap_early,
            "earlyAt": round(early, 1),
            "sampledBytes": sampled,
            "sampledFrames": span,
            "bytesPerFrame": round(sampled / span, 1),
            "heaviest": sites,
        }
        if record["moved"] != 0:
            failures.append(f"memory's byteLength or the arena's mark moved after {record['moved']} frames")
        if record["overflow"] != 0:
            failures.append(f"{record['overflow']} ticks were stepped past the log's end")
        if abs(heap_late - heap_early) > HEAP_BAND:
            failures.append(f"the used heap moved {heap_late - heap_early} bytes, past the band of {HEAP_BAND}")
        if sampled / span > FRAME_BAND:
            failures.append(f"a frame allocated {sampled / span:.0f} bytes, past the band of {FRAME_BAND}")
        if record["frames"] < 30 * seconds:
            failures.append(f"only {record['frames']} frames in {seconds:.0f} s")

        report["loadSync"] = page.evaluate(LOAD_SYNC, [8 * MIB - 4096, 8 * MIB + 4096])
        if len(argv) == 6:
            with open(argv[5], encoding="ascii") as f:
                cert_hash = f.read().strip()
            report["datagram"] = page.evaluate(DATAGRAM, {"port": int(argv[4]), "hash": cert_hash})
        if errors:
            report["consoleErrors"] = errors[:10]
            failures.append(f"the page logged {len(errors)} errors; the first: {errors[0]}")
        browser.close()
    report["failures"] = failures
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)
    summary = {k: v for k, v in report.items() if k != "runs"}
    print(json.dumps(summary, indent=1))
    for failure in failures:
        print("FAIL", failure)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
