// `nish/cli`'s help menu under each of its three styles: the theme's colours,
// the monochrome failsafe and plain text. Each style is made by hand, so the
// program reaches no capability and prints the same bytes on any terminal, and
// every escape is shown as `^[` so the expected output reads as text. After the
// menus come every painter under each style, and a menu with every help role
// recoloured, whose defaults the menus above pin unchanged.
import { HelpMenu, SGR_BG_BLUE, SGR_BOLD, SGR_RED, Style } from "nish/cli"
import { replaceAll } from "nish/text"

const visible = (text: string): string => replaceAll(text, "\u001b", "^[")

const menu = (style: Style): string => {
  const m = new HelpMenu(style, "greet", 24, 30)
  m.header("1.2.0", "say hello")
  m.usage("<name> [flags]", "greet someone")
  m.usage("--version", "")
  m.section("Flags")
  m.row("--shout", "", "in capitals")
  m.row("--times", "<n>", "say it n times")
  m.row("--a-flag-past-the-column", "<x>", "two spaces")
  m.section("Notes")
  m.note("one line of prose")
  m.value("/etc/greet.conf")
  return m.text()
}

/** Every painter on one line per group, so a painter's escape, or its absence, is pinned. */
const painters = (label: string, s: Style): void => {
  console.log(`${label}:`)
  const fg = [
    s.black("k"),
    s.red("r"),
    s.green("g"),
    s.yellow("y"),
    s.blue("b"),
    s.magenta("m"),
    s.cyan("c"),
    s.white("w"),
  ]
  console.log(visible(`  fg ${fg.join(" ")}`))
  const bright = [
    s.brightBlack("k"),
    s.brightRed("r"),
    s.brightGreen("g"),
    s.brightYellow("y"),
    s.brightBlue("b"),
    s.brightMagenta("m"),
    s.brightCyan("c"),
    s.brightWhite("w"),
  ]
  console.log(visible(`  bright ${bright.join(" ")}`))
  const bg = [
    s.bgBlack("k"),
    s.bgRed("r"),
    s.bgGreen("g"),
    s.bgYellow("y"),
    s.bgBlue("b"),
    s.bgMagenta("m"),
    s.bgCyan("c"),
    s.bgWhite("w"),
  ]
  console.log(visible(`  bg ${bg.join(" ")}`))
  const bgBright = [
    s.bgBrightBlack("k"),
    s.bgBrightRed("r"),
    s.bgBrightGreen("g"),
    s.bgBrightYellow("y"),
    s.bgBrightBlue("b"),
    s.bgBrightMagenta("m"),
    s.bgBrightCyan("c"),
    s.bgBrightWhite("w"),
  ]
  console.log(visible(`  bgBright ${bgBright.join(" ")}`))
  const attrs = [s.bold("b"), s.faint("f"), s.italic("i"), s.underline("u"), s.inverse("v"), s.strikethrough("s")]
  console.log(visible(`  attrs ${attrs.join(" ")}`))
  console.log(visible(`  sgr ${s.sgr("x", `${SGR_BOLD};${SGR_RED}`)} ${s.sgr("o", "38;5;208")} ${s.sgr("t", "38;2;255;128;0")}`))
  console.log(visible(`  nested ${s.bold(s.red("a"))} ${s.bgBlue(s.white("b"))} ${s.sgr("c", SGR_BG_BLUE)}`))
  console.log(visible(`  empty [${s.red("")}][${s.bold("")}][${s.sgr("", "1")}]`))
}

/** A style with every help role recoloured, for both the theme and the failsafe. */
const recoloured = (on: boolean, colour: boolean): Style => {
  const s = new Style(on, colour)
  s.headingThemed = "1;34"
  s.headingMono = "1;4"
  s.nameThemed = "32"
  s.nameMono = "7"
  s.flagThemed = "1;33"
  s.flagMono = ""
  s.metaThemed = "35"
  s.metaMono = "3"
  s.dimThemed = ""
  s.dimMono = "2"
  return s
}

export const main = (): i32 => {
  console.log("theme:")
  console.log(visible(menu(new Style(true, true))))
  console.log("mono:")
  console.log(visible(menu(new Style(true, false))))
  console.log("plain:")
  console.log(menu(new Style(false, true)))
  const off = new Style(false, false)
  console.log(`off paints nothing: ${off.heading("x") === "x" && off.dim("y") === "y"}`)
  const mono = new Style(true, false)
  console.log(`mono dim is plain: ${mono.dim("z") === "z"}`)
  const theme = new Style(true, true)
  const ruled = new HelpMenu(theme, "greet", 24, 30)
  ruled.title("1.2.0", "say hello")
  ruled.line(theme.dim("-----------------------"))
  ruled.line("")
  ruled.usage("<name>", "greet someone")
  console.log(visible(ruled.text()))
  painters("theme painters", new Style(true, true))
  painters("mono painters", new Style(true, false))
  painters("off painters", new Style(false, true))
  console.log("recoloured theme:")
  console.log(visible(menu(recoloured(true, true))))
  console.log("recoloured mono:")
  console.log(visible(menu(recoloured(true, false))))
  console.log(`recoloured off is plain: ${menu(recoloured(false, true)) === menu(new Style(false, false))}`)
  return 0
}
