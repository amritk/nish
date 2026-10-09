"""The quic-interop-runner's verdict on the Nish server, from its `--json` file.

The runner exits with the number of failed cases, and counts neither an
unsupported case nor one it never ran. This prints the result of every case
for every client and exits 1 unless each one asked for succeeded.

    python3 runner-verdict.py <result.json> <case>,<case>,...
    python3 runner-verdict.py <result.json> <case>,... <retry.json>
    python3 runner-verdict.py --failed <result.json> <case>,...

`--failed` prints the cases that did not succeed, comma-separated, for the
workflow to run once more. Given a second file, the run of those cases, a
case passes when it succeeded the first time or in that second run; one that
needed it prints as "succeeded on retry" beside what it was the first time.
The runner's simulator sometimes starts its capture after a connection's first
packets, and a case that reads the trace then finds no Retry, no version or
no handshake in a transfer that went through, or tshark, which reads it,
crashes and takes the runner down before it writes its file. A missing file
counts as every case not run, so the retry runs them all. A case that fails
both runs still fails, and so does a pair of runs that wrote no file at all.
"""

import json
import sys


def results(path: str) -> dict:
    """Every case's result for each client in the runner's --json file at `path`, none if it wrote no file."""
    try:
        with open(path, encoding="utf-8") as f:
            result = json.load(f)
    except FileNotFoundError:
        print(f"the runner wrote no {path}", file=sys.stderr)
        return {"table": {}, "seconds": 0}
    table = {
        client: {entry["name"]: entry["result"] for entry in row}
        for client, row in zip(result["clients"], result["results"])
    }
    return {"table": table, "seconds": result["end_time"] - result["start_time"]}


def main() -> int:
    if sys.argv[1] == "--failed":
        first = results(sys.argv[2])["table"]
        wanted = sys.argv[3].split(",")
        rows = list(first.values()) or [{}]
        failed = [case for case in wanted if any((row.get(case) or "not run") != "succeeded" for row in rows)]
        print(",".join(failed))
        return 0
    first = results(sys.argv[1])
    wanted = sys.argv[2].split(",")
    retry = results(sys.argv[3]) if len(sys.argv) > 3 else None
    clients = list(first["table"]) or (list(retry["table"]) if retry is not None else [])
    if not clients:
        print("FAIL: no results for any client")
        return 1
    ok = True
    for client in clients:
        row = first["table"].get(client, {})
        for case in wanted:
            verdict = row.get(case) or "not run"
            if verdict != "succeeded" and retry is not None:
                again = retry["table"].get(client, {}).get(case) or "not run"
                verdict = "succeeded on retry" if again == "succeeded" else f"{again} on retry"
                print(f"{client:10} {case:14} {verdict} (first: {row.get(case) or 'not run'})")
                ok = ok and again == "succeeded"
                continue
            print(f"{client:10} {case:14} {verdict}")
            ok = ok and verdict == "succeeded"
    seconds = first["seconds"] + (retry["seconds"] if retry is not None else 0)
    print(f"{'PASS' if ok else 'FAIL'} in {seconds:.0f} s")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
