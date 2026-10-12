#!/bin/bash
# usage: probe609.sh head|main file.ts
# Compiles with that worktree's build/nish; if accepted, runs natively (default,
# NISH_NUM_THREADS=1, NISH_NUM_THREADS=2) and under Node the way tests/run.js does.
R=/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/r609
W=$R/$1; O=$R/out-$1; mkdir -p $O
f=$(realpath "$2"); n=$(basename "$f" .ts); [ "$n" = main ] && n=$(basename $(dirname "$f"))
diag=$(cd $W && timeout 120 build/nish "$f" --json --link "$O/$n" -o "$O/$n.d/" 2>&1); st=$?
if [ $st -ne 0 ]; then
  echo "$n | REFUSED (exit $st) | $(echo "$diag" | python3 -c '
import sys,json
for l in sys.stdin:
  try: d=json.loads(l)
  except Exception: print(l.strip()[:200]); continue
  print("%s %d:%d %s" % (d.get("code"), d.get("line",0), d.get("column",0), d.get("message","").split(": a scope")[0][:160]))
' | tr '\n' ';')"; exit; fi
nat=$(cd $O && timeout 30 "$O/$n" 2>&1; echo "exit=$?")
t1=$(cd $O && NISH_NUM_THREADS=1 timeout 30 "$O/$n" 2>&1; echo "exit=$?")
t2=$(cd $O && NISH_NUM_THREADS=2 timeout 30 "$O/$n" 2>&1; echo "exit=$?")
nod=$(cd $W && timeout 60 node --experimental-strip-types --js-explicit-resource-management --no-warnings --import $W/runtime/nish.mjs -e "const m = await import(\"$f\"); process.exit(m.main());" 2>&1; echo "exit=$?")
same=DIFFER; [ "$nat" == "$nod" ] && [ "$t1" == "$nod" ] && [ "$t2" == "$nod" ] && same=same
echo "$n | ACCEPTED | native: $(echo "$nat" | tr "\n" " ") | t1: $(echo "$t1" | tr "\n" " ") | t2: $(echo "$t2" | tr "\n" " ") | node: $(echo "$nod" | tr "\n" " ") | $same"
