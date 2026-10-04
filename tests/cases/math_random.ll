@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noundef double @nish_random() #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare double @llvm.floor.f64(double) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @bad() #0 {
entry:
  %0 = call double @nish_random()
  %1 = call double @llvm.floor.f64(double %0)
  %2 = call i32 @llvm.fptosi.sat.i32.f64(double %1)
  ret i32 %2
}

define internal noundef i32 @bad10() #1 {
entry:
  %0 = call i32 @bad()
  %1 = call i32 @bad()
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @bad()
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call i32 @bad()
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call i32 @bad()
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %17 = call i32 @bad()
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %21 = call i32 @bad()
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %25 = call i32 @bad()
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %29 = call i32 @bad()
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %33 = call i32 @bad()
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @bad100() #1 {
entry:
  %0 = call i32 @bad10()
  %1 = call i32 @bad10()
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @bad10()
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call i32 @bad10()
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call i32 @bad10()
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %17 = call i32 @bad10()
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %21 = call i32 @bad10()
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %25 = call i32 @bad10()
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %29 = call i32 @bad10()
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %33 = call i32 @bad10()
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @bad1000() #1 {
entry:
  %0 = call i32 @bad100()
  %1 = call i32 @bad100()
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @bad100()
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call i32 @bad100()
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call i32 @bad100()
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %17 = call i32 @bad100()
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %21 = call i32 @bad100()
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %25 = call i32 @bad100()
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %29 = call i32 @bad100()
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %33 = call i32 @bad100()
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @bad1000()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call double @nish_random()
  %3 = call double @nish_random()
  %4 = fcmp une double %2, %3
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
