// `nish/json-number`'s answers on spellings f64 gets wrong, every refusal on
// each side of its bound, and the long-divisor path, each pinned by value.
import {
  JSON_NUMBER_ERR_DIVISOR,
  JSON_NUMBER_ERR_EXPONENT,
  JSON_NUMBER_ERR_GAP,
  JSON_NUMBER_ERR_SYNTAX,
  jsonNumberCanonical,
  jsonNumberCompare,
  jsonNumberMultipleOf,
} from "nish/json-number";
import { Suite } from "nish/testing";

/** `"1"` written `n` times. */
const jnOnes = (n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i++) {
    parts.push("1");
  }
  return parts.join("");
};

const jnCompare = (t: Suite): void => {
  t.eqI32("compare: 1.0 equals 1e0", jsonNumberCompare("1.0", "1e0"), 0);
  t.eqI32("compare: 10e-1 equals 1", jsonNumberCompare("10e-1", "1"), 0);
  t.eqI32("compare: 0.015E+2 equals 1.5", jsonNumberCompare("0.015E+2", "1.5"), 0);
  t.eqI32("compare: -0 equals 0.0e5", jsonNumberCompare("-0", "0.0e5"), 0);
  t.eqI32("compare: 0.1 is below 0.10000000000000001, which f64 calls equal", jsonNumberCompare("0.1", "0.10000000000000001"), -1);
  t.eqI32("compare: 9007199254740993 is above 9007199254740992", jsonNumberCompare("9007199254740993", "9007199254740992"), 1);
  t.eqI32("compare: -2 is above -2.0001", jsonNumberCompare("-2", "-2.0001"), 1);
  t.eqI32("compare: -1 is below 0", jsonNumberCompare("-1", "0"), -1);
  t.eqI32("compare: 0 is above -1e-400", jsonNumberCompare("0", "-1e-400"), 1);
  t.eqI32("compare: 1e400 is above 9e399", jsonNumberCompare("1e400", "9e399"), 1);
  t.eqI32("compare: 1.0001 is above 1", jsonNumberCompare("1.0001", "1"), 1);
  t.eqI32("compare: 123 is below 124", jsonNumberCompare("123", "124"), -1);
  t.eqI32("compare: an exponent's leading zeros count for nothing", jsonNumberCompare("1e0000000000000000000001", "10"), 0);
  t.eqI32("compare: the largest exponent is read", jsonNumberCompare("1e1000000000000000", "9e999999999999999"), 1);
  t.eqI32("compare: the most negative exponent is read", jsonNumberCompare("1e-1000000000000000", "0"), 1);
};

const jnRefusals = (t: Suite): void => {
  const bad: string[] = ["", "-", "+1", "01", "-01", "1.", ".1", "1e", "1e+", "1E-x", "1 ", " 1", "0x1", "1.5e3x", "Infinity", "NaN"];
  const wrong: string[] = [];
  for (const s of bad) {
    if (jsonNumberCompare(s, "1") !== JSON_NUMBER_ERR_SYNTAX || jsonNumberCanonical(s) !== "") {
      wrong.push(`"${s}"`);
    }
  }
  t.eqStr("syntax: every text outside RFC 8259's grammar is refused", wrong.join(" "), "");
  t.eqI32("exponent: one past 10^15 is refused", jsonNumberCompare("1e1000000000000001", "1"), JSON_NUMBER_ERR_EXPONENT);
  t.eqI32("exponent: one past -10^15 is refused", jsonNumberCompare("1", "1e-1000000000000001"), JSON_NUMBER_ERR_EXPONENT);
  t.eqI32(
    "exponent: a forty-digit exponent is refused, not wrapped",
    jsonNumberCompare("1e1000000000000000000000000000000000000001", "1"),
    JSON_NUMBER_ERR_EXPONENT
  );
  t.eqStr("exponent: canonical refuses one past the bound", jsonNumberCanonical("5e1000000000000001"), "");
  t.eqI32("exponent: zero past the bound is still zero", jsonNumberCompare("0e9999999999999999", "0"), 0);
  t.eqI32("exponent: so is -0.000 past the negative bound", jsonNumberCompare("-0.000e-9999999999999999", "0"), 0);
  t.eqStr("exponent: canonical writes zero past the bound", jsonNumberCanonical("0.0E+99999999999999999999"), jsonNumberCanonical("0"));
  t.eqI32("order: a's refusal is answered first", jsonNumberCompare("1e1000000000000001", "x"), JSON_NUMBER_ERR_EXPONENT);
  t.eqI32("order: then b's", jsonNumberCompare("1", "x"), JSON_NUMBER_ERR_SYNTAX);
};

const jnCanonical = (t: Suite): void => {
  t.eqStr("canonical: 1.50", jsonNumberCanonical("1.50"), "15e-1");
  t.eqStr("canonical: 0.015e2", jsonNumberCanonical("0.015e2"), "15e-1");
  t.eqStr("canonical: 100", jsonNumberCanonical("100"), "1e2");
  t.eqStr("canonical: -0.015e2", jsonNumberCanonical("-0.015e2"), "-15e-1");
  t.eqStr("canonical: -0", jsonNumberCanonical("-0"), "0");
  t.eqStr("canonical: 0.000", jsonNumberCanonical("0.000"), "0");
  t.eqStr("canonical: 1e400", jsonNumberCanonical("1e400"), "1e400");
};

const jnMultipleOf = (t: Suite): void => {
  t.eqI32("multipleOf: 0.3 of 0.1, which f64 calls no", jsonNumberMultipleOf("0.3", "0.1"), 1);
  t.eqI32("multipleOf: 0.0075 of 0.0001", jsonNumberMultipleOf("0.0075", "0.0001"), 1);
  t.eqI32("multipleOf: 4.5 not of 2", jsonNumberMultipleOf("4.5", "2"), 0);
  t.eqI32("multipleOf: 35 not of 1.5", jsonNumberMultipleOf("35", "1.5"), 0);
  t.eqI32("multipleOf: 4.5 of 1.5", jsonNumberMultipleOf("4.5", "1.5"), 1);
  t.eqI32("multipleOf: 0.05 not of 0.1, its last digit finer", jsonNumberMultipleOf("0.05", "0.1"), 0);
  t.eqI32("multipleOf: signs are ignored", jsonNumberMultipleOf("-6", "3") + jsonNumberMultipleOf("6", "-3"), 2);
  t.eqI32("multipleOf: zero is one of anything", jsonNumberMultipleOf("-0.0", "7.3"), 1);
  t.eqI32("multipleOf: 1e308 of 0.5", jsonNumberMultipleOf("1e308", "0.5"), 1);
  t.eqI32("multipleOf: 1e308 not of 0.123456789", jsonNumberMultipleOf("1e308", "0.123456789"), 0);
  t.eqI32("multipleOf: 18 digits take the u64 remainder", jsonNumberMultipleOf("246913578024691356", "123456789012345678"), 1);
  t.eqI32(
    "multipleOf: 19 digits take the digit remainder",
    jsonNumberMultipleOf("12193263112482853212114007011", "12345678901234567891"),
    1
  );
  t.eqI32(
    "multipleOf: and see a remainder of one",
    jsonNumberMultipleOf("12193263112482853212114007012", "12345678901234567891"),
    0
  );
  t.eqI32(
    "multipleOf: a long divisor with a gap",
    jsonNumberMultipleOf("7e40", "1.000000000000000000001e21"),
    0
  );
  t.eqI32(
    "multipleOf: a long divisor scaled into the value",
    jsonNumberMultipleOf("7.000000000000000000007e61", "1.000000000000000000001e21"),
    1
  );
};

const jnMultipleOfRefusals = (t: Suite): void => {
  t.eqI32("divisor: zero is refused", jsonNumberMultipleOf("3", "0"), JSON_NUMBER_ERR_DIVISOR);
  t.eqI32("divisor: -0.0e9 is zero too", jsonNumberMultipleOf("0", "-0.0e9"), JSON_NUMBER_ERR_DIVISOR);
  t.eqI32("multipleOf: value's syntax first", jsonNumberMultipleOf("x", "0"), JSON_NUMBER_ERR_SYNTAX);
  t.eqI32("multipleOf: then the divisor's", jsonNumberMultipleOf("1", "1."), JSON_NUMBER_ERR_SYNTAX);
  t.eqI32("multipleOf: an exponent past the bound", jsonNumberMultipleOf("1", "1e1000000000000001"), JSON_NUMBER_ERR_EXPONENT);
  // The security bound: 22 bytes that would be a billion steps.
  t.eqI32("gap: 1e1000000000 of 2 is refused before it starts", jsonNumberMultipleOf("1e1000000000", "2"), JSON_NUMBER_ERR_GAP);
  t.eqI32("gap: 2^20 + 1 steps of gap is refused", jsonNumberMultipleOf("1e1048576", "1"), JSON_NUMBER_ERR_GAP);
  t.eqI32("gap: 2^20 steps in all is answered", jsonNumberMultipleOf("1e1048575", "1"), 1);
  t.eqI32("gap: 2^20 + 1 digits of value are refused", jsonNumberMultipleOf(jnOnes(1048577), "3"), JSON_NUMBER_ERR_GAP);
  t.eqI32("gap: 2^20 digits of value are answered", jsonNumberMultipleOf(jnOnes(1048576), "11"), 1);
  // 19 divisor digits allow 2^20 / 19 = 55188 dividend digits.
  t.eqI32("gap: a long divisor's steps count its digits", jsonNumberMultipleOf("1e55188", "1234567890123456789"), JSON_NUMBER_ERR_GAP);
  t.eqI32("gap: one step fewer is answered", jsonNumberMultipleOf("1e55187", "1234567890123456789"), 0);
};

export const jnUnits = (t: Suite): void => {
  jnCompare(t);
  jnRefusals(t);
  jnCanonical(t);
  jnMultipleOf(t);
  jnMultipleOfRefusals(t);
};
