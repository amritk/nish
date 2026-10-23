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
declare double @llvm.minimum.f64(double, double) #0
declare double @llvm.maximum.f64(double, double) #0
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
  %35 = call double @llvm.minimum.f64(double 0x3FF8000000000000, double %34)
  %36 = call i8* @nish_str_from_f64(double %35)
  call void @nish_print(i8* %36)
  %37 = fneg double 0x4000000000000000
  %38 = call double @llvm.maximum.f64(double 0x3FF8000000000000, double %37)
  %39 = call i8* @nish_str_from_f64(double %38)
  call void @nish_print(i8* %39)
  %40 = call double @llvm.pow.f64(double 0x4000000000000000, double 0x4024000000000000)
  %41 = fcmp uno double 0x4024000000000000, 0x4024000000000000
  %42 = call double @llvm.fabs.f64(double 0x4000000000000000)
  %43 = call double @llvm.fabs.f64(double 0x4024000000000000)
  %44 = fcmp oeq double %42, 1.0
  %45 = fcmp oeq double %43, 0x7FF0000000000000
  %46 = and i1 %44, %45
  %47 = or i1 %41, %46
  %48 = select i1 %47, double 0x7FF8000000000000, double %40
  %49 = call i8* @nish_str_from_f64(double %48)
  call void @nish_print(i8* %49)
  %50 = call double @llvm.exp.f64(double 0x0000000000000000)
  %51 = call i8* @nish_str_from_f64(double %50)
  call void @nish_print(i8* %51)
  %52 = call double @llvm.log.f64(double 0x4005BF0A8B145769)
  %53 = call i8* @nish_str_from_f64(double %52)
  call void @nish_print(i8* %53)
  %54 = call double @trig(double 0x0000000000000000)
  %55 = call i8* @nish_str_from_f64(double %54)
  call void @nish_print(i8* %55)
  %56 = call i8* @nish_str_from_f64(double 0x400921FB54442D18)
  call void @nish_print(i8* %56)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
