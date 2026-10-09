// The meter `net_quic_memory` and `net_http3_server` read the arena with,
// lifted from the loopback suite's `LbMeter` (tests/link/net_loopback, #489):
// `net_quic_stream`'s `NqMeter` reads only the chunk a call ends in, which
// made a QUIC handshake look like 27 KB when it kept about 100.

/** The arena's chunk, which `Arena.used()` counts within (runtime/runtime.c, `nish_arena_grow`). */
const QM_CHUNK: i64 = 65536;

/**
 * What the server's calls keep in the arena, summed over the calls metered.
 * Plain, it adds how far `Arena.used()` moved across each call, which is
 * exact while nothing is kept. Fresh, the default, it starts each call at
 * the head of a chunk of its own — a 70,000-byte filler takes a chunk to
 * itself, and a 4 KiB probe opens the next — and after it reads
 * `Arena.mark()` as well as `Arena.used()`: when the mark has left the chunk
 * the call started in, the call filled the rest of that chunk and went on
 * into another, so it kept the rest of the first and what the second holds.
 * That counts a call that keeps more than one chunk, the chunk's unused tail
 * included, as the process pays for it; a call that kept more than two
 * chunks would be undercounted.
 */
export class QmMeter {
  kept: i64 = 0;
  startMark: i64 = 0;
  startUsed: i64 = 0;
  /** The current call's filler and probe, held here so that they live until `end`. */
  filler: u8[];
  probe: u8[];
  fresh: boolean = true;

  constructor() {
    this.filler = [];
    this.probe = [];
  }

  /** Before a metered call: when fresh, the filler and probe that start it at the head of a chunk of its own. */
  begin(): void {
    if (this.fresh) {
      this.filler = new Array<u8>(70000);
      this.probe = new Array<u8>(4096);
    }
    this.startMark = Arena.mark();
    this.startUsed = Arena.used();
  }

  /** After it: counts what the call kept. */
  end(): void {
    const used: i64 = Arena.used();
    const moved: i64 = Arena.mark() - this.startMark;
    if (!this.fresh || moved === used - this.startUsed) {
      this.kept = this.kept + (used - this.startUsed);
    } else {
      this.kept = this.kept + (QM_CHUNK - this.startUsed) + used;
    }
  }
}

/** A meter that only adds how far `Arena.used()` moved: for calls that keep nothing. */
export const qmPlain = (): QmMeter => {
  const m = new QmMeter();
  m.fresh = false;
  return m;
};

/** `m.begin()`, when a meter is set. */
export const qmBegin = (m: QmMeter | null): void => {
  if (m !== null) {
    m.begin();
  }
};

/** `m.end()`, when a meter is set. */
export const qmEnd = (m: QmMeter | null): void => {
  if (m !== null) {
    m.end();
  }
};
