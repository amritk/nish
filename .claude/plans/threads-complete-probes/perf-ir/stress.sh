#!/bin/bash
# usage: stress.sh APP RUNS PAR LOG  -- each config x threads 2/4/8, RUNS runs, PAR concurrent
APP=$1; RUNS=$2; PAR=$3; LOG=$4
: > $LOG
for N in 8 16 64; do
  for shape in short long outer tiny; do
    case $shape in
      short) M=$((400000 / N)); I=0; O=0;;
      long)  M=$((32000 / N)); I=300; O=0;;
      outer) M=$((200000 / N)); I=0; O=100;;
      tiny)  M=$((200000 / N)); I=5; O=5;;
    esac
    for T in 2 4 8; do
      res=$(seq $RUNS | xargs -P $PAR -I{} bash -c "out=\$(NISH_NUM_THREADS=$T timeout 20 $APP $N $M $I $O 2>&1); c=\$?; if [ \$c -eq 124 ]; then echo HANG; elif [ \$c -ne 0 ]; then echo \"FAIL\$c:\$out\"; elif [[ \$out != OK* ]]; then echo \"WRONG:\$out\"; else echo OK; fi" | sort | uniq -c | tr '\n' ' ')
      echo "N=$N shape=$shape M=$M inner=$I outer=$O T=$T :: $res" >> $LOG
    done
  done
done
echo DONE >> $LOG
