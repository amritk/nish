@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare noundef double @sts_random() #0
declare double @llvm.floor.f64(double) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #2

define noundef i32 @bad() #0 {
entry:
  %0 = call double @sts_random()
  %1 = call double @llvm.floor.f64(double %0)
  %2 = call i32 @llvm.fptosi.sat.i32.f64(double %1)
  ret i32 %2
}

define noundef i32 @bad10() #0 {
entry:
  %0 = call i32 @bad()
  %1 = call i32 @bad()
  %2 = add i32 %0, %1
  %3 = call i32 @bad()
  %4 = add i32 %2, %3
  %5 = call i32 @bad()
  %6 = add i32 %4, %5
  %7 = call i32 @bad()
  %8 = add i32 %6, %7
  %9 = call i32 @bad()
  %10 = add i32 %8, %9
  %11 = call i32 @bad()
  %12 = add i32 %10, %11
  %13 = call i32 @bad()
  %14 = add i32 %12, %13
  %15 = call i32 @bad()
  %16 = add i32 %14, %15
  %17 = call i32 @bad()
  %18 = add i32 %16, %17
  ret i32 %18
}

define noundef i32 @bad100() #0 {
entry:
  %0 = call i32 @bad10()
  %1 = call i32 @bad10()
  %2 = add i32 %0, %1
  %3 = call i32 @bad10()
  %4 = add i32 %2, %3
  %5 = call i32 @bad10()
  %6 = add i32 %4, %5
  %7 = call i32 @bad10()
  %8 = add i32 %6, %7
  %9 = call i32 @bad10()
  %10 = add i32 %8, %9
  %11 = call i32 @bad10()
  %12 = add i32 %10, %11
  %13 = call i32 @bad10()
  %14 = add i32 %12, %13
  %15 = call i32 @bad10()
  %16 = add i32 %14, %15
  %17 = call i32 @bad10()
  %18 = add i32 %16, %17
  ret i32 %18
}

define noundef i32 @bad1000() #0 {
entry:
  %0 = call i32 @bad100()
  %1 = call i32 @bad100()
  %2 = add i32 %0, %1
  %3 = call i32 @bad100()
  %4 = add i32 %2, %3
  %5 = call i32 @bad100()
  %6 = add i32 %4, %5
  %7 = call i32 @bad100()
  %8 = add i32 %6, %7
  %9 = call i32 @bad100()
  %10 = add i32 %8, %9
  %11 = call i32 @bad100()
  %12 = add i32 %10, %11
  %13 = call i32 @bad100()
  %14 = add i32 %12, %13
  %15 = call i32 @bad100()
  %16 = add i32 %14, %15
  %17 = call i32 @bad100()
  %18 = add i32 %16, %17
  ret i32 %18
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @bad1000()
  %1 = call i8* @sts_str_from_i32(i32 %0)
  call void @sts_print(i8* %1)
  %2 = call double @sts_random()
  %3 = call double @sts_random()
  %4 = fcmp une double %2, %3
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %5)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
