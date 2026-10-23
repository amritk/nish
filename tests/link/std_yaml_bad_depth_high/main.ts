// A maxDepth past 1000 panics before the text is read: the limit is part of
// the options, so a caller's mistake is reported, not parsed around.
import { YamlOptions, parseYamlWith } from "nish/yaml";

export const main = (): number => {
  const options = new YamlOptions();
  options.maxDepth = 1001;
  console.log(`maxDepth ${options.maxDepth}`);
  const stream = parseYamlWith("a: 1\n", options);
  console.log(`unreachable ${stream.documentCount()}`);
  return 0;
};
