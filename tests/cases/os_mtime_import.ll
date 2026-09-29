@.str.0 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"tests/cases/os_mtime.missing\00" }, align 8

declare double @nish_stat_mtime(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  %m.addr = alloca double, align 8
  %0 = call double @nish_stat_mtime(i8* bitcast ({ i64, [29 x i8] }* @.str.0 to i8*))
  store double %0, double* %m.addr, align 8
  %1 = load double, double* %m.addr, align 8
  %2 = load double, double* %m.addr, align 8
  %3 = fcmp une double %1, %2
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  ret i32 %4
}

attributes #0 = { nounwind willreturn }
