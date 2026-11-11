"""Checks autobahn-verdict.py's verdicts on reports made up for it.

The `autobahn` job runs this before it trusts the script's verdict on a real
run: every case OK or INFORMATIONAL passes; a NON-STRICT or FAILED behavior, a
bad behaviorClose, a report with no cases for the agent, an empty report and a
missing one all fail.

    python3 autobahn-verdict-test.py
"""

import json
import pathlib
import subprocess
import sys
import tempfile

SCRIPT = pathlib.Path(__file__).with_name("autobahn-verdict.py")


def grade(behavior: str, close: str = "OK") -> dict[str, str]:
    return {"behavior": behavior, "behaviorClose": close}


# Each made-up index.json (None: no file at all) and whether the verdict passes.
CASES = [
    ("every case OK or INFORMATIONAL", {"nish": {"1.1.1": grade("OK"), "7.1.6": grade("INFORMATIONAL")}}, True),
    ("a NON-STRICT behavior", {"nish": {"1.1.1": grade("OK"), "6.4.3": grade("NON-STRICT")}}, False),
    ("a FAILED behavior", {"nish": {"5.1": grade("FAILED")}}, False),
    ("a behaviorClose not OK", {"nish": {"7.3.1": grade("OK", "FAILED")}}, False),
    ("no cases for the agent", {"other": {"1.1.1": grade("OK")}}, False),
    ("an empty report", {}, False),
    ("no report", None, False),
]


def main() -> int:
    ok = True
    with tempfile.TemporaryDirectory() as scratch:
        for what, report, passes in CASES:
            index = pathlib.Path(scratch) / "index.json"
            index.unlink(missing_ok=True)
            if report is not None:
                index.write_text(json.dumps(report), encoding="utf-8")
            run = subprocess.run([sys.executable, "-I", str(SCRIPT), str(index), "nish"], capture_output=True, text=True)
            right = (run.returncode == 0) == passes
            print(f"{'PASS' if right else 'FAIL'}  {what}: exit {run.returncode}")
            ok = ok and right
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
