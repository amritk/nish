declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare double @llvm.sqrt.f64(double) #0
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare double @llvm.trunc.f64(double) #0
declare double @llvm.sin.f64(double) #0
declare double @llvm.cos.f64(double) #0
declare double @llvm.exp.f64(double) #0
declare double @llvm.log.f64(double) #0
declare double @llvm.fabs.f64(double) #0
declare double @llvm.pow.f64(double, double) #0
declare double @llvm.copysign.f64(double, double) #0

define internal noundef double @hypot$(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fmul double %a, %a
  %1 = fmul double %b, %b
  %2 = fadd double %0, %1
  %3 = call double @llvm.sqrt.f64(double %2)
  ret double %3
}

define internal noundef double @trig(double noundef %x) #0 {
entry:
  %0 = call double @llvm.sin.f64(double %x)
  %1 = call double @llvm.cos.f64(double %x)
  %2 = fadd double %0, %1
  ret double %2
}

define noundef i32 @test() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @hypot$(double 0x4008000000000000, double 0x4010000000000000)
  %1 = call i8* @nish_str_from_f64(double %0)
  call void @nish_print(i8* %1)
  %2 = call double @llvm.floor.f64(double 0x400599999999999A)
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = call double @llvm.ceil.f64(double 0x4000CCCCCCCCCCCD)
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = fneg double 0x400599999999999A
  %7 = call double @llvm.trunc.f64(double %6)
  %8 = call i8* @nish_str_from_f64(double %7)
  call void @nish_print(i8* %8)
  %9 = call double @llvm.floor.f64(double 0x4004000000000000)
  %10 = fsub double 0x4004000000000000, %9
  %11 = fcmp oge double %10, 0x3FE0000000000000
  %12 = fadd double %9, 0x3FF0000000000000
  %13 = select i1 %11, double %12, double %9
  %14 = call double @llvm.copysign.f64(double %13, double 0x4004000000000000)
  %15 = call i8* @nish_str_from_f64(double %14)
  call void @nish_print(i8* %15)
  %16 = fneg double 0x4004000000000000
  %17 = call double @llvm.floor.f64(double %16)
  %18 = fsub double %16, %17
  %19 = fcmp oge double %18, 0x3FE0000000000000
  %20 = fadd double %17, 0x3FF0000000000000
  %21 = select i1 %19, double %20, double %17
  %22 = call double @llvm.copysign.f64(double %21, double %16)
  %23 = call i8* @nish_str_from_f64(double %22)
  call void @nish_print(i8* %23)
  %24 = call double @llvm.floor.f64(double 0x3FDFFFFFFFFFFFFF)
  %25 = fsub double 0x3FDFFFFFFFFFFFFF, %24
  %26 = fcmp oge double %25, 0x3FE0000000000000
  %27 = fadd double %24, 0x3FF0000000000000
  %28 = select i1 %26, double %27, double %24
  %29 = call double @llvm.copysign.f64(double %28, double 0x3FDFFFFFFFFFFFFF)
  %30 = call i8* @nish_str_from_f64(double %29)
  call void @nish_print(i8* %30)
  %31 = fneg double 0x3FF8000000000000
  %32 = call double @llvm.fabs.f64(double %31)
  %33 = call i8* @nish_str_from_f64(double %32)
  call void @nish_print(i8* %33)
  %34 = fneg double 0x4000000000000000
  %35 = fcmp uno double 0x3FF8000000000000, %34
  br i1 %35, label %min.end, label %min.num

min.num:
  %36 = fcmp olt double 0x3FF8000000000000, %34
  %37 = select i1 %36, double 0x3FF8000000000000, double %34
  %38 = fcmp oeq double 0x3FF8000000000000, %34
  br i1 %38, label %min.same, label %min.end

min.same:
  %39 = bitcast double 0x3FF8000000000000 to i64
  %40 = icmp slt i64 %39, 0
  %41 = select i1 %40, double 0x3FF8000000000000, double %34
  br label %min.end

min.end:
  %42 = phi double [ 0x7FF8000000000000, %entry ], [ %37, %min.num ], [ %41, %min.same ]
  %43 = call i8* @nish_str_from_f64(double %42)
  call void @nish_print(i8* %43)
  %44 = fneg double 0x4000000000000000
  %45 = fcmp uno double 0x3FF8000000000000, %44
  br i1 %45, label %max.end, label %max.num

max.num:
  %46 = fcmp ogt double 0x3FF8000000000000, %44
  %47 = select i1 %46, double 0x3FF8000000000000, double %44
  %48 = fcmp oeq double 0x3FF8000000000000, %44
  br i1 %48, label %max.same, label %max.end

max.same:
  %49 = bitcast double 0x3FF8000000000000 to i64
  %50 = icmp slt i64 %49, 0
  %51 = select i1 %50, double %44, double 0x3FF8000000000000
  br label %max.end

max.end:
  %52 = phi double [ 0x7FF8000000000000, %min.end ], [ %47, %max.num ], [ %51, %max.same ]
  %53 = call i8* @nish_str_from_f64(double %52)
  call void @nish_print(i8* %53)
  %54 = call double @llvm.pow.f64(double 0x4000000000000000, double 0x4024000000000000)
  %55 = fcmp uno double 0x4024000000000000, 0x4024000000000000
  %56 = call double @llvm.fabs.f64(double 0x4000000000000000)
  %57 = call double @llvm.fabs.f64(double 0x4024000000000000)
  %58 = fcmp oeq double %56, 1.0
  %59 = fcmp oeq double %57, 0x7FF0000000000000
  %60 = and i1 %58, %59
  %61 = or i1 %55, %60
  %62 = select i1 %61, double 0x7FF8000000000000, double %54
  %63 = call i8* @nish_str_from_f64(double %62)
  call void @nish_print(i8* %63)
  %64 = call double @llvm.exp.f64(double 0x0000000000000000)
  %65 = call i8* @nish_str_from_f64(double %64)
  call void @nish_print(i8* %65)
  %66 = call double @llvm.log.f64(double 0x4005BF0A8B145769)
  %67 = call i8* @nish_str_from_f64(double %66)
  call void @nish_print(i8* %67)
  %68 = call double @trig(double 0x0000000000000000)
  %69 = call i8* @nish_str_from_f64(double %68)
  call void @nish_print(i8* %69)
  %70 = call i8* @nish_str_from_f64(double 0x400921FB54442D18)
  call void @nish_print(i8* %70)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
