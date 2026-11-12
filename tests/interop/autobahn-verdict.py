"""The verdict on an Autobahn TestSuite fuzzingclient run against Nish.

The interop job's `autobahn` lane runs the fuzzingclient's cases against the
interop server's WebSocket echo port (`--ws-port`), every case but 12.* and
13.*, which need permessage-deflate and the server never negotiates it. This
reads the run's `index.json` and passes only if every case's `behavior` and
`behaviorClose` is OK or INFORMATIONAL, the grade the suite gives cases
whose outcome it only records (7.1.6, 7.13.*). Anything else, NON-STRICT
included, fails, each such case named with its grades. A report with no
cases fails too: a run that never reached the server proves nothing.

    python3 autobahn-verdict.py <index.json> <agent>
"""

import json
import sys

PASSING = ("OK", "INFORMATIONAL")


def case_key(case_id: str) -> tuple[int, ...]:
    """'7.13.2' as (7, 13, 2), so cases sort as the suite numbers them."""
    return tuple(int(part) for part in case_id.split("."))


def main() -> int:
    index_file, agent = sys.argv[1], sys.argv[2]
    with open(index_file, encoding="utf-8") as f:
        cases = json.load(f).get(agent, {})
    failed = []
    counts: dict[str, int] = {}
    for case_id in sorted(cases, key=case_key):
        result = cases[case_id]
        behavior, close = result.get("behavior"), result.get("behaviorClose")
        counts[behavior] = counts.get(behavior, 0) + 1
        if behavior not in PASSING or close not in PASSING:
            failed.append(f"{case_id}: behavior {behavior}, behaviorClose {close}")
    summary = ", ".join(f"{count} {grade}" for grade, count in sorted(counts.items()))
    print(f"autobahn: {len(cases)} cases for {agent}: {summary or 'none'}")
    for line in failed:
        print(f"FAIL  {line}")
    if not cases:
        print(f"FAIL  {index_file} has no cases for {agent}")
        return 1
    print("PASS" if not failed else f"FAIL  {len(failed)} cases")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
