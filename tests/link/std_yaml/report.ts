// What a tool built on nish/yaml prints for a file with mistakes in it: one
// `line:col CODE message` line per diagnostic, through the line index, on a
// file with CR LF breaks and multi-byte characters before the mistakes.
import { parseYaml, yamlErrorName } from "../../../std/yaml";
import { YamlLineIndex } from "../../../std/yaml-lines";

/** Prints the diagnostics of a known-bad file as a linter would. */
export const ytReport = (): void => {
  const text = "title: \"café\"\r\ntags: [a,,b]\r\n😀é: *nope\nk: 1\nk: 2\n";
  const stream = parseYaml(text);
  const lines = new YamlLineIndex(text);
  let i: i32 = 0;
  while (i < stream.diagnosticCount()) {
    const at: i32 = stream.diagnosticStart(i);
    const where = `${lines.line(at)}:${lines.column(at)} (byte ${lines.byteColumn(at)})`;
    console.log(`report ${where} ${yamlErrorName(stream.diagnosticCode(i))} ${stream.diagnosticMessage(i)}`);
    i += 1;
  }
};
