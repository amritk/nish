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
declare double @llvm.minnum.f64(double, double) #0
declare double @llvm.maxnum.f64(double, double) #0

define internal noundef double @hypot(double noundef %a, double noundef %b) #0 {
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
  %0 = call double @hypot(double 0x4008000000000000, double 0x4010000000000000)
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
  %14 = call i8* @nish_str_from_f64(double %13)
  call void @nish_print(i8* %14)
  %15 = fneg double 0x4004000000000000
  %16 = call double @llvm.floor.f64(double %15)
  %17 = fsub double %15, %16
  %18 = fcmp oge double %17, 0x3FE0000000000000
  %19 = fadd double %16, 0x3FF0000000000000
  %20 = select i1 %18, double %19, double %16
  %21 = call i8* @nish_str_from_f64(double %20)
  call void @nish_print(i8* %21)
  %22 = call double @llvm.floor.f64(double 0x3FDFFFFFFFFFFFFF)
  %23 = fsub double 0x3FDFFFFFFFFFFFFF, %22
  %24 = fcmp oge double %23, 0x3FE0000000000000
  %25 = fadd double %22, 0x3FF0000000000000
  %26 = select i1 %24, double %25, double %22
  %27 = call i8* @nish_str_from_f64(double %26)
  call void @nish_print(i8* %27)
  %28 = fneg double 0x3FF8000000000000
  %29 = call double @llvm.fabs.f64(double %28)
  %30 = call i8* @nish_str_from_f64(double %29)
  call void @nish_print(i8* %30)
  %31 = fneg double 0x4000000000000000
  %32 = call double @llvm.minnum.f64(double 0x3FF8000000000000, double %31)
  %33 = call i8* @nish_str_from_f64(double %32)
  call void @nish_print(i8* %33)
  %34 = fneg double 0x4000000000000000
  %35 = call double @llvm.maxnum.f64(double 0x3FF8000000000000, double %34)
  %36 = call i8* @nish_str_from_f64(double %35)
  call void @nish_print(i8* %36)
  %37 = call double @llvm.pow.f64(double 0x4000000000000000, double 0x4024000000000000)
  %38 = fcmp uno double 0x4024000000000000, 0x4024000000000000
  %39 = call double @llvm.fabs.f64(double 0x4000000000000000)
  %40 = call double @llvm.fabs.f64(double 0x4024000000000000)
  %41 = fcmp oeq double %39, 1.0
  %42 = fcmp oeq double %40, 0x7FF0000000000000
  %43 = and i1 %41, %42
  %44 = or i1 %38, %43
  %45 = select i1 %44, double 0x7FF8000000000000, double %37
  %46 = call i8* @nish_str_from_f64(double %45)
  call void @nish_print(i8* %46)
  %47 = call double @llvm.exp.f64(double 0x0000000000000000)
  %48 = call i8* @nish_str_from_f64(double %47)
  call void @nish_print(i8* %48)
  %49 = call double @llvm.log.f64(double 0x4005BF0A8B145769)
  %50 = call i8* @nish_str_from_f64(double %49)
  call void @nish_print(i8* %50)
  %51 = call double @trig(double 0x0000000000000000)
  %52 = call i8* @nish_str_from_f64(double %51)
  call void @nish_print(i8* %52)
  %53 = call i8* @nish_str_from_f64(double 0x400921FB54442D18)
  call void @nish_print(i8* %53)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
