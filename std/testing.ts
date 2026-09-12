/**
 * `std/testing` — a test runner for Nish programs, written in Nish.
 *
 * The repository's own suite is `tests/run.js`, a Node program: it compiles the
 * corpus, assembles it, links it and diffs the result against a golden, so it
 * has to be able to spawn a compiler and read a directory. This module answers
 * the other half of the question — a *program* that checks its own behaviour
 * and reports it — and it answers it in the language, with no Node anywhere.
 *
 * Five language rules shape the API, and each of them removes a shape that a
 * JavaScript test framework would have reached for first:
 *
 *   1. **A function is not a value** ([LANGUAGE.md](../docs/LANGUAGE.md) §
 *      Functions), so there is no `test("name", () => { ... })`. A suite is an
 *      object the test program drives with straight-line calls, and the test
 *      names are arguments rather than closures. This is not a workaround: the
 *      whole-program pass cannot prove purity, termination or escape facts
 *      through an unknown callee, which is what keeps function types out of the
 *      language in the first place.
 *   2. **There is no `try` / `catch`**, so an assertion cannot throw and be
 *      collected. Each one records its outcome and returns it, and `done`
 *      turns the tally into the process exit code.
 *   3. **Every assertion answers a `boolean`** for the reason that follows from
 *      2: an out-of-range index and an empty `pop` *panic*, which ends the
 *      process, so "check the length, then read the element" has to be a real
 *      branch — `if (!suite.eqI32("len", a.length, 3)) { return suite.done(); }`
 *      is how a test stops before the read that would abort the whole run.
 *   4. **There are no generics**, so there is one assertion per type rather
 *      than one `eq` over all of them. The alternative — a single `eq` taking
 *      strings and asking every caller to interpolate — would report
 *      `expected "3", got "4"` for two numbers and lose the type in the
 *      message.
 *   5. **There are no optional or default parameters**, so every assertion
 *      takes its name and its detail in full.
 *
 * The output is deliberately the shape `tests/run.js` prints — `PASS  <name>`,
 * `FAIL  <name>` with an indented detail line, `SKIP  <name> (<reason>)`, and a
 * summary that ends `N passed, M failed, K skipped` — so a Nish test program
 * reads like the rest of the suite and a skip is counted rather than merely
 * mentioned. A green run that skipped half its checks should look different
 * from one that proved everything.
 *
 * The widths are spelled explicitly (`i32`, `i64`, `f64`) rather than as
 * `number`, so the module means the same thing under `--number-mode f64` as it
 * does by default, exactly as `examples/arrays.ts` does.
 *
 *     import { Suite } from "../std/testing";
 *
 *     export const main = (): number => {
 *       const t = new Suite("arrays");
 *       const a: i32[] = [1, 2, 3];
 *       if (!t.eqI32("length", a.length, 3)) {
 *         return t.done();          // a[2] below would panic, not fail
 *       }
 *       t.eqI32("last", a[2], 3);
 *       return t.done();            // 0 when nothing failed, 1 otherwise
 *     };
 */

/**
 * One run of checks, and the tally it reports.
 *
 * A program may hold several — one per family of behaviour — and sum their exit
 * codes, because `done` answers a code rather than ending the process: a suite
 * that called `process.exit` itself would make the second suite unreachable.
 */
export class Suite {
  /** Names the summary line, so several suites in one program stay apart. */
  name: string;
  // These three have initializers because the constructor does not assign them,
  // and every field holds a value once it returns. `name` does not, and an
  // initializer there would only be a store the constructor overwrites.
  passed: i32 = 0;
  failed: i32 = 0;
  skipped: i32 = 0;
  /**
   * The names of the checks that failed, recapped by `done`. The detail of
   * each was printed when it happened; this is the list a reader wants after
   * a hundred lines of output have scrolled the failures off the screen.
   */
  failures: string[];

  constructor(name: string) {
    this.name = name;
    this.failures = [];
  }

  /** Records a pass. Public because a program with a check of its own shape still wants the tally. */
  pass(name: string): boolean {
    this.passed += 1;
    console.log(`PASS  ${name}`);
    return true;
  }

  /**
   * Records a failure, with `detail` on its own indented line when there is
   * one. An empty `detail` prints no second line, which is what a check whose
   * name already says everything wants.
   */
  fail(name: string, detail: string): boolean {
    this.failed += 1;
    this.failures.push(name);
    console.log(`FAIL  ${name}`);
    if (detail.length > 0) {
      console.log(`      ${detail}`);
    }
    return false;
  }

  /**
   * Records a check that did not run, and why. It answers `void` rather than a
   * `boolean` because there is no outcome to branch on: the caller has already
   * decided to skip, the way `tests/run.js` decides when `llvm-as` is missing.
   */
  skip(name: string, reason: string): void {
    this.skipped += 1;
    console.log(`SKIP  ${name} (${reason})`);
  }

  ok(name: string, condition: boolean): boolean {
    if (condition) {
      return this.pass(name);
    }
    return this.fail(name, "expected true, got false");
  }

  eqBool(name: string, actual: boolean, expected: boolean): boolean {
    if (actual === expected) {
      return this.pass(name);
    }
    return this.fail(name, `expected ${expected}, got ${actual}`);
  }

  eqI32(name: string, actual: i32, expected: i32): boolean {
    if (actual === expected) {
      return this.pass(name);
    }
    return this.fail(name, `expected ${expected}, got ${actual}`);
  }

  eqI64(name: string, actual: i64, expected: i64): boolean {
    if (actual === expected) {
      return this.pass(name);
    }
    return this.fail(name, `expected ${expected}, got ${actual}`);
  }

  /**
   * Exact `f64` equality, which is `fcmp oeq`: `NaN` is equal to nothing, so a
   * check of a computation that can produce one fails rather than passing by
   * accident. Use `nearF64` for anything that went through arithmetic.
   */
  eqF64(name: string, actual: f64, expected: f64): boolean {
    if (actual === expected) {
      return this.pass(name);
    }
    return this.fail(name, `expected ${expected}, got ${actual}`);
  }

  /**
   * `f64` equality within `tolerance`, the absolute difference. The tolerance
   * is a parameter rather than a constant here because the right epsilon
   * belongs to the computation, not to the harness.
   */
  nearF64(name: string, actual: f64, expected: f64, tolerance: f64): boolean {
    let delta: f64 = actual - expected;
    if (delta < 0) {
      delta = -delta;
    }
    if (delta <= tolerance) {
      return this.pass(name);
    }
    return this.fail(name, `expected ${expected} +/- ${tolerance}, got ${actual}`);
  }

  /**
   * String equality by content (`nish_str_eq`), which is what `===` on two
   * strings already means. The values are quoted in the message so that a
   * trailing space or an empty string is visible in the diff.
   */
  eqStr(name: string, actual: string, expected: string): boolean {
    if (actual === expected) {
      return this.pass(name);
    }
    return this.fail(name, `expected "${expected}", got "${actual}"`);
  }

  /**
   * Prints the recap and the summary, and answers the exit code: 0 when
   * nothing failed, 1 otherwise. A skip is not a failure, so it does not move
   * the code — it moves the count on the summary line, which is the whole
   * reason the count is printed.
   */
  done(): i32 {
    if (this.failures.length > 0) {
      console.log(`failed: ${this.failures.join(", ")}`);
    }
    console.log(`${this.name}: ${this.passed} passed, ${this.failed} failed, ${this.skipped} skipped`);
    if (this.failed > 0) {
      return 1;
    }
    return 0;
  }
}
