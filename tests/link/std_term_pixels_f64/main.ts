// `nish/term-pixels` under `--number-mode f64` (see `args`): the module spells
// every width it uses, so a program whose untyped numbers are doubles fits,
// encodes and draws the same frames as the `i32` build in `std_term_pixels`.
// The values it passes are typed `i32` consts, because a bare literal is a
// `number` here.
import {
  Framebuffer,
  GRAPHICS_ASCII,
  GRAPHICS_HALFBLOCK,
  GRAPHICS_KITTY,
  GRAPHICS_SIXEL,
  PixelBytes,
  drawAscii,
  drawHalfBlocks,
  fitFramebuffer,
  kittyFrame,
  scaleFramebuffer,
  sixelFrame,
} from "nish/term-pixels";
import { Canvas, Screen } from "nish/term";
import { replaceAll } from "nish/text";

const W: i32 = 8;
const H: i32 = 6;
const ZERO: i32 = 0;
const TWO: i32 = 2;
const COLS: i32 = 10;
const ROWS: i32 = 4;
const CELL_W: i32 = 4;
const CELL_H: i32 = 8;
const ID: i32 = 9;
const STEP: i32 = 36;
const GREEN: i32 = 51;
const FULL: i32 = 255;
const COLORS: i32 = 16;

const shown = (s: string): string => replaceAll(s, "\x1b", "^[");

export const main = (): i32 => {
  const fb = new Framebuffer(W, H);
  for (let y: i32 = ZERO; y < H; y++) {
    for (let x: i32 = ZERO; x < W; x++) {
      fb.set(x, y, (((FULL - x * STEP) & FULL) << 16) | ((y * GREEN) << 8) | (x * STEP));
    }
  }
  const half = new Framebuffer(ZERO, ZERO);
  scaleFramebuffer(fb, TWO, half);
  console.log(`scaled ${half.width}x${half.height}, corner ${half.get(ZERO, ZERO)}`);

  const kr = fitFramebuffer(W, H, COLS, ROWS, CELL_W, CELL_H, GRAPHICS_KITTY);
  console.log(`kitty rect ${kr.col} ${kr.row} ${kr.cols} ${kr.rows} ${kr.width} ${kr.height} ${kr.scale}`);
  const out = new PixelBytes(ZERO);
  kittyFrame(fb, kr, ID, out);
  console.log(shown(out.text()));

  const sr = fitFramebuffer(W, H, COLS, ROWS, CELL_W, CELL_H, GRAPHICS_SIXEL);
  out.reset();
  sixelFrame(fb, sr, true, out);
  console.log(shown(out.text()));

  const s = new Screen(COLS, ROWS, true);
  drawHalfBlocks(fb, new Canvas(s), fitFramebuffer(W, H, COLS, ROWS, ZERO, ZERO, GRAPHICS_HALFBLOCK));
  console.log(shown(s.flush()));
  drawAscii(fb, s, fitFramebuffer(W, H, COLS, ROWS, ZERO, ZERO, GRAPHICS_ASCII), COLORS);
  console.log(shown(s.flush()));
  return 0;
};
