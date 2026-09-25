// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

import { Bounce } from "./bounce";
import { List } from "./list";
import { Mandelbrot } from "./mandelbrot";
import { Permute } from "./permute";
import { Queens } from "./queens";
import { Storage } from "./storage";
import { Towers } from "./towers";

// Nish has neither function values nor dynamic dispatch, so the harness picks
// the benchmark by name here instead of looking up a class in a table.
const isKnownBenchmark = (name: string): boolean =>
  name === "Bounce" ||
  name === "List" ||
  name === "Mandelbrot" ||
  name === "Permute" ||
  name === "Queens" ||
  name === "Storage" ||
  name === "Towers";

const innerBenchmarkLoop = (name: string, innerIterations: i32): boolean => {
  if (name === "Bounce") {
    return new Bounce().innerBenchmarkLoop(innerIterations);
  }
  if (name === "List") {
    return new List().innerBenchmarkLoop(innerIterations);
  }
  if (name === "Mandelbrot") {
    return new Mandelbrot().innerBenchmarkLoop(innerIterations);
  }
  if (name === "Permute") {
    return new Permute().innerBenchmarkLoop(innerIterations);
  }
  if (name === "Queens") {
    return new Queens().innerBenchmarkLoop(innerIterations);
  }
  if (name === "Storage") {
    return new Storage().innerBenchmarkLoop(innerIterations);
  }
  if (name === "Towers") {
    return new Towers().innerBenchmarkLoop(innerIterations);
  }
  panic(`Unknown benchmark: ${name}`);
};

const printUsage = (): void => {
  console.log("harness [benchmark] [num-iterations [inner-iter]]");
  console.log("");
  console.log("  benchmark      - benchmark class name");
  console.log("  num-iterations - number of times to execute benchmark, default: 1");
  console.log("  inner-iter     - number of times the benchmark is executed in an inner loop,");
  console.log("                   which is measured in total, default: 1");
};

// Runs every outer iteration, prints its time and returns the total in µs.
const doRuns = (name: string, numIterations: i32, innerIterations: i32): i64 => {
  let total: i64 = 0;
  for (let i = 0; i < numIterations; i += 1) {
    const startTime = monotonicNanos();
    // Everything one measurement allocates is dead once it has been verified,
    // so hand it back to the arena, the way the GC or `delete` does elsewhere.
    const mark = Arena.mark();
    if (!innerBenchmarkLoop(name, innerIterations)) {
      panic("Benchmark failed with incorrect result");
    }
    Arena.release(mark);
    const runTime = (monotonicNanos() - startTime) / 1000;

    console.log(`${name}: iterations=1 runtime: ${runTime}us`);
    total += runTime;
  }
  return total;
};

export const main = (): i32 => {
  // process.argv[0] is the program itself, so the benchmark is argv[1].
  const args = process.argv;
  if (args.length < 2) {
    printUsage();
    return 1;
  }

  const name = args[1];
  if (!isKnownBenchmark(name)) {
    console.log(`Unknown benchmark: ${name}`);
    return 1;
  }

  let numIterations = 1;
  let innerIterations = 1;
  if (args.length > 2) {
    numIterations = parseInt(args[2]);
    if (args.length > 3) {
      innerIterations = parseInt(args[3]);
    }
  }

  console.log(`Starting ${name} benchmark ...`);
  const total = doRuns(name, numIterations, innerIterations);

  const average = (total + toI64(numIterations) / 2) / toI64(numIterations);
  console.log(`${name}: iterations=${numIterations} average: ${average}us total: ${total}us`);
  console.log("");
  console.log("");
  console.log(`Total Runtime: ${total}us`);
  return 0;
};
