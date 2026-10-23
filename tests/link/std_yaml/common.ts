// Helpers the std/yaml checks share: a document read back as flow text, a
// scalar as its type and text, and a stream's diagnostics either as the
// `line:col kind CODE message` lines a person reads or as codes with ranges.
import { YamlOptions, YamlStream, keyText, parseYaml, parseYamlWith, yamlErrorName } from "../../../std/yaml";
import { YamlLineIndex } from "../../../std/yaml-lines";

/** Document `d` of `stream` as flow text, or `<none>` when it has no root. */
export const ytDoc = (stream: YamlStream, d: i32): string => {
  const root: i32 = stream.documentRoot(d);
  return root < 0 ? "<none>" : keyText(stream, root);
};

/** The first document of `text` as flow text. */
export const ytFlow = (text: string): string => ytDoc(parseYaml(text), 0);

/** `text` on one line, its breaks and tabs written `\n`, `\r` and `\t`, to name a check by. */
export const ytShow = (text: string): string => {
  const out: string[] = [];
  let i: i32 = 0;
  while (i < toI32(text.length)) {
    const c: i32 = text.charCodeAt(i);
    if (c === 10) {
      out.push("\\n");
    } else if (c === 13) {
      out.push("\\r");
    } else if (c === 9) {
      out.push("\\t");
    } else {
      out.push(text.substring(i, i + 1));
    }
    i += 1;
  }
  return out.join("");
};

/** The name of scalar type `type`. */
const ytTypeName = (type: i32): string => {
  const names: string[] = ["null", "bool", "int", "float", "string"];
  return type >= 0 && type < toI32(names.length) ? names[type] : "?";
};

/** The root of `text` as `type <text>`: how a scalar resolves and what it decodes to. */
export const ytScalar = (text: string): string => {
  const stream = parseYaml(text);
  const root: i32 = stream.documentRoot(0);
  return root < 0 ? "<none>" : `${ytTypeName(stream.type(root))} <${stream.text(root)}>`;
};

/** Every diagnostic of `stream` as `line:col kind CODE message`, one per line. */
export const ytDiagnostics = (stream: YamlStream): string => {
  const lines = new YamlLineIndex(stream.source);
  const out: string[] = [];
  let i: i32 = 0;
  while (i < stream.diagnosticCount()) {
    const at: i32 = stream.diagnosticStart(i);
    const kind = stream.diagnosticIsWarning(i) ? "warning" : "error";
    out.push(`${lines.line(at)}:${lines.column(at)} ${kind} ${yamlErrorName(stream.diagnosticCode(i))} ${stream.diagnosticMessage(i)}\n`);
    i += 1;
  }
  return out.join("");
};

/** The diagnostics of `text` parsed with the default options. */
export const ytDiagnosticsOf = (text: string): string => ytDiagnostics(parseYaml(text));

/**
 * Every diagnostic of `text` as `CODE@start..end`, joined by spaces, with `~`
 * before a warning: the codes, their kinds and their exact ranges.
 */
export const ytRanges = (text: string, options: YamlOptions): string => {
  const stream = parseYamlWith(text, options);
  const out: string[] = [];
  let i: i32 = 0;
  while (i < stream.diagnosticCount()) {
    const warn = stream.diagnosticIsWarning(i) ? "~" : "";
    out.push(`${warn}${yamlErrorName(stream.diagnosticCode(i))}@${stream.diagnosticStart(i)}..${stream.diagnosticEnd(i)}`);
    i += 1;
  }
  return out.join(" ");
};

/** `ytRanges` with the default options. */
export const ytRangesOf = (text: string): string => ytRanges(text, new YamlOptions());
