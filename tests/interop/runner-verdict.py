"""The quic-interop-runner's verdict on the Nish server, from its `--json` file.

The runner exits with the number of failed cases, and counts neither an
unsupported case nor one it never ran. This prints the result of every case
for every client and exits 1 unless each one asked for succeeded.

    python3 runner-verdict.py <result.json> <case>,<case>,...
"""

import json
import sys


def main() -> int:
    with open(sys.argv[1], encoding="utf-8") as f:
        result = json.load(f)
    wanted = sys.argv[2].split(",")
    ok = True
    for client, row in zip(result["clients"], result["results"]):
        got = {entry["name"]: entry["result"] for entry in row}
        for case in wanted:
            verdict = got.get(case) or "not run"
            print(f"{client:10} {case:14} {verdict}")
            ok = ok and verdict == "succeeded"
    seconds = result["end_time"] - result["start_time"]
    print(f"{'PASS' if ok else 'FAIL'} in {seconds:.0f} s")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
