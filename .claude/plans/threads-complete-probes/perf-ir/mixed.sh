#!/bin/bash
# usage: mixed.sh APP RUNS LOG -- mixed probe at N=8/16/64, threads 2/4/8
APP=$1; RUNS=$2; LOG=$3
: > $LOG
for N in 8 16 64; do
  M=$((40000 / N))
  for T in 2 4 8; do
    res=$(seq $RUNS | xargs -P 1 -I{} bash -c "out=\$(NISH_NUM_THREADS=$T timeout 20 $APP $N $M 2>&1); c=\$?; if [ \$c -eq 124 ]; then echo HANG; elif [ \$c -ne 0 ]; then echo \"FAIL\$c:\$out\"; elif [[ \$out != OK* ]]; then echo \"WRONG:\$out\"; else echo OK; fi" | sort | uniq -c | tr '\n' ' ')
    echo "N=$N M=$M T=$T :: $res" >> $LOG
  done
done
echo DONE >> $LOG
