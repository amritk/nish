#!/bin/bash
# usage: probe.sh file.ts  -- compiles with the PR head's compiler; if accepted, runs native and under Node
W=/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/probe608
O=/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/out8
f=$(realpath "$1"); n=$(basename "$f" .ts); [ "$n" = main ] && n=$(basename $(dirname "$f"))
diag=$(cd $W && build/nish "$f" --json --link "$O/$n" -o "$O/$n.d/" 2>&1); st=$?
if [ $st -ne 0 ]; then
  echo "$n | REFUSED (exit $st) | $(echo "$diag" | python3 -c '
import sys,json
for l in sys.stdin:
  try: d=json.loads(l)
  except Exception: print(l.strip()[:200]); continue
  print("%s %d:%d %s" % (d.get("code"), d.get("line",0), d.get("column",0), d.get("message","").split(": a scope")[0][:160]))
' | tr '\n' ';')"; exit; fi
nat=$("$O/$n" 2>&1; echo "exit=$?")
nod=$(cd $W && node --experimental-strip-types --js-explicit-resource-management --no-warnings --import $W/runtime/nish.mjs -e "const m = await import(\"$f\"); process.exit(m.main());" 2>&1; echo "exit=$?")
same=DIFFER; [ "$nat" == "$nod" ] && same=same
echo "$n | ACCEPTED | native: $(echo $nat) | node: $(echo $nod) | $same"
