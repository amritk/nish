@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"after 2020: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"agrees with Date.now: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_wall_clock_nanos() #1
declare double @nish_date_now() #1

define noundef i32 @nish_main() #0 {
entry:
  %nanos.addr = alloca i64, align 8
  %millis.addr = alloca double, align 8
  %apart.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_wall_clock_nanos()
  store i64 %0, i64* %nanos.addr, align 8
  %1 = call double @nish_date_now()
  store double %1, double* %millis.addr, align 8
  %2 = load i64, i64* %nanos.addr, align 8
  %3 = sdiv i64 %2, 1000000000
  %4 = icmp sgt i64 %3, 1577836800
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*), i8* %5)
  call void @nish_print(i8* %6)
  %7 = load i64, i64* %nanos.addr, align 8
  %8 = sdiv i64 %7, 1000000
  %9 = sitofp i64 %8 to double
  %10 = load double, double* %millis.addr, align 8
  %11 = fsub double %9, %10
  store double %11, double* %apart.addr, align 8
  %12 = load double, double* %apart.addr, align 8
  %13 = fneg double 0x40ED4C0000000000
  %14 = fcmp ogt double %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load double, double* %apart.addr, align 8
  %16 = fcmp olt double %15, 0x40ED4C0000000000
  br label %land.end

land.end:
  %17 = phi i1 [ false, %entry ], [ %16, %land.rhs ]
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [23 x i8] }* @.str.3 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
