/**
 * `nish/cli` — a command-line tool's help menu: whether a stream gets colour,
 * the escapes that paint it, and the rows a `--help` is made of.
 *
 *     import { HelpMenu, agentDriven, styleFor } from "nish/cli";
 *
 *     const menu = new HelpMenu(styleFor(1, agentDriven()), "greet", 30, 40);
 *     menu.header("1.0.0", "say hello");
 *     menu.usage("<name> [flags]", "greet someone");
 *     menu.section("Flags");
 *     menu.row("--shout", "", "in capitals");
 *     menu.row("--times", "<n>", "say it n times");
 *     console.log(menu.text());
 *
 * **The terminal's own colours.** A `Style` paints with the sixteen SGR
 * colours (the eight basic ones and their bright twins), their backgrounds
 * and the attributes, never a fixed RGB or 256-palette tone unless the caller
 * asks for one through `sgr`. Every theme redefines those sixteen, so the
 * menu comes out in whatever palette the reader chose, and a terminal with no
 * theme set paints them in its built-in defaults. A terminal with no colours
 * at all (`tput colors` says fewer than eight) gets the failsafe: the same
 * structure in bold and underline, which a monochrome terminal still shows,
 * and no colour from a colour painter. Colour that is forced is the theme's.
 *
 * **Colour is for a person reading a terminal**, and nothing else may see it:
 * a script that captures `--help`, a test that compares it, a pipe into `less`
 * without `-R` all want the plain bytes. So `styleFor` decides per stream, by
 * asking whether that stream is a terminal, and the conventions people already
 * set win over the guess: `NO_COLOR` (https://no-color.org) turns it off, and
 * `CLICOLOR_FORCE` or `FORCE_COLOR` turns it on for a pager that understands
 * escapes. The plain text is the same bytes either way, and a row's padding is
 * counted on the plain text, so the columns line up with or without escapes.
 *
 * **An agent is a reader of its own kind**: it may drive a pseudo-terminal, so
 * the terminal check says yes, but every escape is tokens it pays for and
 * reads past. `agentDriven` says when one is at the keyboard, and `styleFor`
 * is then plain whatever forcing variable its shell inherited.
 *
 * **What it reaches.** `Style` and `HelpMenu` reach no capability. `styleFor`
 * reads the environment and, on the terminal check, forks a shell
 * (`env` and `process.spawn`),
 * and `agentDriven` reads the environment; a program that builds its `Style`
 * by hand reaches neither.
 *
 * **The compiler's own help is built with it**, through a relative import from
 * `src/cli-style.ts`, so this file is compiled by the last release as part of
 * the compiler: it may use only what that release compiles (the rolling
 * freeze, `.claude/selfhost.md`), which is why it asks the shell whether a
 * descriptor is a terminal rather than calling `nish:term`'s `isTerminal`.
 */

/** The Control Sequence Introducer every SGR escape opens with. */
const CSI: string = "\u001b["

/** `paletteOf`'s answer: marked up in the theme's colours. */
const PALETTE_THEME: i32 = 0

/** `paletteOf`'s answer: marked up in attributes only, the failsafe. */
const PALETTE_MONO: i32 = 2

/*
 * The SGR parameters `Style`'s painters use, exported so a caller composes a
 * list for `sgr` (`${SGR_BOLD};${SGR_RED}`) or a role (`flagThemed`) without
 * spelling the numbers. The first sixteen are the colours a theme redefines:
 * the eight basic ones and their bright twins.
 */
/** The SGR parameter for the theme's black as the text colour. */
export const SGR_BLACK: string = "30"
/** The SGR parameter for the theme's red as the text colour. */
export const SGR_RED: string = "31"
/** The SGR parameter for the theme's green as the text colour. */
export const SGR_GREEN: string = "32"
/** The SGR parameter for the theme's yellow as the text colour. */
export const SGR_YELLOW: string = "33"
/** The SGR parameter for the theme's blue as the text colour. */
export const SGR_BLUE: string = "34"
/** The SGR parameter for the theme's magenta as the text colour. */
export const SGR_MAGENTA: string = "35"
/** The SGR parameter for the theme's cyan as the text colour. */
export const SGR_CYAN: string = "36"
/** The SGR parameter for the theme's white as the text colour. */
export const SGR_WHITE: string = "37"
/** The SGR parameter for the theme's bright black (gray) as the text colour. */
export const SGR_BRIGHT_BLACK: string = "90"
/** The SGR parameter for the theme's bright red as the text colour. */
export const SGR_BRIGHT_RED: string = "91"
/** The SGR parameter for the theme's bright green as the text colour. */
export const SGR_BRIGHT_GREEN: string = "92"
/** The SGR parameter for the theme's bright yellow as the text colour. */
export const SGR_BRIGHT_YELLOW: string = "93"
/** The SGR parameter for the theme's bright blue as the text colour. */
export const SGR_BRIGHT_BLUE: string = "94"
/** The SGR parameter for the theme's bright magenta as the text colour. */
export const SGR_BRIGHT_MAGENTA: string = "95"
/** The SGR parameter for the theme's bright cyan as the text colour. */
export const SGR_BRIGHT_CYAN: string = "96"
/** The SGR parameter for the theme's bright white as the text colour. */
export const SGR_BRIGHT_WHITE: string = "97"
/** The SGR parameter for the theme's black as the background. */
export const SGR_BG_BLACK: string = "40"
/** The SGR parameter for the theme's red as the background. */
export const SGR_BG_RED: string = "41"
/** The SGR parameter for the theme's green as the background. */
export const SGR_BG_GREEN: string = "42"
/** The SGR parameter for the theme's yellow as the background. */
export const SGR_BG_YELLOW: string = "43"
/** The SGR parameter for the theme's blue as the background. */
export const SGR_BG_BLUE: string = "44"
/** The SGR parameter for the theme's magenta as the background. */
export const SGR_BG_MAGENTA: string = "45"
/** The SGR parameter for the theme's cyan as the background. */
export const SGR_BG_CYAN: string = "46"
/** The SGR parameter for the theme's white as the background. */
export const SGR_BG_WHITE: string = "47"
/** The SGR parameter for the theme's bright black as the background. */
export const SGR_BG_BRIGHT_BLACK: string = "100"
/** The SGR parameter for the theme's bright red as the background. */
export const SGR_BG_BRIGHT_RED: string = "101"
/** The SGR parameter for the theme's bright green as the background. */
export const SGR_BG_BRIGHT_GREEN: string = "102"
/** The SGR parameter for the theme's bright yellow as the background. */
export const SGR_BG_BRIGHT_YELLOW: string = "103"
/** The SGR parameter for the theme's bright blue as the background. */
export const SGR_BG_BRIGHT_BLUE: string = "104"
/** The SGR parameter for the theme's bright magenta as the background. */
export const SGR_BG_BRIGHT_MAGENTA: string = "105"
/** The SGR parameter for the theme's bright cyan as the background. */
export const SGR_BG_BRIGHT_CYAN: string = "106"
/** The SGR parameter for the theme's bright white as the background. */
export const SGR_BG_BRIGHT_WHITE: string = "107"
/** The SGR parameter for bold, or increased intensity. */
export const SGR_BOLD: string = "1"
/** The SGR parameter for faint, or decreased intensity. */
export const SGR_FAINT: string = "2"
/** The SGR parameter for italic, which some terminals do not show. */
export const SGR_ITALIC: string = "3"
/** The SGR parameter for underline. */
export const SGR_UNDERLINE: string = "4"
/** The SGR parameter for inverse: foreground and background swapped. */
export const SGR_INVERSE: string = "7"
/** The SGR parameter for struck through. */
export const SGR_STRIKETHROUGH: string = "9"

/**
 * How one output stream is painted. `on` says whether to mark the text up at
 * all, and `colour` whether the terminal has colours to mark it up with;
 * without them each mark falls back to bold, underline or nothing.
 *
 * Each help role (`heading`, `name`, `flag`, `meta`, `dim`) keeps a pair of
 * SGR lists, the theme's and the failsafe's, so a program recolours its menu
 * by setting a pair (`flagThemed`, `flagMono`) and `styleFor` still decides
 * whether, and which of the two, it paints. An empty list leaves the role
 * plain.
 */
export class Style {
  private on: boolean
  private colour: boolean
  /**
   * The SGR list `heading` paints a section heading with when the terminal
   * has colours: bold magenta (`"1;35"`) unless the program sets another.
   */
  headingThemed: string
  /**
   * The SGR list `heading` paints a section heading with on the failsafe,
   * where the terminal has no colours: bold (`SGR_BOLD`) unless set.
   */
  headingMono: string
  /**
   * The SGR list `name` paints the tool's own name with when the terminal has
   * colours: bold magenta (`"1;35"`) unless the program sets another.
   */
  nameThemed: string
  /**
   * The SGR list `name` paints the tool's own name with on the failsafe,
   * where the terminal has no colours: bold (`SGR_BOLD`) unless set.
   */
  nameMono: string
  /**
   * The SGR list `flag` paints a flag or command with when the terminal has
   * colours: cyan (`SGR_CYAN`) unless the program sets another.
   */
  flagThemed: string
  /**
   * The SGR list `flag` paints a flag or command with on the failsafe, where
   * the terminal has no colours: bold (`SGR_BOLD`) unless set.
   */
  flagMono: string
  /**
   * The SGR list `meta` paints a placeholder with when the terminal has
   * colours: yellow (`SGR_YELLOW`) unless the program sets another.
   */
  metaThemed: string
  /**
   * The SGR list `meta` paints a placeholder with on the failsafe, where the
   * terminal has no colours: underline (`SGR_UNDERLINE`) unless set.
   */
  metaMono: string
  /**
   * The SGR list `dim` paints descriptions and notes with when the terminal
   * has colours: faint (`SGR_FAINT`) unless the program sets another.
   */
  dimThemed: string
  /**
   * The SGR list `dim` paints descriptions and notes with on the failsafe,
   * where the terminal has no colours: empty, so plain, unless set.
   */
  dimMono: string

  /**
   * A style with every role at its default pair. `styleFor` builds the right
   * one for a stream; a program calls this to decide for itself.
   *
   * @param on whether to mark the text up at all; `false` makes every painter
   *   give its text back unchanged, whatever `colour` says.
   * @param colour whether the terminal has colours: `true` paints the roles'
   *   `…Themed` lists and lets the colour painters and `sgr` paint; `false`
   *   is the failsafe, which paints the `…Mono` lists and the attributes and
   *   leaves the colour painters and `sgr` plain.
   */
  constructor(on: boolean, colour: boolean) {
    this.on = on
    this.colour = colour
    // Bold magenta, spelled out: a template here would allocate per Style.
    this.headingThemed = "1;35"
    this.headingMono = SGR_BOLD
    this.nameThemed = "1;35"
    this.nameMono = SGR_BOLD
    this.flagThemed = SGR_CYAN
    this.flagMono = SGR_BOLD
    this.metaThemed = SGR_YELLOW
    this.metaMono = SGR_UNDERLINE
    // Faint rather than bright black, which Solarized makes the background;
    // plain without colour, where the bold flags already stand apart from it.
    this.dimThemed = SGR_FAINT
    this.dimMono = ""
  }

  /**
   * `text` wrapped in the escape for `themed` (an SGR parameter list in the
   * theme's basic colours) or `mono` (attributes only), and a reset after it;
   * `text` unchanged when marking up is off or the chosen list is empty, so a
   * caller never has to ask.
   */
  private paint(text: string, themed: string, mono: string): string {
    const code = this.colour ? themed : mono
    if (!this.on || text.length === 0 || code.length === 0) {
      return text
    }
    return `${CSI}${code}m${text}${CSI}0m`
  }

  /**
   * A section heading, in `headingThemed` or `headingMono`.
   *
   * @param text the words to paint, as they appear in the menu.
   * @returns `text` wrapped in the heading role's escape and a reset, or `text`
   *   unchanged when marking up is off, `text` is empty, or the list this
   *   style uses for the role is empty.
   */
  heading(text: string): string {
    return this.paint(text, this.headingThemed, this.headingMono)
  }

  /**
   * The tool's own name where it opens a line, in `nameThemed` or
   * `nameMono`.
   *
   * @param text the words to paint, as they appear in the menu.
   * @returns `text` wrapped in the name role's escape and a reset, or `text`
   *   unchanged when marking up is off, `text` is empty, or the list this
   *   style uses for the role is empty.
   */
  name(text: string): string {
    return this.paint(text, this.nameThemed, this.nameMono)
  }

  /**
   * A flag, or a command a person would type, in `flagThemed` or
   * `flagMono`.
   *
   * @param text the words to paint, as they appear in the menu.
   * @returns `text` wrapped in the flag role's escape and a reset, or `text`
   *   unchanged when marking up is off, `text` is empty, or the list this
   *   style uses for the role is empty.
   */
  flag(text: string): string {
    return this.paint(text, this.flagThemed, this.flagMono)
  }

  /**
   * A placeholder the person fills in, such as `<file.ts>` or `speed|size`, in
   * `metaThemed` or `metaMono`.
   *
   * @param text the words to paint, as they appear in the menu.
   * @returns `text` wrapped in the meta role's escape and a reset, or `text`
   *   unchanged when marking up is off, `text` is empty, or the list this
   *   style uses for the role is empty.
   */
  meta(text: string): string {
    return this.paint(text, this.metaThemed, this.metaMono)
  }

  /**
   * Text that explains rather than names, such as descriptions and notes, in
   * `dimThemed` or `dimMono`.
   *
   * @param text the words to paint, as they appear in the menu.
   * @returns `text` wrapped in the dim role's escape and a reset, or `text`
   *   unchanged when marking up is off, `text` is empty, or the list this
   *   style uses for the role is empty.
   */
  dim(text: string): string {
    return this.paint(text, this.dimThemed, this.dimMono)
  }

  /**
   * `text` painted with any SGR parameter list (`"1;31"`, `"38;5;208"`,
   * `"38;2;255;128;0"`) when colour is on, and unchanged otherwise: the way to
   * 256-colour and truecolor, which ignore the reader's theme, so they stay
   * the caller's explicit choice. The failsafe paints nothing, since the list
   * may name a colour a monochrome terminal cannot show.
   *
   * @param text the words to paint.
   * @param codes the SGR parameters, separated by `;`, without the CSI before
   *   them or the `m` after; an empty list leaves `text` plain.
   * @returns `text` wrapped in the escape for `codes` and a reset, or `text`
   *   unchanged when colour is off (the failsafe included), `text` is empty,
   *   or `codes` is.
   */
  sgr(text: string, codes: string): string {
    return this.paint(text, codes, "")
  }

  // The colour painters go through `sgr`, so the failsafe, which has no
  // colours to show, paints none of them; the attribute painters paint under
  // both.

  /**
   * `text` in the theme's black (`SGR_BLACK`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  black(text: string): string {
    return this.sgr(text, SGR_BLACK)
  }

  /**
   * `text` in the theme's red (`SGR_RED`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  red(text: string): string {
    return this.sgr(text, SGR_RED)
  }

  /**
   * `text` in the theme's green (`SGR_GREEN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  green(text: string): string {
    return this.sgr(text, SGR_GREEN)
  }

  /**
   * `text` in the theme's yellow (`SGR_YELLOW`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  yellow(text: string): string {
    return this.sgr(text, SGR_YELLOW)
  }

  /**
   * `text` in the theme's blue (`SGR_BLUE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  blue(text: string): string {
    return this.sgr(text, SGR_BLUE)
  }

  /**
   * `text` in the theme's magenta (`SGR_MAGENTA`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  magenta(text: string): string {
    return this.sgr(text, SGR_MAGENTA)
  }

  /**
   * `text` in the theme's cyan (`SGR_CYAN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  cyan(text: string): string {
    return this.sgr(text, SGR_CYAN)
  }

  /**
   * `text` in the theme's white (`SGR_WHITE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  white(text: string): string {
    return this.sgr(text, SGR_WHITE)
  }

  /**
   * `text` in the theme's bright black, a gray (`SGR_BRIGHT_BLACK`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightBlack(text: string): string {
    return this.sgr(text, SGR_BRIGHT_BLACK)
  }

  /**
   * `text` in the theme's bright red (`SGR_BRIGHT_RED`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightRed(text: string): string {
    return this.sgr(text, SGR_BRIGHT_RED)
  }

  /**
   * `text` in the theme's bright green (`SGR_BRIGHT_GREEN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightGreen(text: string): string {
    return this.sgr(text, SGR_BRIGHT_GREEN)
  }

  /**
   * `text` in the theme's bright yellow (`SGR_BRIGHT_YELLOW`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightYellow(text: string): string {
    return this.sgr(text, SGR_BRIGHT_YELLOW)
  }

  /**
   * `text` in the theme's bright blue (`SGR_BRIGHT_BLUE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightBlue(text: string): string {
    return this.sgr(text, SGR_BRIGHT_BLUE)
  }

  /**
   * `text` in the theme's bright magenta (`SGR_BRIGHT_MAGENTA`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightMagenta(text: string): string {
    return this.sgr(text, SGR_BRIGHT_MAGENTA)
  }

  /**
   * `text` in the theme's bright cyan (`SGR_BRIGHT_CYAN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightCyan(text: string): string {
    return this.sgr(text, SGR_BRIGHT_CYAN)
  }

  /**
   * `text` in the theme's bright white (`SGR_BRIGHT_WHITE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  brightWhite(text: string): string {
    return this.sgr(text, SGR_BRIGHT_WHITE)
  }

  /**
   * `text` on the theme's black (`SGR_BG_BLACK`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBlack(text: string): string {
    return this.sgr(text, SGR_BG_BLACK)
  }

  /**
   * `text` on the theme's red (`SGR_BG_RED`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgRed(text: string): string {
    return this.sgr(text, SGR_BG_RED)
  }

  /**
   * `text` on the theme's green (`SGR_BG_GREEN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgGreen(text: string): string {
    return this.sgr(text, SGR_BG_GREEN)
  }

  /**
   * `text` on the theme's yellow (`SGR_BG_YELLOW`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgYellow(text: string): string {
    return this.sgr(text, SGR_BG_YELLOW)
  }

  /**
   * `text` on the theme's blue (`SGR_BG_BLUE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBlue(text: string): string {
    return this.sgr(text, SGR_BG_BLUE)
  }

  /**
   * `text` on the theme's magenta (`SGR_BG_MAGENTA`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgMagenta(text: string): string {
    return this.sgr(text, SGR_BG_MAGENTA)
  }

  /**
   * `text` on the theme's cyan (`SGR_BG_CYAN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgCyan(text: string): string {
    return this.sgr(text, SGR_BG_CYAN)
  }

  /**
   * `text` on the theme's white (`SGR_BG_WHITE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgWhite(text: string): string {
    return this.sgr(text, SGR_BG_WHITE)
  }

  /**
   * `text` on the theme's bright black (`SGR_BG_BRIGHT_BLACK`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightBlack(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_BLACK)
  }

  /**
   * `text` on the theme's bright red (`SGR_BG_BRIGHT_RED`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightRed(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_RED)
  }

  /**
   * `text` on the theme's bright green (`SGR_BG_BRIGHT_GREEN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightGreen(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_GREEN)
  }

  /**
   * `text` on the theme's bright yellow (`SGR_BG_BRIGHT_YELLOW`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightYellow(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_YELLOW)
  }

  /**
   * `text` on the theme's bright blue (`SGR_BG_BRIGHT_BLUE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightBlue(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_BLUE)
  }

  /**
   * `text` on the theme's bright magenta (`SGR_BG_BRIGHT_MAGENTA`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightMagenta(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_MAGENTA)
  }

  /**
   * `text` on the theme's bright cyan (`SGR_BG_BRIGHT_CYAN`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightCyan(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_CYAN)
  }

  /**
   * `text` on the theme's bright white (`SGR_BG_BRIGHT_WHITE`).
   *
   * @param text the words to colour.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when colour is off (the failsafe included) or `text` is empty.
   */
  bgBrightWhite(text: string): string {
    return this.sgr(text, SGR_BG_BRIGHT_WHITE)
  }

  /**
   * `text` bold (`SGR_BOLD`), under the failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  bold(text: string): string {
    return this.paint(text, SGR_BOLD, SGR_BOLD)
  }

  /**
   * `text` faint (`SGR_FAINT`), under the failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  faint(text: string): string {
    return this.paint(text, SGR_FAINT, SGR_FAINT)
  }

  /**
   * `text` italic (`SGR_ITALIC`), where the terminal has it, under the
   * failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  italic(text: string): string {
    return this.paint(text, SGR_ITALIC, SGR_ITALIC)
  }

  /**
   * `text` underlined (`SGR_UNDERLINE`), under the failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  underline(text: string): string {
    return this.paint(text, SGR_UNDERLINE, SGR_UNDERLINE)
  }

  /**
   * `text` with foreground and background swapped (`SGR_INVERSE`), under
   * the failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  inverse(text: string): string {
    return this.paint(text, SGR_INVERSE, SGR_INVERSE)
  }

  /**
   * `text` struck through (`SGR_STRIKETHROUGH`), under the failsafe too.
   *
   * @param text the words to mark up.
   * @returns `text` wrapped in the escape and a reset, or `text` unchanged
   *   when marking up is off or `text` is empty.
   */
  strikethrough(text: string): string {
    return this.paint(text, SGR_STRIKETHROUGH, SGR_STRIKETHROUGH)
  }
}

/** Whether the environment variable `name` is set to something other than empty. */
const envIsSet = (name: string): boolean => {
  const value = getenv(name)
  return value !== null && value.length > 0
}

/** Whether `value` spells `word`, which is lower case, in any ASCII case. */
const spells = (value: string, word: string): boolean => {
  if (value.length !== word.length) {
    return false
  }
  // Both bounds, though the lengths match: the checker proves an index in range
  // only for a string its loop condition names.
  for (let i: i32 = 0; i < toI32(value.length) && i < toI32(word.length); i++) {
    let code: i32 = toI32(value.charCodeAt(i))
    if (code >= 65 && code <= 90) {
      code = code + 32
    }
    if (code !== toI32(word.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/** Whether `value` is a no: `0`, `false`, `no` or `off`, in any case. */
const isNo = (value: string): boolean =>
  value === "0" || spells(value, "false") || spells(value, "no") || spells(value, "off")

/** Whether a variable's `value` is set to a no (`isNo`). */
const saysNo = (value: string | null): boolean => value !== null && isNo(value)

/** Whether a variable's `value` is set and says yes: not empty, and not a no. */
const saysYes = (value: string | null): boolean => value !== null && value.length > 0 && !isNo(value)

/** Whether the variable `name` is set to a no (`saysNo`). */
const envSaysNo = (name: string): boolean => saysNo(getenv(name))

/** Whether the variable `name` says yes (`saysYes`). */
const envSaysYes = (name: string): boolean => saysYes(getenv(name))

/**
 * What terminal descriptor `fd` is: `PALETTE_THEME`, `PALETTE_MONO`, or
 * anything else for no terminal, which is plain text. The shell answers: a
 * child inherits the descriptors and the environment, `[ -t 1 ]` is POSIX,
 * and `tput colors` reads the count `TERM`'s terminfo entry declares (`-1` for
 * none). `tput` is run by absolute path, never looked up on `PATH`, so a
 * `PATH` with `.` in it cannot run a `tput` planted in the working directory
 * (`docs/security/cli.md`). When there is no `tput` there, or it does not know
 * `TERM`, the answer is the theme: almost every terminal has colours, and an
 * escape a monochrome one does not know it drops. It costs one fork of the
 * shell and, on a terminal, one of `tput`. Where nothing can be spawned (a
 * WebAssembly build) the answer is `-1`, which is plain text, the safe side.
 */
const paletteOf = (fd: i32): i32 => {
  const tty = `[ -t ${fd} ] || exit 1; `
  const find = "t=/usr/bin/tput; [ -x $t ] || t=/bin/tput; [ -x $t ] || exit 0; "
  const count = "c=$($t colors 2>/dev/null) || exit 0; case $c in ''|*[!0-9-]*) exit 0;; esac; "
  return toI32(spawnSync(["/bin/sh", "-c", `${tty}${find}${count}[ "$c" -ge 8 ] || exit ${PALETTE_MONO}`]))
}

/** The style for a `paletteOf` answer: the theme, the failsafe, or plain. */
const styleOfPalette = (palette: i32): Style => {
  if (palette === PALETTE_THEME) {
    return new Style(true, true)
  }
  return new Style(palette === PALETTE_MONO, false)
}

/**
 * Whether an agent, rather than a person, is running the program.
 * `NISH_AGENT` answers for any agent: a no (`envSaysNo`) for no, any other
 * value for yes. Without it, the variables the agents that set one put in
 * their commands' environment (Claude Code's `CLAUDECODE`, Gemini CLI's
 * `GEMINI_CLI`) say yes.
 *
 * @returns `true` when an agent is judged to be at the keyboard, the answer
 *   `styleFor`'s `agent` takes; it reads the environment afresh each call.
 */
export const agentDriven = (): boolean => {
  if (envIsSet("NISH_AGENT")) {
    return !envSaysNo("NISH_AGENT")
  }
  return envSaysYes("CLAUDECODE") || envSaysYes("GEMINI_CLI")
}

/**
 * The style for descriptor `fd` (1 or 2), for a reader `agent` says is an
 * agent or not (`agentDriven`, asked once by the caller). `NO_COLOR` wins,
 * then an agent, then `FORCE_COLOR` saying no (`isNo`; Node reads `0` and
 * `false` so), then a forcing variable, then `CLICOLOR` saying no or
 * `TERM=dumb`, and only then the terminal check, where the colours `TERM`
 * declares choose between the theme and the failsafe (`paletteOf`). Forced
 * colour is the theme's, asked of nothing: the reader is a pager or an editor
 * that renders the escapes itself (Emacs's shell sets `TERM=dumb` and paints
 * ANSI colour), so `TERM` does not describe it, and forcing forks nothing.
 *
 * @param fd the descriptor the painted text is written to, 1 for standard
 *   output or 2 for standard error; only the terminal check reads it.
 * @param agent whether the reader is an agent, as `agentDriven` answered;
 *   `true` gives plain text, whatever forces colour.
 * @returns a new `Style` each call, the caller's to keep and recolour: one
 *   that paints the theme, one that paints the failsafe, or one that paints
 *   nothing.
 */
export const styleFor = (fd: i32, agent: boolean): Style => {
  const level = getenv("FORCE_COLOR")
  if (envIsSet("NO_COLOR") || agent || saysNo(level)) {
    return new Style(false, false)
  }
  if (saysYes(level) || envSaysYes("CLICOLOR_FORCE")) {
    return new Style(true, true)
  }
  const term = getenv("TERM")
  if (envSaysNo("CLICOLOR") || (term !== null && term === "dumb")) {
    return new Style(false, false)
  }
  return styleOfPalette(paletteOf(fd))
}

/** A run of spaces to cut padding from, as wide as a terminal's usual 80 columns. */
const SPACE_RUN: string = "                                                                                "

/** `count` spaces, or none when `count` is not positive: a cut of `SPACE_RUN`, built only past its width. */
const spaces = (count: i32): string => {
  if (count <= 0) {
    return ""
  }
  if (count <= toI32(SPACE_RUN.length)) {
    return SPACE_RUN.substring(0, count)
  }
  const out: string[] = []
  for (let i: i32 = 0; i < count; i++) {
    out.push(" ")
  }
  return out.join("")
}

/**
 * The spaces that take plain text `width` columns wide to `column`, or two
 * when that would leave fewer, so a long flag still keeps apart from its text.
 */
const padTo = (width: i32, column: i32): string => spaces(width + 2 <= column ? column - width : 2)

/**
 * A help menu, built a line at a time and answered whole by `text`. Rows are
 * indented two columns and their descriptions start at `column`; usage lines'
 * descriptions start at `usageColumn`, past the longest command shape. Every
 * width is counted on the plain text, one column a byte, so the columns line
 * up whether or not `style` paints, as long as the text is ASCII.
 */
export class HelpMenu {
  private style: Style
  private program: string
  private column: i32
  private usageColumn: i32
  private lines: string[]
  private usages: i32

  /**
   * An empty menu; nothing is written until `text` is asked for.
   *
   * @param style the painter for every line the menu builds. The menu keeps
   *   this same `Style`, not a copy, so a role recoloured on it later paints
   *   the lines added after.
   * @param program the tool's name, which opens the title line and every
   *   usage line.
   * @param column how many plain columns come before a row's description,
   *   counted from the start of the line; a row whose flag and placeholder
   *   reach within two columns of it gets two spaces instead.
   * @param usageColumn the same for a usage line's description, counted from
   *   the start of `usage:`; set it past the longest command shape.
   */
  constructor(style: Style, program: string, column: i32, usageColumn: i32) {
    this.style = style
    this.program = program
    this.column = column
    this.usageColumn = usageColumn
    this.lines = []
    this.usages = 0
  }

  /**
   * The opening line, the program's name, `version` and a one-line `summary`,
   * and a blank after it.
   *
   * @param version the version shown after the name, faint, such as `1.0.0`.
   * @param summary what the tool is for, in a few words, faint, two spaces
   *   after the version.
   */
  header(version: string, summary: string): void {
    this.title(version, summary)
    this.lines.push("")
  }

  /**
   * The opening line alone, without `header`'s blank after it, for a menu that
   * puts something under its title (`line`) before the blank.
   *
   * @param version the version shown after the name, faint.
   * @param summary what the tool is for, faint, two spaces after the version.
   */
  title(version: string, summary: string): void {
    const style = this.style
    this.lines.push(`${style.name(this.program)} ${style.dim(version)}  ${style.dim(summary)}`)
  }

  /**
   * A line exactly as given, painted (or not) by the caller with the menu's
   * `style`: a rule, a banner, a blank. Its width is the caller's to keep.
   *
   * @param text the whole line, with any escapes already in it; `""` adds a
   *   blank line.
   */
  line(text: string): void {
    this.lines.push(text)
  }

  /**
   * A usage line: the command `shape` after the program's name, and what it
   * is for (`description` may be empty). The first opens with `usage:` and
   * the rest are indented under it.
   *
   * @param shape the arguments and flags that follow the program's name, such
   *   as `<file.ts> [flags]`, painted as a flag.
   * @param description what this form of the command does, faint, starting at
   *   `usageColumn`; `""` ends the line after `shape`.
   */
  usage(shape: string, description: string): void {
    const style = this.style
    const lead = this.usages === 0 ? `${style.heading("usage:")} ` : spaces(7)
    const width: i32 = 8 + toI32(this.program.length) + toI32(shape.length)
    const text = description.length > 0 ? `${padTo(width, this.usageColumn)}${style.dim(description)}` : ""
    this.lines.push(`${lead}${style.name(this.program)} ${style.flag(shape)}${text}`)
    this.usages = this.usages + 1
  }

  /**
   * A section: a blank line, then `title` as a heading.
   *
   * @param title the section's name, such as `Flags`, as it is shown.
   */
  section(title: string): void {
    this.lines.push("")
    this.lines.push(this.style.heading(title))
  }

  /**
   * One row: the `flag` (or a command), its placeholder `meta` (may be
   * empty), and what it does, the description starting at `column`.
   *
   * @param flag the flag or command a person types, painted as a flag after
   *   a two-space indent.
   * @param meta the placeholder for the flag's value, such as `<n>`, after
   *   one space; `""` for a flag that takes none.
   * @param description what the flag does, faint.
   */
  row(flag: string, meta: string, description: string): void {
    const style = this.style
    const width: i32 = 2 + toI32(flag.length) + (meta.length > 0 ? 1 + toI32(meta.length) : 0)
    const placeholder = meta.length > 0 ? ` ${style.meta(meta)}` : ""
    this.lines.push(
      `  ${style.flag(flag)}${placeholder}${padTo(width, this.column)}${style.dim(description)}`
    )
  }

  /**
   * An indented line of prose, faint.
   *
   * @param text the prose, shown after two spaces.
   */
  note(text: string): void {
    this.lines.push(`  ${this.style.dim(text)}`)
  }

  /**
   * An indented line the reader fills in or opens, a path or a value, as a
   * placeholder.
   *
   * @param text the path or value, shown after two spaces.
   */
  value(text: string): void {
    this.lines.push(`  ${this.style.meta(text)}`)
  }

  /**
   * The menu so far, its lines joined by newlines, with no newline after the
   * last.
   *
   * @returns a new string each call; the menu keeps its lines, so a later
   *   call also has what was added since.
   */
  text(): string {
    return this.lines.join("\n")
  }
}
