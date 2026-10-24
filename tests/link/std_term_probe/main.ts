// `nish/term-probe`: the queries `probeQueries` writes, and what `TermProbe`
// makes of each terminal's answer. Every fixture in `fixtures.ts` (one per
// terminal, each citing where its reply comes from) is fed whole, split into
// two reads at every byte, and one byte per read, and must give the same
// `TermCaps` each way with nothing held back as a key. The rest pins the
// environment rules, the overrides, the timeout, the round trip and the keys
// typed during a probe. Caps print as one line (`summary`), ESC as `^[`.
// `args` denies every capability, as std_term's do.
import { Suite } from "nish/testing";
import { EVENT_KEY, TermEvent } from "nish/term";
import { TermCaps, TermEnv, TermProbe, probeQueries } from "nish/term-probe";
import { replaceAll } from "nish/text";
import { Fixture, fixtures } from "./fixtures";

/** `s` with ESC as `^[`. */
const shown = (s: string): string => replaceAll(s, "\x1b", "^[");

const flag = (b: boolean): string => (b ? "1" : "0");

/** Caps as one line. */
const summary = (c: TermCaps): string =>
  `colors=${c.colors} tc=${flag(c.trueColor)} sync=${flag(c.sync)} kkb=${flag(c.kittyKeyboard)} ` +
  `kgfx=${flag(c.kittyGraphics)} sixel=${flag(c.sixel)}/${c.sixelRegisters} cell=${c.cellWidthPx}x${c.cellHeightPx} ` +
  `pmouse=${flag(c.pixelMouse)} mux=${c.multiplexer} linux=${flag(c.linuxConsole)} remote=${flag(c.remoteHint)} ` +
  `answered=${flag(c.answered)} gfx=${c.graphics} name="${c.name}" overrides="${c.overrides}"`;

/** The held events, a key as `key <kind>:<code>`, joined by ` | `. */
const heldLines = (events: TermEvent[]): string => {
  const parts: string[] = [];
  for (const e of events) {
    parts.push(e.type === EVENT_KEY ? `key ${e.key}:${e.code}` : `event ${e.type}`);
  }
  return parts.join(" | ");
};

/** The bytes of ASCII `s`. */
const ascii = (s: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < s.length; k++) {
    out.push(toU8(s.charCodeAt(k)));
  }
  return out;
};

/** `bytes[from, to)`. */
const part = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k < to; k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** A probe sent at 0 to an 80 by 24 window. */
const started = (env: TermEnv): TermProbe => new TermProbe(env, 80, 24, toF64(0));

/** The probe, once `timedOut` at 1000 ms if the terminal never answered DA1, as one line with whatever it held. */
const finished = (p: TermProbe): string => {
  const late: string = p.done() || p.timedOut(toF64(1000)) ? "" : " (neither done nor timed out)";
  const held: string = p.heldEvents().length > 0 ? ` held: ${heldLines(p.heldEvents())}` : "";
  return `${summary(p.result())}${held}${late}`;
};

/** The caps `env` and `reply`, fed in one read at 1 ms to a window of `cols` by `rows`, give. */
const capsOf = (env: TermEnv, reply: string, cols: i32, rows: i32): string => {
  const p: TermProbe = new TermProbe(env, cols, rows, toF64(0));
  const bytes: u8[] = ascii(reply);
  p.feed(bytes, bytes.length, toF64(1));
  return finished(p);
};

/** Check `f` fed whole, split into two reads at every byte, and one byte per read. */
const checkFixture = (s: Suite, f: Fixture): void => {
  const bytes: u8[] = ascii(f.reply);
  const n: i32 = bytes.length;
  const whole: TermProbe = started(f.env);
  whole.feed(bytes, n, toF64(1));
  s.eqStr(`${f.name}: whole`, finished(whole), f.expected);
  let split: string = f.expected;
  for (let k: i32 = 1; k < n && split === f.expected; k++) {
    const p: TermProbe = started(f.env);
    p.feed(part(bytes, 0, k), k, toF64(1));
    p.feed(part(bytes, k, n), n - k, toF64(2));
    if (finished(p) !== f.expected) {
      split = `split at ${k}: ${finished(p)}`;
    }
  }
  s.eqStr(`${f.name}: split at every byte`, split, f.expected);
  const each: TermProbe = started(f.env);
  for (let k: i32 = 0; k < n; k++) {
    each.feed(part(bytes, k, k + 1), 1, toF64(1));
  }
  s.eqStr(`${f.name}: one byte per read`, finished(each), f.expected);
};

/** An environment with `TERM` set to `term`. */
const termEnv = (term: string): TermEnv => {
  const env: TermEnv = new TermEnv();
  env.term = term;
  return env;
};

/** A kitty that answers every query: kitty keyboard, kitty graphics, sync, 1016, the cell size. */
const KITTY_REPLY: string =
  "\x1bP>|kitty(0.36.4)\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b_Gi=31;OK\x1b\\\x1b[6;20;10t\x1b[4;480;800t\x1b[?62;52;c";

const queries = (s: Suite): void => {
  s.eqStr(
    "queries: every query in one write, DA1 last",
    shown(probeQueries(termEnv("xterm-256color"))),
    "^[[>q^[[?2026$p^[[?1016$p^[[?u^[_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA^[\\^[[?1;1;0S^[[16t^[[14t" +
      "^[[48;2;1;2;3m^[P$qm^[\\^[[m^[[c",
  );
  const tmux: TermEnv = termEnv("tmux-256color");
  tmux.tmux = "/tmp/tmux-1000/default,1234,0";
  s.eqStr(
    "queries: under tmux, kitty graphics and the sizes go through its passthrough with ESC doubled",
    shown(probeQueries(tmux)),
    "^[[>q^[[?2026$p^[[?1016$p^[[?u^[Ptmux;^[^[_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA^[^[\\^[\\^[[?1;1;0S" +
      "^[Ptmux;^[^[[16t^[\\^[Ptmux;^[^[[14t^[\\^[[48;2;1;2;3m^[P$qm^[\\^[[m^[[c",
  );
  const screen: TermEnv = termEnv("screen.xterm-256color");
  screen.sty = "1234.pts-0.host";
  s.eqStr(
    "queries: under screen, the sizes go through its passthrough and the queries holding an ST are left out",
    shown(probeQueries(screen)),
    "^[[>q^[[?2026$p^[[?1016$p^[[?u^[[?1;1;0S^[P^[[16t^[\\^[P^[[14t^[\\^[[c",
  );
};

const environment = (s: Suite): void => {
  const plain: string = "\x1b[?62;22c";
  s.eqStr(
    "env: TERM with 256color, no answer for true colour: 256 colours",
    capsOf(termEnv("xterm-256color"), plain, 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "env: a plain TERM: 16 colours",
    capsOf(termEnv("xterm"), plain, 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  const truecolor: TermEnv = termEnv("xterm-256color");
  truecolor.colorterm = "truecolor";
  s.eqStr(
    "env: COLORTERM=truecolor with no answer for it: true colour, recorded",
    capsOf(truecolor, plain, 80, 24),
    'colors=16777216 tc=1 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides="COLORTERM=truecolor: true colour"',
  );
  const bit24: TermEnv = termEnv("xterm");
  bit24.colorterm = "24bit";
  s.eqStr(
    "env: COLORTERM=24bit, and the terminal read the background back: true colour, nothing forced",
    capsOf(bit24, "\x1bP1$r0;48:2::1:2:3m\x1b\\\x1b[?62c", 80, 24),
    'colors=16777216 tc=1 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  const other: TermEnv = termEnv("xterm-256color");
  other.colorterm = "yes";
  s.eqStr(
    "env: COLORTERM set to something else decides nothing",
    capsOf(other, plain, 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "env: DECRQSS read back with semicolons: true colour",
    capsOf(termEnv("xterm"), "\x1bP1$r48;2;1;2;3m\x1b\\\x1b[?62c", 80, 24),
    'colors=16777216 tc=1 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "env: DECRQSS read back as a 256-colour index: not true colour",
    capsOf(termEnv("xterm-256color"), "\x1bP1$r48;5;16m\x1b\\\x1b[?62c", 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "env: DECRQSS refused (0 $ r) even holding 48:2: not true colour",
    capsOf(termEnv("xterm"), "\x1bP0$r48:2::1:2:3m\x1b\\\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  const noColor: TermEnv = termEnv("xterm-256color");
  noColor.colorterm = "truecolor";
  noColor.noColor = "1";
  s.eqStr(
    "env: NO_COLOR: 16 colours, and graphics untouched",
    capsOf(noColor, KITTY_REPLY, 80, 24),
    'colors=16 tc=0 sync=1 kkb=1 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=kitty name="kitty(0.36.4)" overrides="COLORTERM=truecolor: true colour; NO_COLOR: 16 colours"',
  );
  s.eqStr(
    "env: TERM=dumb: ascii",
    capsOf(termEnv("dumb"), plain, 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=ascii name="" overrides=""',
  );
  const linux: TermEnv = termEnv("linux");
  linux.colorterm = "truecolor";
  s.eqStr(
    "env: TERM=linux wins over whatever answered: 16 colours, ascii, no kitty keyboard, no sync",
    capsOf(linux, KITTY_REPLY, 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=1 remote=0 answered=1 gfx=ascii name="kitty(0.36.4)" overrides="COLORTERM=truecolor: true colour; TERM=linux: 16 colours, ascii, no kitty keyboard, no sync"',
  );
  const names: string[] = ["SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY"];
  for (const name of names) {
    const ssh: TermEnv = termEnv("xterm");
    if (name === "SSH_CONNECTION") {
      ssh.sshConnection = "10.0.0.1 50000 10.0.0.2 22";
    } else if (name === "SSH_CLIENT") {
      ssh.sshClient = "10.0.0.1 50000 22";
    } else {
      ssh.sshTty = "/dev/pts/3";
    }
    s.eqStr(
      `env: ${name} alone: a remote hint`,
      capsOf(ssh, plain, 80, 24),
      'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=1 answered=1 gfx=halfblock name="" overrides=""',
    );
  }
  const program: TermEnv = termEnv("xterm-256color");
  program.termProgram = "Apple_Terminal";
  s.eqStr(
    "env: no XTVERSION: the name is TERM_PROGRAM",
    capsOf(program, plain, 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="Apple_Terminal" overrides=""',
  );
  program.termProgram = "WezTerm";
  s.eqStr(
    "env: XTVERSION wins over TERM_PROGRAM",
    capsOf(program, "\x1bP>|WezTerm 20240203\x1b\\\x1b[?62c", 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="WezTerm 20240203" overrides=""',
  );
};

const answers = (s: Suite): void => {
  const env: TermEnv = termEnv("xterm");
  const modes: string[] = ["0", "1", "2", "3", "4"];
  const known: string[] = ["0", "1", "1", "1", "0"];
  for (let k: i32 = 0; k < modes.length; k++) {
    s.eqStr(
      `answers: DECRPM ${modes[k]} for 2026 and 1016`,
      capsOf(env, `\x1b[?2026;${modes[k]}$y\x1b[?1016;${modes[k]}$y\x1b[?62c`, 80, 24),
      `colors=16 tc=0 sync=${known[k]} kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=${known[k]} mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""`,
    );
  }
  s.eqStr(
    "answers: DECRPM for another mode decides neither",
    capsOf(env, "\x1b[?2004;1$y\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: kitty graphics refused with an error: no kitty graphics",
    capsOf(env, "\x1b_Gi=31;ENOTSUPPORTED:no\x1b\\\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: an OK for another image id: no kitty graphics",
    capsOf(env, "\x1b_Gi=7;OK\x1b\\\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: sixel with 256 registers: sixel",
    capsOf(env, "\x1b[?1;0;256S\x1b[?62;4c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=1/256 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=sixel name="" overrides=""',
  );
  s.eqStr(
    "answers: sixel with 16 registers: halfblock",
    capsOf(env, "\x1b[?1;0;16S\x1b[?62;4c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=1/16 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: XTSMGRAPHICS failed (status 3): no registers",
    capsOf(env, "\x1b[?1;3;0S\x1b[?62;4c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=1/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: registers but no 4 in DA1: no sixel",
    capsOf(env, "\x1b[?1;0;1024S\x1b[?62;22c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/1024 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: kitty graphics wins over sixel",
    capsOf(env, "\x1b_Gi=31;OK\x1b\\\x1b[?1;0;1024S\x1b[?62;4c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=1 sixel=1/1024 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=kitty name="" overrides=""',
  );
  s.eqStr(
    "answers: the cell from the text area over the window, rounded down",
    capsOf(env, "\x1b[4;490;805t\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=10x20 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: the text area with a window of 0 rows: unknown",
    capsOf(env, "\x1b[4;490;805t\x1b[?62c", 80, 0),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: a text area smaller than the window: unknown, not 0 by something",
    capsOf(env, "\x1b[4;10;805t\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: CSI 16 t wins over CSI 14 t",
    capsOf(env, "\x1b[6;17;9t\x1b[4;480;800t\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=9x17 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: a cell size of 0 falls back to CSI 14 t",
    capsOf(env, "\x1b[6;0;0t\x1b[4;480;800t\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=10x20 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
  s.eqStr(
    "answers: DA2 is not DA1: the probe is not done",
    capsOf(env, "\x1b[>41;390;0c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=0 gfx=halfblock name="" overrides=""',
  );
};

/** An environment with `NISH_TERM_GRAPHICS`, `TERM` and `TMUX` set. */
const forced = (graphics: string, term: string, tmux: string): TermEnv => {
  const env: TermEnv = termEnv(term);
  env.nishTermGraphics = graphics;
  env.tmux = tmux;
  return env;
};

const overrides = (s: Suite): void => {
  s.eqStr(
    "overrides: halfblock over kitty",
    capsOf(forced("halfblock", "xterm-kitty", ""), KITTY_REPLY, 80, 24),
    'colors=16 tc=0 sync=1 kkb=1 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="kitty(0.36.4)" overrides="NISH_TERM_GRAPHICS=halfblock: halfblock"',
  );
  s.eqStr(
    "overrides: ascii over kitty",
    capsOf(forced("ascii", "xterm-kitty", ""), KITTY_REPLY, 80, 24),
    'colors=16 tc=0 sync=1 kkb=1 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=ascii name="kitty(0.36.4)" overrides="NISH_TERM_GRAPHICS=ascii: ascii"',
  );
  s.eqStr(
    "overrides: halfblock on the Linux console",
    capsOf(forced("halfblock", "linux", ""), "\x1b[?6c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=1 remote=0 answered=1 gfx=halfblock name="" overrides="TERM=linux: 16 colours, ascii, no kitty keyboard, no sync; NISH_TERM_GRAPHICS=halfblock: halfblock"',
  );
  s.eqStr(
    "overrides: sixel the terminal answered for",
    capsOf(forced("sixel", "xterm-kitty", ""), "\x1b_Gi=31;OK\x1b\\\x1b[?1;0;16S\x1b[?62;4c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=1 sixel=1/16 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=sixel name="" overrides="NISH_TERM_GRAPHICS=sixel: sixel"',
  );
  s.eqStr(
    "overrides: kitty where the terminal answered DA1 directly but not the query: kept",
    capsOf(forced("kitty", "xterm-256color", ""), "\x1b[?62;22c", 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=kitty name="" overrides="NISH_TERM_GRAPHICS=kitty: kitty"',
  );
  s.eqStr(
    "overrides: kitty under tmux with the passthrough query unanswered: refused",
    capsOf(forced("kitty", "tmux-256color", "/tmp/tmux-1000/default,1,0"), "\x1b[?1;2;4c", 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=1/0 cell=0x0 pmouse=0 mux=tmux linux=0 remote=0 answered=1 gfx=halfblock name="" overrides="NISH_TERM_GRAPHICS=kitty: refused, the terminal did not answer for it"',
  );
  s.eqStr(
    "overrides: kitty under tmux with the passthrough query answered: kept",
    capsOf(forced("kitty", "tmux-256color", "/tmp/tmux-1000/default,1,0"), "\x1b_Gi=31;OK\x1b\\\x1b[?1;2;4c", 80, 24),
    'colors=256 tc=0 sync=0 kkb=0 kgfx=1 sixel=1/0 cell=0x0 pmouse=0 mux=tmux linux=0 remote=0 answered=1 gfx=kitty name="" overrides="NISH_TERM_GRAPHICS=kitty: kitty"',
  );
  s.eqStr(
    "overrides: sixel on the Linux console: refused",
    capsOf(forced("sixel", "linux", ""), "\x1b[?6c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=1 remote=0 answered=1 gfx=ascii name="" overrides="TERM=linux: 16 colours, ascii, no kitty keyboard, no sync; NISH_TERM_GRAPHICS=sixel: refused, the terminal did not answer for it"',
  );
  s.eqStr(
    "overrides: sixel from a terminal that answered nothing: refused",
    capsOf(forced("sixel", "xterm", ""), "", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=0 gfx=halfblock name="" overrides="NISH_TERM_GRAPHICS=sixel: refused, the terminal did not answer for it"',
  );
  s.eqStr(
    "overrides: a backend that is not one: ignored, recorded",
    capsOf(forced("braille", "xterm", ""), "\x1b[?62c", 80, 24),
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides="NISH_TERM_GRAPHICS=braille: ignored, not kitty, sixel, halfblock or ascii"',
  );
};

const machine = (s: Suite): void => {
  const env: TermEnv = termEnv("xterm-256color");
  const p: TermProbe = new TermProbe(env, 80, 24, toF64(100));
  s.eqBool("machine: not done before any answer", p.done(), false);
  s.eqStr("machine: no round trip before DA1", `${p.rttMs()}`, "-1");
  s.eqBool("machine: not timed out 249 ms after the send", p.timedOut(toF64(349)), false);
  const first: u8[] = ascii("a\x1b[?2026;2$y\x1b[A");
  p.feed(first, first.length, toF64(120));
  s.eqBool("machine: not done on an answer before DA1", p.done(), false);
  const rest: u8[] = ascii("\x1b[?62;22cb");
  p.feed(rest, rest.length, toF64(137));
  s.eqBool("machine: done at DA1", p.done(), true);
  s.eqStr("machine: the round trip is the send to DA1", `${p.rttMs()}`, "37");
  s.eqStr("machine: the caps carry the round trip", `${p.result().probeRttMs}`, "37");
  s.eqBool("machine: never timed out once done", p.timedOut(toF64(100000)), false);
  s.eqStr(
    "machine: keys typed before, during and after the answers are held, in order",
    heldLines(p.heldEvents()),
    "key 1:97 | key 2:65 | key 1:98",
  );
  s.eqBool("machine: the held keys did not change the answers", p.result().sync, true);
  const late: u8[] = ascii("\x1b[?2026;0$y");
  p.feed(late, late.length, toF64(140));
  s.eqBool("machine: an answer after DA1 still counts", p.result().sync, false);

  const silent: TermProbe = new TermProbe(env, 80, 24, toF64(100));
  silent.timeoutMs = toF64(500);
  s.eqBool("machine: timeoutMs is the caller's to set", silent.timedOut(toF64(350)), false);
  s.eqBool("machine: timed out at timeoutMs", silent.timedOut(toF64(600)), true);
  s.eqStr("machine: no round trip on a timeout", `${silent.result().probeRttMs}`, "-1");

  const cut: TermProbe = new TermProbe(env, 80, 24, toF64(0));
  const partial: u8[] = ascii("\x1b[?2026;2$y\x1b");
  cut.feed(partial, partial.length, toF64(10));
  s.eqStr("machine: an ESC held at the end is not given up early", heldLines(cut.heldEvents()), "");
  s.eqBool("machine: timed out with an ESC held", cut.timedOut(toF64(250)), true);
  s.eqStr("machine: the held ESC is given up as a key on the timeout", heldLines(cut.heldEvents()), "key 8:27");
  s.eqBool("machine: the answers before it still count", cut.result().sync, true);

  const unfinished: TermProbe = new TermProbe(env, 80, 24, toF64(0));
  const da1: u8[] = ascii("\x1bP>|xterm(390\x1b[?62");
  unfinished.feed(da1, da1.length, toF64(10));
  s.eqBool("machine: a DA1 cut off is not an answer", unfinished.done(), false);
  s.eqBool("machine: timed out on a DA1 cut off", unfinished.timedOut(toF64(260)), true);
  s.eqStr("machine: nothing of an unterminated DCS reaches the result", unfinished.result().name, "");
  s.eqBool("machine: answered is false on a timeout", unfinished.result().answered, false);
};

export const main = (): i32 => {
  const s: Suite = new Suite("term probe");
  queries(s);
  for (const f of fixtures()) {
    checkFixture(s, f);
  }
  environment(s);
  answers(s);
  overrides(s);
  machine(s);
  return s.done();
};
