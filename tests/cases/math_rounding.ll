@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish_round_init, i8* null }]
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" | \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare double @nish_floor(double) #2
declare double @nish_ceil(double) #2
declare double @nish_trunc(double) #2
declare void @nish_round_init() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare double @llvm.copysign.f64(double, double) #2

define internal noundef nonnull align 8 i8* @shown(double noundef %r) #0 {
entry:
  %0 = call i8* @nish_str_from_f64(double %r)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %2 = fdiv double 0x3FF0000000000000, %r
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* %1, i8* %3)
  ret i8* %4
}

define internal void @round$(double noundef %x) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_floor(double %x)
  %1 = fsub double %x, %0
  %2 = fcmp oge double %1, 0x3FE0000000000000
  %3 = fadd double %0, 0x3FF0000000000000
  %4 = select i1 %2, double %3, double %0
  %5 = call double @llvm.copysign.f64(double %4, double %x)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @shown(double %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  call void @nish_print(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @others(double noundef %x) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_floor(double %x)
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @shown(double %0)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %5 = call double @nish_ceil(double %x)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @shown(double %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %4, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %11 = call double @nish_trunc(double %x)
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @shown(double %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  %15 = call i8* @nish_str_concat(i8* %10, i8* %14)
  call void @nish_print(i8* %15)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @test() #0 {
entry:
  %inf.addr = alloca double, align 8
  %0 = fdiv double 0x3FF0000000000000, 0x0000000000000000
  store double %0, double* %inf.addr, align 8
  call void @round$(double 0x0000000000000000)
  %1 = fneg double 0x0000000000000000
  call void @round$(double %1)
  call void @round$(double 0x3FE0000000000000)
  %2 = fneg double 0x3FE0000000000000
  call void @round$(double %2)
  call void @round$(double 0x3FF8000000000000)
  %3 = fneg double 0x3FF8000000000000
  call void @round$(double %3)
  call void @round$(double 0x4004000000000000)
  %4 = fneg double 0x4004000000000000
  call void @round$(double %4)
  call void @round$(double 0x3FDFFFFFFFFFFFFF)
  %5 = fneg double 0x3FDFFFFFFFFFFFFF
  call void @round$(double %5)
  call void @round$(double 0x432FFFFFFFFFFFFF)
  call void @round$(double 0x4330000000000000)
  call void @round$(double 0x4340000000000000)
  %6 = load double, double* %inf.addr, align 8
  call void @round$(double %6)
  %7 = load double, double* %inf.addr, align 8
  %8 = fneg double %7
  call void @round$(double %8)
  %9 = fdiv double 0x0000000000000000, 0x0000000000000000
  call void @round$(double %9)
  %10 = fneg double 0x01A56E1FC2F8F359
  call void @round$(double %10)
  call void @round$(double 0x0000000000000001)
  %11 = fneg double 0x0000000000000001
  call void @round$(double %11)
  call void @round$(double 0x000FFFFFFFFFFFFF)
  call void @others(double 0x0000000000000000)
  %12 = fneg double 0x0000000000000000
  call void @others(double %12)
  %13 = fneg double 0x3FE0000000000000
  call void @others(double %13)
  call void @others(double 0x3FE0000000000000)
  %14 = fneg double 0x01A56E1FC2F8F359
  call void @others(double %14)
  call void @others(double 0x0000000000000001)
  %15 = fneg double 0x0000000000000001
  call void @others(double %15)
  call void @others(double 0x000FFFFFFFFFFFFF)
  %16 = fneg double 0x400599999999999A
  call void @others(double %16)
  call void @others(double 0x400599999999999A)
  call void @others(double 0x432FFFFFFFFFFFFF)
  %17 = fneg double 0x432FFFFFFFFFFFFF
  call void @others(double %17)
  call void @others(double 0x4340000000000000)
  %18 = load double, double* %inf.addr, align 8
  call void @others(double %18)
  %19 = load double, double* %inf.addr, align 8
  %20 = fneg double %19
  call void @others(double %20)
  %21 = fdiv double 0x0000000000000000, 0x0000000000000000
  call void @others(double %21)
  ret i32 0
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
