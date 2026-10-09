// What every carrier's checks share: how many rounds on a warm connection
// the arena is measured over, after how many unmeasured ones, and how it is
// measured.
import { Secret, secret } from "nish:secret";

/** Rounds after the warm-up, every server wake measured. */
export const ROUNDS: i32 = 50;

/** Rounds first, unmeasured, so that every buffer a connection grows once has grown. */
export const WARM: i32 = 5;

/** Round `k`'s payload: 72 printable bytes, different every round. */
export const roundText = (k: i32): string => `round ${k} of the warm connection: abcdefghijklmnopqrstuvwxyz0123456789`;

/** The arena's chunk, which `Arena.used()` counts within (runtime/runtime.c, `nish_arena_grow`). */
const LB_CHUNK: i64 = 65536;

/**
 * What the server's calls keep in the arena, summed over the calls measured.
 * Plain, it adds how far `Arena.used()` moved across each call, which is
 * exact while nothing is kept: the rounds on a warm connection. Fresh, it
 * starts each call at the head of a chunk of its own — a 70,000-byte filler
 * takes a chunk to itself, and a 4 KiB probe opens the next (a small array
 * stored in a field is kept inside its object, out of the arena) — and reads
 * `Arena.mark()` as well as `Arena.used()` after the call: when the mark has
 * left the chunk the call started in, the call filled the rest of that chunk
 * and went on into another, so it kept the rest of the first and what the
 * second holds. That counts a handshake that keeps more than a chunk, which
 * `net_quic_stream`'s `NqMeter` cannot (it reads only the last chunk), and it
 * counts arena bytes as the process pays for them, a chunk's unused tail
 * included. A call that kept more than two chunks would be undercounted.
 */
export class LbMeter {
  kept: i64 = 0;
  startMark: i64 = 0;
  startUsed: i64 = 0;
  /** The current call's filler and probe, held here so they live until `end`. */
  filler: u8[];
  probe: u8[];
  fresh: boolean = false;

  constructor(fresh: boolean) {
    this.fresh = fresh;
    this.filler = [];
    this.probe = [];
  }

  /** Before a measured call: when fresh, the filler and probe that start it at the head of a chunk of its own. */
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
      this.kept = this.kept + (LB_CHUNK - this.startUsed) + used;
    }
  }
}

/** `m.begin()`, when a meter is set. */
export const lbBegin = (m: LbMeter | null): void => {
  if (m !== null) {
    m.begin();
  }
};

/** `m.end()`, when a meter is set. */
export const lbEnd = (m: LbMeter | null): void => {
  if (m !== null) {
    m.end();
  }
};

/** The band a whole QUIC connection's arena falls in while its handshake still keeps memory (H3-1): 80 to 128 KiB. */
export const lbHandshakeBand = (kept: i64): boolean => kept >= toI64(81920) && kept <= toI64(131072);

/** The P-256 leaf key as a fresh `Secret` for one call, which the caller wipes: `secret` takes only a value nothing else holds. */
export const lbLeafKey = (leaf: u8[]): Secret<u8[]> => {
  const copy: u8[] = new Array<u8>(32);
  for (let k: i32 = 0; k < 32; k++) {
    copy[k] = leaf[k];
  }
  return secret(copy);
};
