#!/bin/bash
# usage: warn.sh head|main file.ts  -> warnings (code line:col msg) from --warn-portability
R=/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/r609
W=$R/$1; f=$(realpath "$2"); n=$(basename "$f" .ts)
out=$(cd $W && timeout 120 build/nish "$f" --warn-portability --json -o "$R/r3/out/$n.$1.d/" 2>&1); st=$?
echo "$n [$1 exit $st] $(echo "$out" | python3 -c '
import sys,json
r=[]
for l in sys.stdin:
  l=l.strip()
  if not l: continue
  if l.startswith("wrote "): continue
  try: d=json.loads(l)
  except Exception: r.append("RAW:"+l[:200]); continue
  r.append("%s %s:%s %s" % (d.get("code"), d.get("line",0), d.get("column",0), d.get("message","")[:150]))
print(" ;; ".join(r) if r else "(no diagnostics)")
')"
