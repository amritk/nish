"""The quic-interop-runner's verdict on the Nish server, from its `--json` file.

The runner exits with the number of failed cases, and counts neither an
unsupported case, nor one it never ran, nor any measurement (goodput,
crosstraffic), which its file lists apart from the tests. This prints the
result of every case for every client, tests and measurements alike, and
exits 1 unless each one asked for succeeded. A measurement succeeds when
every one of its repetitions completed the transfer; the rate it reached is
printed beside it and is not judged.

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
        return {"table": {}, "details": {}, "seconds": 0}
    table: dict = {client: {} for client in result["clients"]}
    details: dict = {client: {} for client in result["clients"]}
    # Tests and measurements are two lists, each with one row per client.
    for rows in (result["results"], result.get("measurements", [])):
        for client, row in zip(result["clients"], rows):
            for entry in row:
                table[client][entry["name"]] = entry["result"]
                if entry.get("details"):
                    details[client][entry["name"]] = entry["details"]
    return {"table": table, "details": details, "seconds": result["end_time"] - result["start_time"]}


def measured(run: dict, client: str, case: str) -> str:
    """What `run` measured for `case`, as ", 9310 (± 42) kbps", or nothing for a test."""
    detail = run["details"].get(client, {}).get(case)
    return f", {detail}" if detail else ""


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
                print(f"{client:10} {case:14} {verdict}{measured(retry, client, case)} (first: {row.get(case) or 'not run'})")
                ok = ok and again == "succeeded"
                continue
            print(f"{client:10} {case:14} {verdict}{measured(first, client, case)}")
            ok = ok and verdict == "succeeded"
    seconds = first["seconds"] + (retry["seconds"] if retry is not None else 0)
    print(f"{'PASS' if ok else 'FAIL'} in {seconds:.0f} s")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
