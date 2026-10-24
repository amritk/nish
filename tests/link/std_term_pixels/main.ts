// `nish/term-pixels`: the framebuffer, the letterbox fit, and the bytes of each
// backend. Small frames are checked against the escape codes written out by
// hand from the kitty graphics protocol and DEC's Sixel format; larger ones are
// printed whole (ESC shown as `^[`) so the golden pins every byte.
import { base64Encode } from "nish/base64"
import {
  Framebuffer,
  GRAPHICS_ASCII,
  GRAPHICS_HALFBLOCK,
  GRAPHICS_KITTY,
  GRAPHICS_SIXEL,
  KITTY_TRANSFER_DIRECT,
  PixelBytes,
  PixelRect,
  SIXEL_REGISTERS,
  drawAscii,
  drawHalfBlocks,
  fitFramebuffer,
  kittyFrame,
  scaleFramebuffer,
  sixelFrame,
} from "nish/term-pixels"
import { Canvas, Screen } from "nish/term"
import { Suite } from "nish/testing"
import { replaceAll } from "nish/text"

const RED: i32 = 0xff0000
const GREEN: i32 = 0x00ff00
const BLACK: i32 = 0

/** `s` with each ESC spelled `^[`. */
const shown = (s: string): string => replaceAll(s, "\x1b", "^[")

/** A framebuffer of `w × h` whose pixels are `colours`, row by row. */
const frameOf = (w: i32, h: i32, colours: i32[]): Framebuffer => {
  const fb = new Framebuffer(w, h)
  for (let i: i32 = 0; i < w * h; i++) {
    fb.pixels[i] = colours[i]
  }
  return fb
}

/** A rect drawing `fb` at its own size from the top-left cell. */
const ownSize = (fb: Framebuffer): PixelRect => new PixelRect(0, 0, 1, 1, fb.width, fb.height, 1.0)

/** The 8×6 test card: a red-to-blue gradient across, a green ramp down. */
const card = (): Framebuffer => {
  const fb = new Framebuffer(8, 6)
  for (let y: i32 = 0; y < 6; y++) {
    for (let x: i32 = 0; x < 8; x++) {
      fb.set(x, y, (((255 - x * 36) & 255) << 16) | ((y * 51) << 8) | (x * 36))
    }
  }
  return fb
}

const rectText = (r: PixelRect): string =>
  `col=${r.col} row=${r.row} cols=${r.cols} rows=${r.rows} w=${r.width} h=${r.height} scale=${r.scale}`

/** The kitty frame of `fb` over `rect`, as text. */
const kitty = (fb: Framebuffer, rect: PixelRect, id: i32): string => {
  const out = new PixelBytes(0)
  kittyFrame(fb, rect, id, out)
  return out.text()
}

/** The Sixel frame of `fb` at its own size, as text. */
const sixel = (fb: Framebuffer, dither: boolean): string => {
  const out = new PixelBytes(64)
  sixelFrame(fb, ownSize(fb), dither, out)
  return out.text()
}

/** The Sixel frame of `fb` over `rect`, undithered, as text. */
const sixelIn = (fb: Framebuffer, rect: PixelRect): string => {
  const out = new PixelBytes(0)
  sixelFrame(fb, rect, false, out)
  return out.text()
}

/** `values` joined with commas. */
const listed = (values: i32[]): string => {
  const parts: string[] = []
  for (const v of values) {
    parts.push(`${v}`)
  }
  return parts.join(",")
}

/** The RGB bytes of `fb`'s pixels `[from, to)`. */
const rgbBytes = (fb: Framebuffer, from: i32, to: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = from; i < to; i++) {
    const c: i32 = fb.pixels[i]
    out.push(toU8((c >> 16) & 255))
    out.push(toU8((c >> 8) & 255))
    out.push(toU8(c & 255))
  }
  return out
}

/** How many times `part` occurs in `s`. */
const count = (s: string, part: string): i32 => {
  let n: i32 = 0
  let at: i32 = s.indexOf(part)
  while (at >= 0) {
    n = n + 1
    at = s.indexOf(part, at + toI32(part.length))
  }
  return n
}

export const main = (): number => {
  const t = new Suite("term-pixels")

  // --- the backends, worst to best ------------------------------------------------
  t.eqI32("ascii < halfblock", GRAPHICS_ASCII < GRAPHICS_HALFBLOCK ? 1 : 0, 1)
  t.eqI32("halfblock < sixel", GRAPHICS_HALFBLOCK < GRAPHICS_SIXEL ? 1 : 0, 1)
  t.eqI32("sixel < kitty", GRAPHICS_SIXEL < GRAPHICS_KITTY ? 1 : 0, 1)
  t.eqI32("a capability capped", Math.min(GRAPHICS_KITTY, GRAPHICS_HALFBLOCK), GRAPHICS_HALFBLOCK)
  t.eqI32("the direct transfer", KITTY_TRANSFER_DIRECT, 0)
  t.eqI32("the palette's registers", SIXEL_REGISTERS, 6 * 7 * 6)

  // --- Framebuffer ------------------------------------------------------------------
  const fb = new Framebuffer(3, 2)
  t.eqI32("made black", fb.get(2, 1), 0)
  fb.set(1, 1, 0x12345678)
  t.eqI32("set keeps the low 24 bits", fb.get(1, 1), 0x345678)
  t.eqI32("set writes y * width + x", fb.pixels[4], 0x345678)
  fb.set(-1, 0, RED)
  fb.set(0, -1, RED)
  fb.set(3, 0, RED)
  fb.set(0, 2, RED)
  t.eqI32("set off the buffer draws nothing", listed(fb.pixels).indexOf(`${RED}`) < 0 ? 0 : 1, 0)
  t.eqI32("get left of the buffer", fb.get(-1, 1), 0)
  t.eqI32("get above the buffer", fb.get(1, -1), 0)
  t.eqI32("get right of the buffer", fb.get(3, 1), 0)
  t.eqI32("get below the buffer", fb.get(1, 2), 0)
  fb.fill(0x7f00ff00)
  t.eqI32("fill keeps the low 24 bits", fb.get(0, 0), GREEN)
  t.eqI32("fill reaches the last pixel", fb.get(2, 1), GREEN)
  fb.clear()
  t.eqI32("clear", fb.get(2, 1) + fb.get(0, 0), 0)
  fb.fill(RED)
  fb.resize(3, 2)
  t.eqI32("resize to the same size blackens", fb.get(1, 1), 0)
  fb.resize(4, 5)
  t.eqStr("resize to a new size", `${fb.width}x${fb.height}:${fb.pixels.length}`, "4x5:20")
  fb.resize(0, 0)
  t.eqI32("resize to empty", toI32(fb.pixels.length), 0)

  // --- scaleFramebuffer -------------------------------------------------------------
  const big = new Framebuffer(5, 3)
  for (let i: i32 = 0; i < 15; i++) {
    big.pixels[i] = i + 1
  }
  const small = new Framebuffer(0, 0)
  scaleFramebuffer(big, 2, small)
  t.eqStr("halved: rounded up, top-left of each block", `${small.width}x${small.height}:${listed(small.pixels)}`, "3x2:1,3,5,11,13,15")
  scaleFramebuffer(big, 4, small)
  t.eqStr("quartered", `${small.width}x${small.height}:${listed(small.pixels)}`, "2x1:1,5")
  scaleFramebuffer(big, 1, small)
  t.eqStr("divisor 1 copies", listed(small.pixels), listed(big.pixels))
  scaleFramebuffer(big, 2147483647, small)
  t.eqStr("the largest divisor keeps one pixel", `${small.width}x${small.height}:${listed(small.pixels)}`, "1x1:1")
  scaleFramebuffer(new Framebuffer(0, 4), 2, small)
  t.eqStr("an empty source scales to empty", `${small.width}x${small.height}`, "0x2")

  // --- fitFramebuffer ---------------------------------------------------------------
  // 480×270 on 200×60 cells of 8×16: 1600×960 pixels, so the width binds and the
  // height is 270 × 1600 / 480 = 900, 56.25 rows rounded up to 57, centred.
  t.eqStr("kitty, wide", rectText(fitFramebuffer(480, 270, 200, 60, 8, 16, GRAPHICS_KITTY)), "col=0 row=1 cols=200 rows=57 w=1600 h=900 scale=3.3333333333333335")
  t.eqStr("sixel is measured like kitty", rectText(fitFramebuffer(480, 270, 200, 60, 8, 16, GRAPHICS_SIXEL)), "col=0 row=1 cols=200 rows=57 w=1600 h=900 scale=3.3333333333333335")
  // 100×400 on 80×24 cells of 10×20: 800×480, so the height binds and the width
  // is 100 × 480 / 400 = 120, twelve columns centred at (80 - 12) / 2.
  t.eqStr("kitty, tall", rectText(fitFramebuffer(100, 400, 80, 24, 10, 20, GRAPHICS_KITTY)), "col=34 row=0 cols=12 rows=24 w=120 h=480 scale=1.2")
  t.eqStr("cell width unknown: 8×16", rectText(fitFramebuffer(480, 270, 200, 60, 0, 20, GRAPHICS_KITTY)), "col=0 row=1 cols=200 rows=57 w=1600 h=900 scale=3.3333333333333335")
  t.eqStr("cell height unknown: 8×16", rectText(fitFramebuffer(480, 270, 200, 60, 9, -1, GRAPHICS_SIXEL)), "col=0 row=1 cols=200 rows=57 w=1600 h=900 scale=3.3333333333333335")
  // Half blocks: 200×120 half-cells; 270 × 200 / 480 = 112.5 rows of pixels.
  t.eqStr("half blocks ignore the cell size", rectText(fitFramebuffer(480, 270, 200, 60, 8, 16, GRAPHICS_HALFBLOCK)), "col=0 row=2 cols=200 rows=56 w=200 h=112 scale=0.4166666666666667")
  // ASCII: 8×6 on 10×10 cells is 10×7 half-cells, four rows; the size is in cells.
  t.eqStr("ascii answers cells", rectText(fitFramebuffer(8, 6, 10, 10, 8, 16, GRAPHICS_ASCII)), "col=0 row=3 cols=10 rows=4 w=10 h=4 scale=1.25")
  t.eqStr("a sliver is at least one pixel", rectText(fitFramebuffer(1000, 1, 2, 2, 0, 0, GRAPHICS_HALFBLOCK)), "col=0 row=0 cols=2 rows=1 w=2 h=1 scale=0.002")
  t.eqStr("a needle is at least one pixel", rectText(fitFramebuffer(1, 1000, 2, 2, 0, 0, GRAPHICS_HALFBLOCK)), "col=0 row=0 cols=1 rows=2 w=1 h=4 scale=1")
  t.eqStr("empty framebuffer", rectText(fitFramebuffer(0, 5, 10, 10, 8, 16, GRAPHICS_KITTY)), "col=0 row=0 cols=0 rows=0 w=0 h=0 scale=0")
  t.eqStr("empty height", rectText(fitFramebuffer(5, 0, 10, 10, 8, 16, GRAPHICS_KITTY)), "col=0 row=0 cols=0 rows=0 w=0 h=0 scale=0")
  t.eqStr("no columns", rectText(fitFramebuffer(5, 5, 0, 10, 8, 16, GRAPHICS_KITTY)), "col=0 row=0 cols=0 rows=0 w=0 h=0 scale=0")
  t.eqStr("no rows", rectText(fitFramebuffer(5, 5, 10, -3, 8, 16, GRAPHICS_KITTY)), "col=0 row=0 cols=0 rows=0 w=0 h=0 scale=0")

  // --- PixelBytes -------------------------------------------------------------------
  const bytes = new PixelBytes(0)
  t.eqI32("a capacity of at least 16", toI32(bytes.bytes.length), 16)
  for (let i: i32 = 0; i < 40; i++) {
    bytes.put(65 + (i % 26))
  }
  t.eqI32("grows by doubling", toI32(bytes.bytes.length), 64)
  t.eqStr("keeps what it grew past", bytes.text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN")
  bytes.reset()
  bytes.putDecimal(0)
  bytes.put(32)
  bytes.putDecimal(2147483647)
  bytes.putText(" ok")
  t.eqStr("reset, decimals and text", bytes.text(), "0 2147483647 ok")
  bytes.reserve(1000)
  t.eqI32("reserve doubles past the need", toI32(bytes.bytes.length), 1024)
  t.eqStr("reserve keeps the bytes", bytes.text(), "0 2147483647 ok")

  // --- kitty ------------------------------------------------------------------------
  // Red then green is ff 00 00 00 ff 00, which RFC 4648 encodes as /wAAAP8A.
  const pair = frameOf(2, 1, [RED, GREEN])
  const pairRect = new PixelRect(3, 4, 5, 1, 40, 8, 20.0)
  const first: string = kitty(pair, pairRect, 7)
  t.eqStr(
    "kitty: one frame",
    first,
    "\x1b[5;4H\x1b_Ga=d,d=I,i=7,q=2\x1b\\\x1b_Ga=T,f=24,t=d,i=7,s=2,v=1,c=5,r=1,C=1,q=2,m=0;/wAAAP8A\x1b\\"
  )
  t.eqStr("kitty: the next frame reuses the id and deletes the last", kitty(pair, pairRect, 7), first)
  t.eqStr("kitty: an empty framebuffer only deletes", kitty(new Framebuffer(0, 3), pairRect, 1), "\x1b[5;4H\x1b_Ga=d,d=I,i=1,q=2\x1b\\")
  t.eqStr("kitty: no columns only deletes", kitty(pair, new PixelRect(0, 0, 0, 1, 0, 8, 0.0), 2), "\x1b[1;1H\x1b_Ga=d,d=I,i=2,q=2\x1b\\")
  t.eqStr("kitty: no rows only deletes", kitty(pair, new PixelRect(0, 0, 1, 0, 8, 0, 0.0), 2), "\x1b[1;1H\x1b_Ga=d,d=I,i=2,q=2\x1b\\")
  // 1024 pixels are 3072 bytes, exactly one chunk.
  const exact = card()
  exact.resize(32, 32)
  for (let i: i32 = 0; i < 1024; i++) {
    exact.pixels[i] = i * 4099
  }
  t.eqStr(
    "kitty: 3072 bytes are one chunk",
    kitty(exact, pairRect, 1),
    "\x1b[5;4H\x1b_Ga=d,d=I,i=1,q=2\x1b\\\x1b_Ga=T,f=24,t=d,i=1,s=32,v=32,c=5,r=1,C=1,q=2,m=0;" +
      base64Encode(rgbBytes(exact, 0, 1024)) +
      "\x1b\\"
  )
  // 2100 pixels are 6300 bytes: 3072, 3072 and 156, the keys on the first only.
  const long = new Framebuffer(70, 30)
  for (let i: i32 = 0; i < 2100; i++) {
    long.pixels[i] = (i * 7919) & 0xffffff
  }
  t.eqStr(
    "kitty: three chunks",
    kitty(long, pairRect, 12),
    "\x1b[5;4H\x1b_Ga=d,d=I,i=12,q=2\x1b\\\x1b_Ga=T,f=24,t=d,i=12,s=70,v=30,c=5,r=1,C=1,q=2,m=1;" +
      base64Encode(rgbBytes(long, 0, 1024)) +
      "\x1b\\\x1b_Gm=1;" +
      base64Encode(rgbBytes(long, 1024, 2048)) +
      "\x1b\\\x1b_Gm=0;" +
      base64Encode(rgbBytes(long, 2048, 2100)) +
      "\x1b\\"
  )

  // --- Sixel ------------------------------------------------------------------------
  // Green is register 0×42 + 6×6 + 0 = 36, red 5×42 = 210; each band column is
  // `?` plus its six bits, top pixel lowest.
  t.eqStr(
    "sixel: two colours",
    sixel(pair, false),
    "\x1b[1;1H\x1bPq\"1;1;2;1#36;2;0;100;0#210;2;100;0;0#36?@$#210@\x1b\\"
  )
  t.eqStr(
    "sixel: runs of four or more are !n",
    sixel(frameOf(6, 1, [BLACK, BLACK, BLACK, BLACK, BLACK, RED]), false),
    "\x1b[1;1H\x1bPq\"1;1;6;1#0;2;0;0;0#210;2;100;0;0#0!5@$#210!5?@\x1b\\"
  )
  t.eqStr(
    "sixel: a colour's span grows both ways within a band",
    sixel(frameOf(3, 2, [BLACK, RED, BLACK, RED, BLACK, RED]), false),
    "\x1b[1;1H\x1bPq\"1;1;3;2#0;2;0;0;0#210;2;100;0;0#0@A@$#210A@A\x1b\\"
  )
  const tall = new Framebuffer(1, 7)
  tall.fill(RED)
  t.eqStr("sixel: a second band after -", sixel(tall, false), "\x1b[1;1H\x1bPq\"1;1;1;7#210;2;100;0;0#210~-#210@\x1b\\")
  t.eqStr(
    "sixel: drawn at the rect's cell, scaled to its pixels",
    sixelIn(pair, new PixelRect(2, 1, 1, 1, 4, 1, 2.0)),
    "\x1b[2;3H\x1bPq\"1;1;4;1#36;2;0;100;0#210;2;100;0;0#36??@@$#210@@\x1b\\"
  )
  const black = new Framebuffer(4, 4)
  t.eqI32("sixel: dithered black stays one register", count(sixel(black, true), ";2;"), 1)
  const mid = new Framebuffer(4, 4)
  mid.fill(0x800000)
  t.eqI32("sixel: a red between levels dithers to two", count(sixel(mid, true), ";2;"), 2)
  t.eqI32("sixel: and undithered is one", count(sixel(mid, false), ";2;"), 1)
  t.eqStr("sixel: an empty rect writes nothing", sixelIn(pair, new PixelRect(0, 0, 0, 0, 0, 0, 0.0)), "")
  t.eqStr("sixel: an empty framebuffer writes nothing", sixel(new Framebuffer(0, 0), false), "")
  console.log(`sixel card: ${shown(sixel(card(), false))}`)
  console.log(`sixel card dithered: ${shown(sixel(card(), true))}`)

  // --- half blocks --------------------------------------------------------------------
  const screen = new Screen(4, 2, false)
  const canvas = new Canvas(screen)
  const quad = frameOf(2, 2, [RED, GREEN, 0x0000ff, 0xffffff])
  drawHalfBlocks(quad, canvas, fitFramebuffer(2, 2, 4, 2, 0, 0, GRAPHICS_HALFBLOCK))
  console.log(`halfblock 2x2 on 4x2: ${shown(screen.flush())}`)
  drawHalfBlocks(quad, canvas, fitFramebuffer(2, 2, 4, 2, 0, 0, GRAPHICS_HALFBLOCK))
  t.eqStr("halfblock: an unchanged frame flushes nothing new", shown(screen.flush()), "")
  // A one-pixel-tall image's rect row has a lower half the image does not reach.
  const strip = frameOf(4, 1, [RED, RED, GREEN, GREEN])
  canvas.clear(0x0000ff)
  drawHalfBlocks(strip, canvas, fitFramebuffer(4, 1, 4, 2, 0, 0, GRAPHICS_HALFBLOCK))
  t.eqI32("halfblock: the image's pixel", canvas.pixel(2, 0), GREEN)
  t.eqI32("halfblock: the half it does not reach", canvas.pixel(2, 1), -1)
  t.eqI32("halfblock: the row below the rect is left", canvas.pixel(2, 2), 0x0000ff)
  console.log(`halfblock strip: ${shown(screen.flush())}`)
  // A rect that hangs off every edge is clipped to the canvas.
  canvas.clear(0)
  drawHalfBlocks(strip, canvas, new PixelRect(2, 1, 4, 2, 4, 4, 1.0))
  t.eqI32("halfblock: clipped right", canvas.pixel(3, 2), RED)
  t.eqI32("halfblock: clipped below", canvas.pixel(3, 3), RED)
  drawHalfBlocks(strip, canvas, new PixelRect(-2, -1, 4, 2, 4, 4, 1.0))
  t.eqI32("halfblock: clipped left and above", canvas.pixel(0, 0), GREEN)
  t.eqI32("halfblock: the middle is untouched", canvas.pixel(2, 1), 0)
  console.log(`halfblock clipped: ${shown(screen.flush())}`)
  drawHalfBlocks(strip, canvas, new PixelRect(0, 0, 0, 0, 0, 0, 0.0))
  drawHalfBlocks(new Framebuffer(0, 1), canvas, new PixelRect(0, 0, 4, 2, 4, 4, 1.0))
  t.eqStr("halfblock: an empty rect or framebuffer draws nothing", shown(screen.flush()), "")

  // --- ASCII --------------------------------------------------------------------------
  // Black, grey and white are luma 0, 128 and 255: ` `, `+` and `@` of the ramp.
  const greys = frameOf(3, 1, [0, 0x808080, 0xffffff])
  const text = new Screen(3, 1, false)
  drawAscii(greys, text, fitFramebuffer(3, 1, 3, 1, 0, 0, GRAPHICS_ASCII), 256)
  t.eqStr("ascii: the ramp", `${String.fromCharCode(text.glyphAt(0, 0))}${String.fromCharCode(text.glyphAt(1, 0))}${String.fromCharCode(text.glyphAt(2, 0))}`, " +@")
  console.log(`ascii in colour: ${shown(text.flush())}`)
  // In 16 colours grey 0x808080 is nearest xterm's 8 (7f7f7f), white its 15.
  drawAscii(greys, text, fitFramebuffer(3, 1, 3, 1, 0, 0, GRAPHICS_ASCII), 16)
  console.log(`ascii in 16 colours: ${shown(text.flush())}`)
  const cardText = new Screen(10, 10, true)
  drawAscii(card(), cardText, fitFramebuffer(8, 6, 10, 10, 0, 0, GRAPHICS_ASCII), 256)
  console.log(`ascii card: ${shown(cardText.flush())}`)
  drawAscii(card(), cardText, new PixelRect(0, 0, 0, 0, 0, 0, 0.0), 16)
  drawAscii(new Framebuffer(0, 0), cardText, new PixelRect(0, 0, 3, 1, 3, 1, 1.0), 16)
  t.eqStr("ascii: an empty rect or framebuffer draws nothing", shown(cardText.flush()), "")

  return t.done()
}
