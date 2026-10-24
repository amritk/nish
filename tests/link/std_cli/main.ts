// `nish/cli`'s help menu under each of its three styles: the theme's colours,
// the monochrome failsafe and plain text. Each style is made by hand, so the
// program reaches no capability and prints the same bytes on any terminal, and
// every escape is shown as `^[` so the expected output reads as text.
import { HelpMenu, Style } from "nish/cli"
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
  return 0
}
