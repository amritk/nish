@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare double @llvm.floor.f64(double) #2
declare double @llvm.copysign.f64(double, double) #2

define noundef i32 @nish_main() #0 {
entry:
  %one.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %low.addr = alloca double, align 8
  %high.addr = alloca double, align 8
  %r.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = fdiv double 0x0000000000000000, 0x0000000000000000
  store double %0, double* %nan.addr, align 8
  %1 = load double, double* %nan.addr, align 8
  %2 = load double, double* %one.addr, align 8
  %3 = fcmp uno double %1, %2
  br i1 %3, label %min.end, label %min.num

min.num:
  %4 = fcmp olt double %1, %2
  %5 = select i1 %4, double %1, double %2
  %6 = fcmp oeq double %1, %2
  br i1 %6, label %min.same, label %min.end

min.same:
  %7 = bitcast double %1 to i64
  %8 = icmp slt i64 %7, 0
  %9 = select i1 %8, double %1, double %2
  br label %min.end

min.end:
  %10 = phi double [ 0x7FF8000000000000, %entry ], [ %5, %min.num ], [ %9, %min.same ]
  store double %10, double* %low.addr, align 8
  %11 = load double, double* %one.addr, align 8
  %12 = load double, double* %one.addr, align 8
  %13 = fadd double %11, %12
  %14 = load double, double* %nan.addr, align 8
  %15 = fcmp uno double %13, %14
  br i1 %15, label %max.end, label %max.num

max.num:
  %16 = fcmp ogt double %13, %14
  %17 = select i1 %16, double %13, double %14
  %18 = fcmp oeq double %13, %14
  br i1 %18, label %max.same, label %max.end

max.same:
  %19 = bitcast double %13 to i64
  %20 = icmp slt i64 %19, 0
  %21 = select i1 %20, double %14, double %13
  br label %max.end

max.end:
  %22 = phi double [ 0x7FF8000000000000, %min.end ], [ %17, %max.num ], [ %21, %max.same ]
  store double %22, double* %high.addr, align 8
  %23 = fneg double 0x4010000000000000
  %24 = fdiv double %23, 0x4024000000000000
  %25 = call double @llvm.floor.f64(double %24)
  %26 = fsub double %24, %25
  %27 = fcmp oge double %26, 0x3FE0000000000000
  %28 = fadd double %25, 0x3FF0000000000000
  %29 = select i1 %27, double %28, double %25
  %30 = call double @llvm.copysign.f64(double %29, double %24)
  store double %30, double* %r.addr, align 8
  %31 = load double, double* %low.addr, align 8
  %32 = call i8* @nish_str_from_f64(double %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %34 = load double, double* %high.addr, align 8
  %35 = call i8* @nish_str_from_f64(double %34)
  %36 = call i8* @nish_str_concat(i8* %33, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load double, double* %one.addr, align 8
  %39 = load double, double* %r.addr, align 8
  %40 = fdiv double %38, %39
  %41 = call i8* @nish_str_from_f64(double %40)
  %42 = call i8* @nish_str_concat(i8* %37, i8* %41)
  call void @nish_print(i8* %42)
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
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
