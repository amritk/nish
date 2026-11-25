// The Result forms of `nish/temporal`: a date out of Temporal's range, a
// string that names no date and a sum past the range each answer the `Err`
// branch with the text the panicking form's `RangeError` carries, and the
// program still exits 0.
import { Duration, PlainDate, tryPlainDate, tryPlainDateFrom } from "nish/temporal"

/** Print `r` as `ok <date>` or `err <reason>`. */
const show = (label: string, r: Result<PlainDate, string>): void => {
  if (r.ok) {
    console.log(`${label} => ok ${r.value.toString()}`)
  } else {
    console.log(`${label} => err ${r.error}`)
  }
}

export const main = (): i32 => {
  show("tryPlainDate(2024, 2, 29)", tryPlainDate(2024, 2, 29))
  show("tryPlainDate(2023, 2, 29)", tryPlainDate(2023, 2, 29))
  show("tryPlainDate(300000, 1, 1)", tryPlainDate(300000, 1, 1))
  show("tryPlainDate(-271821, 4, 18)", tryPlainDate(-271821, 4, 18))
  show('tryPlainDateFrom("2024-01-15")', tryPlainDateFrom("2024-01-15"))
  show('tryPlainDateFrom("2024-13-45")', tryPlainDateFrom("2024-13-45"))
  show('tryPlainDateFrom("not a date")', tryPlainDateFrom("not a date"))
  show('tryPlainDateFrom("+999999-01-01")', tryPlainDateFrom("+999999-01-01"))
  show('tryPlainDateFrom("-500000-01-01")', tryPlainDateFrom("-500000-01-01"))
  show("2024-01-31.tryAdd(P1M)", new PlainDate(2024, 1, 31).tryAdd(new Duration(0, 1)))
  show("+275760-09-13.tryAdd(P1D)", new PlainDate(275760, 9, 13).tryAdd(new Duration(0, 0, 0, 1)))
  show("2024-01-01.tryAdd(P4000000Y)", new PlainDate(2024, 1, 1).tryAdd(new Duration(4000000)))
  return 0
}
