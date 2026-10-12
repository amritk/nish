#!/bin/bash
# usage: oversub.sh APP RUNS LOG -- RUNS runs, 4 at once on 4 cores, so holders get preempted
APP=$1; RUNS=$2; LOG=$3; : > $LOG
for cfg in "8 50000 0 0" "16 2000 300 0" "64 3125 5 5" "64 500 300 0"; do
  for T in 2 4 8; do
    res=$(seq $RUNS | xargs -P 4 -I{} bash -c "out=\$(NISH_NUM_THREADS=$T timeout 20 $APP $cfg 2>&1); c=\$?; if [ \$c -eq 124 ]; then echo HANG; elif [ \$c -ne 0 ]; then echo \"FAIL\$c:\$out\"; elif [[ \$out != OK* ]]; then echo \"WRONG:\$out\"; else echo OK; fi" | sort | uniq -c | tr '\n' ' ')
    echo "cfg=($cfg) T=$T :: $res" >> $LOG
  done
done
echo DONE >> $LOG
