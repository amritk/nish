// `parseYaml` and the stream's reads build under the no-panic default: only
// `parseYamlWith` keeps a panic site, for a `maxDepth` outside 1 to 1000, and
// `parseYaml` passes the default, so it never reaches it. A panic site any of
// these calls reaches again makes the compile fail.
import { parseYaml, pathNode, yamlErrorName } from "nish/yaml";

export const main = (): number => {
  const stream = parseYaml("name: nish\nlist: [1, 2]\nbad: [1,,2]\n");
  console.log(`documents ${stream.documentCount()}`);
  const name = pathNode(stream, stream.documentRoot(0), ["name"]);
  console.log(`name ${stream.text(name)}`);
  const list = pathNode(stream, stream.documentRoot(0), ["list"]);
  console.log(`list ${stream.count(list)}`);
  let d = 0;
  while (d < stream.diagnosticCount()) {
    console.log(`${yamlErrorName(stream.diagnosticCode(d))} at ${stream.diagnosticStart(d)}`);
    d += 1;
  }
  return 0;
};
