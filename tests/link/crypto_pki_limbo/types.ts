// The shapes of the x509-limbo cases in this directory, which import them.

/** One SERVER case: its limbo id, the expected peer name, the validation time, whether limbo expects the chain to be accepted, and its certificates as indexes into `limboCerts()`. */
export interface LimboCase {
  id: string;
  host: string;
  // `number` rather than `i32`, so the files compile in either number mode: a
  // bare literal in an object literal takes the mode's width. The time is
  // atSec seconds and atMs milliseconds after the Unix epoch.
  atSec: number;
  atMs: number;
  success: boolean;
  peer: number;
  untrusted: number[];
  trusted: number[];
}

/** A case whose verdict differs from limbo's: its id, the finding of docs/security/crypto-pki.md that records the decision, and whether pki accepts the chain limbo refuses (else it refuses one limbo accepts). */
export interface LimboDivergence {
  id: string;
  finding: string;
  accepts: boolean;
}
