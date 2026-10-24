// What each terminal answers to `probeQueries`, and the caps that answer gives.
// A reply holds only the answers its terminal's source shows, in the order the
// queries go out. A query with no handler in the source gets no answer here,
// and neither does one whose reply could not be found. Each fixture cites where
// it comes from: the repository, the commit read, then file:line. The line
// numbers are from the files as read and may drift from the commit. [D] marks
// a reply worked out from the source plus a build or config default, not a
// literal in it. The cell size is a 10 by 20 pixel cell in an 80 by 24 window,
// which `main.ts` gives every probe.
import { TermEnv } from "nish/term-probe";

export class Fixture {
  name: string;
  env: TermEnv;
  reply: string;
  expected: string;

  constructor(name: string, env: TermEnv, reply: string, expected: string) {
    this.name = name;
    this.env = env;
    this.reply = reply;
    this.expected = expected;
  }
}

const fixture = (name: string, env: TermEnv, reply: string, expected: string): Fixture =>
  new Fixture(name, env, reply, expected);

const envOf = (term: string, colorterm: string, termProgram: string): TermEnv => {
  const env: TermEnv = new TermEnv();
  env.term = term;
  env.colorterm = colorterm;
  env.termProgram = termProgram;
  return env;
};

const kitty = (): Fixture =>
  // github.com/kovidgoyal/kitty @81535d9
  // XTVERSION kitty/screen.c:3221 (version kitty/constants.py:25); DECRPM
  // 2026 and 1016 kitty/screen.c:3303-3336 (modes kitty/modes.h:69,86);
  // `?u` kitty/screen.c:2120-2125; graphics OK kitty/graphics.c:2739-2753,
  // 1056; `16t` and `14t` kitty/screen.c:3226-3258; DECRQSS m
  // kitty/screen.c:3781-3783 with the colour format at kitty/line.c:960 [D];
  // DA1 kitty/window.py:677-682 (52 with clipboard writes allowed, the
  // default). No sixel, so no XTSMGRAPHICS handler.
  fixture(
    "kitty",
    envOf("xterm-kitty", "truecolor", ""),
    "\x1bP>|kitty(0.49.2)\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b_Gi=31;OK\x1b\\" +
      "\x1b[6;20;10t\x1b[4;480;800t\x1bP1$r0;48:2:1:2:3m\x1b\\\x1b[?62;52;c",
    'colors=16777216 tc=1 sync=1 kkb=1 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=kitty name="kitty(0.49.2)" overrides=""',
  );

const ghostty = (): Fixture =>
  // github.com/ghostty-org/ghostty @8ef0ec1
  // XTVERSION src/termio/stream_handler.zig:970-985; DECRPM
  // src/terminal/modes.zig:395,404 reported at stream_handler.zig:592-598;
  // `?u` stream_handler.zig:955-968; graphics OK stream_handler.zig:513-520
  // (format src/terminal/kitty/graphics_command.zig:1582); `16t` and `14t`
  // src/terminal/size_report.zig:59-72; DECRQSS m src/terminal/dcs.zig:279-282
  // (test at 539-544); DA1 stream_handler.zig:819-841. No sixel.
  fixture(
    "Ghostty",
    envOf("xterm-ghostty", "truecolor", "ghostty"),
    "\x1bP>|ghostty 1.2.0\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b_Gi=31;OK\x1b\\" +
      "\x1b[6;20;10t\x1b[4;480;800t\x1bP1$r0;48:2::1:2:3m\x1b\\\x1b[?62;22;52c",
    'colors=16777216 tc=1 sync=1 kkb=1 kgfx=1 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=kitty name="ghostty 1.2.0" overrides=""',
  );

const wezterm = (): Fixture =>
  // github.com/wez/wezterm @e2a98e1
  // XTVERSION term/src/terminalstate/mod.rs:1440-1447; DECRPM 2026
  // mod.rs:1693-1708 ("always reports false", so 2) and 1016 mod.rs:1956-1972;
  // XTSMGRAPHICS mod.rs:1481-1485; `16t` mod.rs:2155-2165, `14t`
  // mod.rs:2167-2174; DECRQSS handles only DECSCL, DECSTBM and DECSLRM
  // (term/src/terminalstate/performer.rs:296-345), so m is refused; DA1
  // mod.rs:1407-1417. `?u` answers only with enable_kitty_keyboard, off by
  // default (performer.rs:563-571). WezTerm reads kitty graphics, but its
  // answer to a query with `i` alone (term/src/terminalstate/kitty.rs) was not
  // found, so none is given here.
  fixture(
    "WezTerm",
    envOf("xterm-256color", "truecolor", "WezTerm"),
    "\x1bP>|WezTerm 20240203-110809-5046fc22\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?1;0;65536S" +
      "\x1b[6;20;10t\x1b[4;480;800t\x1bP0$r\x1b\\\x1b[?65;4;6;18;22;52c",
    'colors=16777216 tc=1 sync=1 kkb=0 kgfx=0 sixel=1/65536 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=sixel name="WezTerm 20240203-110809-5046fc22" overrides="COLORTERM=truecolor: true colour"',
  );

const foot = (): Fixture =>
  // codeberg.org/dnkl/foot @cb27717
  // XTVERSION csi.c:1763-1775; DECRPM csi.c:635-679, written at 2252-2254;
  // `?u` csi.c:1627-1633; XTSMGRAPHICS sixel.c:2141-2145 (SIXEL_MAX_COLORS
  // sixel.h:5, dispatch csi.c:1521-1524); `16t` csi.c:1360-1366, `14t`
  // csi.c:1315-1345; DECRQSS m dcs.c:280-415, colour near 378 [D]; DA1
  // csi.c:870-884 with sixel and OSC 52 on, the defaults. foot has no kitty
  // graphics, and what its APC path answers was not found, so none is given.
  fixture(
    "foot",
    envOf("foot", "", ""),
    "\x1bP>|foot(1.20.0)\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b[?1;0;1024S" +
      "\x1b[6;20;10t\x1b[4;480;800t\x1bP1$r0;48:2::1:2:3m\x1b\\\x1b[?62;4;22;28;52c",
    'colors=16777216 tc=1 sync=1 kkb=1 kgfx=0 sixel=1/1024 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=sixel name="foot(1.20.0)" overrides=""',
  );

const alacritty = (): Fixture =>
  // github.com/alacritty/alacritty @5421470, github.com/alacritty/vte @abeae76
  // DECRPM alacritty_terminal/src/term/mod.rs:2075-2092 (2026 near 2084, 1016
  // not a named mode, so 0); `14t` mod.rs:2259-2266; DA1 mod.rs:1257-1263.
  // vte src/ansi.rs:1739-1745 handles `t` 14, 18, 22 and 23 only, so no `16t`;
  // no `CSI > q`, DECRQSS or XTSMGRAPHICS handler; unhandled APC is logged
  // (ansi.rs:1311-1325). `?u` answers only with kitty_keyboard, off by default
  // (mod.rs:1274-1284).
  fixture(
    "Alacritty",
    envOf("alacritty", "truecolor", ""),
    "\x1b[?2026;2$y\x1b[?1016;0$y\x1b[4;480;800t\x1b[?6c",
    'colors=16777216 tc=1 sync=1 kkb=0 kgfx=0 sixel=0/0 cell=10x20 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides="COLORTERM=truecolor: true colour"',
  );

const xterm = (): Fixture =>
  // github.com/ThomasDickey/xterm-snapshots @5c75ead (patch 412)
  // XTVERSION version.c:70-72, charproc.c:5457-5470, ctlseqs.txt:1531-1532;
  // DECRPM 2026 has no handler, so 0 [D], and 1016 is SGR-Pixels
  // (ctlseqs.txt:2943,3200) [D]; `16t` and `14t` ctlseqs.txt near 1676-1684;
  // DA1 charproc.c:4068-4215 from the default decTerminalID 420 [D]. A default
  // build has no sixel, so no XTSMGRAPHICS (charproc.c:5165-5200). xterm
  // answers DECRQSS (ctlseqs.txt:479), but its exact bytes for m were not
  // found, so none is given.
  fixture(
    "xterm",
    envOf("xterm-256color", "", ""),
    "\x1bP>|XTerm(412)\x1b\\\x1b[?2026;0$y\x1b[?1016;2$y\x1b[6;20;10t\x1b[4;480;800t" +
      "\x1b[?64;1;2;6;9;15;18;21;22c",
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="XTerm(412)" overrides=""',
  );

const iterm2 = (): Fixture =>
  // github.com/gnachman/iTerm2 @0139844
  // XTVERSION sources/VT100/VT100Output.m:1189-1193; DECRPM
  // sources/VT100/VT100Terminal.m:936,1036,5244-5246,5893,5909; `?u`
  // VT100Output.m:930-931, VT100Terminal.m:2650-2660; `16t` (in points)
  // VT100Terminal.m:2940-2956, `14t` 2932-2938; DECRQSS m
  // VT100Terminal.m:3671-3680,3735,3898 [D]; DA1 VT100Output.m:956-1112.
  // iTerm2 draws images with OSC 1337, not kitty graphics. It answers
  // XTSMGRAPHICS with SIXEL_PALETTE_MAX (VT100Terminal.m:5472), whose value was
  // not found, so none is given.
  fixture(
    "iTerm2",
    envOf("xterm-256color", "truecolor", "iTerm.app"),
    "\x1bP>|iTerm2 3.5.0\x1b\\\x1b[?2026;2$y\x1b[?1016;2$y\x1b[?0u\x1b[6;20;10t\x1b[4;480;800t" +
      "\x1bP1$r48:2:1:1:2:3m\x1b\\\x1b[?64;1;2;4;6;17;18;21;22c",
    'colors=16777216 tc=1 sync=1 kkb=1 kgfx=0 sixel=1/0 cell=10x20 pmouse=1 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="iTerm2 3.5.0" overrides=""',
  );

const appleTerminal = (): Fixture =>
  // Terminal.app is closed source, and no documentation or issue citing its
  // replies was found. So nothing is fed: the fixture pins what its
  // environment (TERM_PROGRAM=Apple_Terminal, TERM=xterm-256color) decides on
  // a timeout, not what it answers.
  fixture(
    "Apple Terminal",
    envOf("xterm-256color", "", "Apple_Terminal"),
    "",
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=0 gfx=halfblock name="Apple_Terminal" overrides=""',
  );

const windowsTerminal = (): Fixture =>
  // github.com/microsoft/terminal @98c8c79, src/terminal/adapter/adaptDispatch.cpp
  // DECRPM 1930-2040 (2026 at 2029; no 1016 case, so 0, format near 2046);
  // `16t` and `14t` 3496-3530; DECRQSS m 4323-4389; DA1 1435-1465 (52 with
  // ClipboardWrite on). `?u` answers nothing under ConPTY (2094-2103). No
  // XTVERSION, XTSMGRAPHICS or kitty graphics handler was found.
  fixture(
    "Windows Terminal",
    envOf("xterm-256color", "", ""),
    "\x1b[?2026;2$y\x1b[?1016;0$y\x1b[6;20;10t\x1b[4;480;800t\x1bP1$r0;48:2::1:2:3m\x1b\\" +
      "\x1b[?61;4;6;7;14;21;22;23;24;28;32;42;52c",
    'colors=16777216 tc=1 sync=1 kkb=0 kgfx=0 sixel=1/0 cell=10x20 pmouse=0 mux=none linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );

const tmuxEnv = (): TermEnv => {
  const env: TermEnv = envOf("tmux-256color", "", "tmux");
  env.tmux = "/tmp/tmux-1000/default,1234,0";
  return env;
};

// github.com/tmux/tmux @acee541, input.c
// XTVERSION 1904; DECRPM near 1730-1735 (2026 from MODE_SYNC; 1016 not in the
// switch, so 0); DECRQSS handles only `SP q` (2571-2633), so m is refused at
// 2631; DA1 1598-1604, without ENABLE_IMAGES `?1;2c`. tmux swallows APC
// (491-495, 544), does not answer `?u`, and without ENABLE_IMAGES sends no
// XTSMGRAPHICS answer (2120-2136).
const TMUX_REPLY: string = "\x1bP>|tmux 3.5a\x1b\\\x1b[?2026;2$y\x1b[?1016;0$y\x1bP0$r\x1b\\\x1b[?1;2c";

const tmuxOff = (): Fixture =>
  // With allow-passthrough off, tmux drops `DCS tmux; … ST` (input.c:2644-2697,
  // tmux.1:6465-6475), so kitty graphics and both sizes go unanswered.
  fixture(
    "tmux, passthrough off",
    tmuxEnv(),
    TMUX_REPLY,
    'colors=256 tc=0 sync=1 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=tmux linux=0 remote=0 answered=1 gfx=halfblock name="tmux 3.5a" overrides=""',
  );

const tmuxOn = (): Fixture =>
  // With allow-passthrough on, tmux writes the payload raw to the outer
  // terminal (input.c:2644-2697). The outer terminal's answers come back to
  // tmux, which parses them itself (tty-keys.c); no code passing them on to
  // the pane was found. So the pane sees only tmux's own answers, as with
  // passthrough off: the probe must not count on the passthrough queries.
  fixture(
    "tmux, passthrough on",
    tmuxEnv(),
    TMUX_REPLY,
    'colors=256 tc=0 sync=1 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=tmux linux=0 remote=0 answered=1 gfx=halfblock name="tmux 3.5a" overrides=""',
  );

const screen = (): Fixture => {
  // Debian screen 4.9.1, src/ansi.c (sources.debian.org/data/main/s/screen/4.9.1-3/ansi.c)
  // DA1 `Report("\033[?%d;%dc", 1, 2)` at 1329. No handler was found for the
  // other queries.
  const env: TermEnv = envOf("screen.xterm-256color", "", "");
  env.sty = "1234.pts-0.host";
  return fixture(
    "screen",
    env,
    "\x1b[?1;2c",
    'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=screen linux=0 remote=0 answered=1 gfx=halfblock name="" overrides=""',
  );
};

const mosh = (): Fixture =>
  // github.com/mobile-shell/mosh @decd9b7, src/terminal/terminalfunctions.cc
  // DA1 140-145. The file registers no handler for `>q`, DECRQM, `?u`, `t`,
  // `S`, DCS or APC. mosh runs over ssh to start, so SSH_CONNECTION is set.
  {
    const env: TermEnv = envOf("xterm-256color", "", "");
    env.sshConnection = "10.0.0.1 50000 10.0.0.2 22";
    return fixture(
      "mosh",
      env,
      "\x1b[?62c",
      'colors=256 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=1 answered=1 gfx=halfblock name="" overrides=""',
    );
  };

const linuxConsole = (): Fixture =>
  // github.com/torvalds/linux @5b0764a, drivers/tty/vt/vt.c
  // DA1 respond_ID 1882-1888, sent for `CSI c` at 2623-2624. No handler was
  // found for the other queries (`CSI q` is DECLL only, 2646).
  fixture(
    "Linux console",
    envOf("linux", "", ""),
    "\x1b[?6c",
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=1 remote=0 answered=1 gfx=ascii name="" overrides="TERM=linux: 16 colours, ascii, no kitty keyboard, no sync"',
  );

const silent = (): Fixture =>
  // A terminal, or a pipe, that answers nothing: the probe times out.
  fixture(
    "silent terminal",
    envOf("xterm", "", ""),
    "",
    'colors=16 tc=0 sync=0 kkb=0 kgfx=0 sixel=0/0 cell=0x0 pmouse=0 mux=none linux=0 remote=0 answered=0 gfx=halfblock name="" overrides=""',
  );

/** Every fixture. */
export const fixtures = (): Fixture[] => [
  kitty(),
  ghostty(),
  wezterm(),
  foot(),
  alacritty(),
  xterm(),
  iterm2(),
  appleTerminal(),
  windowsTerminal(),
  tmuxOff(),
  tmuxOn(),
  screen(),
  mosh(),
  linuxConsole(),
  silent(),
];
