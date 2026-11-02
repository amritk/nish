#!/bin/bash
# loops.sh <exe> <func>: every loop in <func> (backward branch target..branch): insns, loads, stores, xmm insns, rsp refs
objdump -d --no-show-raw-insn -M intel --disassemble=$2 $1 |
  grep -P '^\s+[0-9a-f]+:\t' | awk -F'\t' '{ a = $1; sub(/^ +/, "", a); sub(/:$/, "", a); i[++n] = $2; at[a] = n }
  $2 ~ /^j/ { split($2, t, " +"); if (t[2] in at && at[t[2]] < n) { lo[++L] = at[t[2]]; hi[L] = n } }
  END { for (l = 1; l <= L; l++) { ld = st = br = x = sp = 0; for (k = lo[l]; k <= hi[l]; k++) { o = i[k]; if (o ~ /xmm|ymm/) x++; if (o ~ /rsp/) sp++; sub(/^[a-z]+ +/, "", o)
    if (o ~ /^[^,]*PTR \[/) st++; else if (o ~ /PTR \[/) ld++; if (i[k] ~ /^(j|call)/) br++ }
    print hi[l] - lo[l] + 1 " insns, " ld " loads, " st " stores, " x " xmm, " sp " rsp, " br " br" } }'
