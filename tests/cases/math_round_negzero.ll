@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @llvm.floor.f64(double) #0
declare double @llvm.copysign.f64(double, double) #0

define noundef double @roundHalf(double noundef %x) #0 {
entry:
  %0 = call double @llvm.floor.f64(double %x)
  %1 = fsub double %x, %0
  %2 = fcmp oge double %1, 0x3FE0000000000000
  %3 = fadd double %0, 0x3FF0000000000000
  %4 = select i1 %2, double %3, double %0
  %5 = call double @llvm.copysign.f64(double %4, double %x)
  ret double %5
}

define noundef i32 @nish_main() #1 {
entry:
  %one.addr = alloca double, align 8
  %zero.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %one.addr, align 8
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = fneg double 0x4008000000000000
  %2 = fdiv double %1, 0x4024000000000000
  %3 = call double @roundHalf(double %2)
  %4 = fdiv double %0, %3
  %5 = call i8* @nish_str_from_f64(double %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load double, double* %one.addr, align 8
  %8 = fneg double 0x3FF0000000000000
  %9 = fdiv double %8, 0x4000000000000000
  %10 = call double @roundHalf(double %9)
  %11 = fdiv double %7, %10
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* %6, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load double, double* %one.addr, align 8
  %16 = load double, double* %zero.addr, align 8
  %17 = fneg double %16
  %18 = call double @roundHalf(double %17)
  %19 = fdiv double %15, %18
  %20 = call i8* @nish_str_from_f64(double %19)
  %21 = call i8* @nish_str_concat(i8* %14, i8* %20)
  call void @nish_print(i8* %21)
  %22 = fneg double 0x4014000000000000
  %23 = fdiv double %22, 0x4000000000000000
  %24 = call double @roundHalf(double %23)
  %25 = call i8* @nish_str_from_f64(double %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = fdiv double 0x4014000000000000, 0x4000000000000000
  %28 = call double @roundHalf(double %27)
  %29 = call i8* @nish_str_from_f64(double %28)
  %30 = call i8* @nish_str_concat(i8* %26, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = fneg double 0x401C000000000000
  %33 = fdiv double %32, 0x4024000000000000
  %34 = call double @roundHalf(double %33)
  %35 = call i8* @nish_str_from_f64(double %34)
  %36 = call i8* @nish_str_concat(i8* %31, i8* %35)
  call void @nish_print(i8* %36)
  %37 = load double, double* %one.addr, align 8
  %38 = fdiv double 0x4008000000000000, 0x4024000000000000
  %39 = call double @roundHalf(double %38)
  %40 = fdiv double %37, %39
  %41 = call i8* @nish_str_from_f64(double %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %43 = load double, double* %zero.addr, align 8
  %44 = load double, double* %zero.addr, align 8
  %45 = fdiv double %43, %44
  %46 = call double @roundHalf(double %45)
  %47 = call i8* @nish_str_from_f64(double %46)
  %48 = call i8* @nish_str_concat(i8* %42, i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %50 = load double, double* %one.addr, align 8
  %51 = fneg double %50
  %52 = load double, double* %zero.addr, align 8
  %53 = fdiv double %51, %52
  %54 = call double @roundHalf(double %53)
  %55 = call i8* @nish_str_from_f64(double %54)
  %56 = call i8* @nish_str_concat(i8* %49, i8* %55)
  call void @nish_print(i8* %56)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
