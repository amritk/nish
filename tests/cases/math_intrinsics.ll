declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare double @nish_floor_f64(double) #2
declare double @nish_ceil_f64(double) #2
declare double @nish_trunc_f64(double) #2
declare double @llvm.sqrt.f64(double) #0
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
  %2 = call double @nish_floor_f64(double 0x400599999999999A)
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = call double @nish_ceil_f64(double 0x4000CCCCCCCCCCCD)
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = fneg double 0x400599999999999A
  %7 = call double @nish_trunc_f64(double %6)
  %8 = call i8* @nish_str_from_f64(double %7)
  call void @nish_print(i8* %8)
  %9 = call double @nish_floor_f64(double 0x4004000000000000)
  %10 = fsub double 0x4004000000000000, %9
  %11 = fcmp oge double %10, 0x3FE0000000000000
  %12 = sext i1 %11 to i64
  %13 = and i64 %12, 4607182418800017408
  %14 = bitcast i64 %13 to double
  %15 = fadd double %9, %14
  %16 = call double @llvm.copysign.f64(double %15, double 0x4004000000000000)
  %17 = call i8* @nish_str_from_f64(double %16)
  call void @nish_print(i8* %17)
  %18 = fneg double 0x4004000000000000
  %19 = call double @nish_floor_f64(double %18)
  %20 = fsub double %18, %19
  %21 = fcmp oge double %20, 0x3FE0000000000000
  %22 = sext i1 %21 to i64
  %23 = and i64 %22, 4607182418800017408
  %24 = bitcast i64 %23 to double
  %25 = fadd double %19, %24
  %26 = call double @llvm.copysign.f64(double %25, double %18)
  %27 = call i8* @nish_str_from_f64(double %26)
  call void @nish_print(i8* %27)
  %28 = call double @nish_floor_f64(double 0x3FDFFFFFFFFFFFFF)
  %29 = fsub double 0x3FDFFFFFFFFFFFFF, %28
  %30 = fcmp oge double %29, 0x3FE0000000000000
  %31 = sext i1 %30 to i64
  %32 = and i64 %31, 4607182418800017408
  %33 = bitcast i64 %32 to double
  %34 = fadd double %28, %33
  %35 = call double @llvm.copysign.f64(double %34, double 0x3FDFFFFFFFFFFFFF)
  %36 = call i8* @nish_str_from_f64(double %35)
  call void @nish_print(i8* %36)
  %37 = fneg double 0x3FF8000000000000
  %38 = call double @llvm.fabs.f64(double %37)
  %39 = call i8* @nish_str_from_f64(double %38)
  call void @nish_print(i8* %39)
  %40 = fneg double 0x4000000000000000
  %41 = fcmp uno double 0x3FF8000000000000, %40
  br i1 %41, label %min.end, label %min.num

min.num:
  %42 = fcmp olt double 0x3FF8000000000000, %40
  %43 = select i1 %42, double 0x3FF8000000000000, double %40
  %44 = fcmp oeq double 0x3FF8000000000000, %40
  br i1 %44, label %min.same, label %min.end

min.same:
  %45 = bitcast double 0x3FF8000000000000 to i64
  %46 = icmp slt i64 %45, 0
  %47 = select i1 %46, double 0x3FF8000000000000, double %40
  br label %min.end

min.end:
  %48 = phi double [ 0x7FF8000000000000, %entry ], [ %43, %min.num ], [ %47, %min.same ]
  %49 = call i8* @nish_str_from_f64(double %48)
  call void @nish_print(i8* %49)
  %50 = fneg double 0x4000000000000000
  %51 = fcmp uno double 0x3FF8000000000000, %50
  br i1 %51, label %max.end, label %max.num

max.num:
  %52 = fcmp ogt double 0x3FF8000000000000, %50
  %53 = select i1 %52, double 0x3FF8000000000000, double %50
  %54 = fcmp oeq double 0x3FF8000000000000, %50
  br i1 %54, label %max.same, label %max.end

max.same:
  %55 = bitcast double 0x3FF8000000000000 to i64
  %56 = icmp slt i64 %55, 0
  %57 = select i1 %56, double %50, double 0x3FF8000000000000
  br label %max.end

max.end:
  %58 = phi double [ 0x7FF8000000000000, %min.end ], [ %53, %max.num ], [ %57, %max.same ]
  %59 = call i8* @nish_str_from_f64(double %58)
  call void @nish_print(i8* %59)
  %60 = call double @llvm.pow.f64(double 0x4000000000000000, double 0x4024000000000000)
  %61 = fcmp uno double 0x4024000000000000, 0x4024000000000000
  %62 = call double @llvm.fabs.f64(double 0x4000000000000000)
  %63 = call double @llvm.fabs.f64(double 0x4024000000000000)
  %64 = fcmp oeq double %62, 1.0
  %65 = fcmp oeq double %63, 0x7FF0000000000000
  %66 = and i1 %64, %65
  %67 = or i1 %61, %66
  %68 = select i1 %67, double 0x7FF8000000000000, double %60
  %69 = call i8* @nish_str_from_f64(double %68)
  call void @nish_print(i8* %69)
  %70 = call double @llvm.exp.f64(double 0x0000000000000000)
  %71 = call i8* @nish_str_from_f64(double %70)
  call void @nish_print(i8* %71)
  %72 = call double @llvm.log.f64(double 0x4005BF0A8B145769)
  %73 = call i8* @nish_str_from_f64(double %72)
  call void @nish_print(i8* %73)
  %74 = call double @trig(double 0x0000000000000000)
  %75 = call i8* @nish_str_from_f64(double %74)
  call void @nish_print(i8* %75)
  %76 = call i8* @nish_str_from_f64(double 0x400921FB54442D18)
  call void @nish_print(i8* %76)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(inaccessiblemem: readwrite) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
