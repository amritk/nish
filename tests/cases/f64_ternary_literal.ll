define internal noundef double @pick(i1 noundef zeroext %flag) #0 {
entry:
  %scale.addr = alloca double, align 8
  br i1 %flag, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %0 = phi double [ 0x41E0000000000000, %cond.true ], [ 0x3FE0000000000000, %cond.false ]
  store double %0, double* %scale.addr, align 8
  %1 = load double, double* %scale.addr, align 8
  ret double %1
}

define internal noundef i64 @widen(i1 noundef zeroext %flag, i64 noundef %x) #0 {
entry:
  br i1 %flag, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %0 = phi i64 [ %x, %cond.true ], [ 5, %cond.false ]
  ret i64 %0
}

define noundef i32 @test() #0 {
entry:
  %wide.addr = alloca i64, align 8
  %0 = sext i32 1 to i64
  %1 = call i64 @widen(i1 false, i64 %0)
  store i64 %1, i64* %wide.addr, align 8
  %2 = call double @pick(i1 false)
  %3 = fcmp olt double %2, 0x3FF0000000000000
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load i64, i64* %wide.addr, align 8
  %5 = sext i32 5 to i64
  %6 = icmp eq i64 %4, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 7, %cond.true ], [ 0, %cond.false ]
  ret i32 %8
}

attributes #0 = { nounwind willreturn readnone }
