@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1

define noundef i32 @test() #0 {
entry:
  %f.addr = alloca double, align 8
  %big.addr = alloca i64, align 8
  %zero.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x4006000000000000, double* %f.addr, align 8
  store i64 5000000000, i64* %big.addr, align 8
  %0 = load double, double* %f.addr, align 8
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load double, double* %f.addr, align 8
  %4 = call i64 @llvm.fptosi.sat.i64.f64(double %3)
  %5 = call i8* @nish_str_from_i64(i64 %4)
  call void @nish_print(i8* %5)
  %6 = load i64, i64* %big.addr, align 8
  %7 = sitofp i64 %6 to double
  %8 = fdiv double %7, 0x4000000000000000
  %9 = call i8* @nish_str_from_f64(double %8)
  call void @nish_print(i8* %9)
  %10 = load i64, i64* %big.addr, align 8
  %11 = trunc i64 %10 to i32
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = sext i32 7 to i64
  %14 = mul nsw i64 %13, 1000000000
  %15 = call i8* @nish_str_from_i64(i64 %14)
  call void @nish_print(i8* %15)
  %16 = load i64, i64* %big.addr, align 8
  %17 = sitofp i64 %16 to double
  %18 = fmul double %17, 0x4024000000000000
  %19 = call i32 @llvm.fptosi.sat.i32.f64(double %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  store double 0x0000000000000000, double* %zero.addr, align 8
  %21 = load double, double* %zero.addr, align 8
  %22 = load double, double* %zero.addr, align 8
  %23 = fdiv double %21, %22
  %24 = call i32 @llvm.fptosi.sat.i32.f64(double %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = fdiv double 0x4008000000000000, 0x4000000000000000
  %27 = call i8* @nish_str_from_f64(double %26)
  call void @nish_print(i8* %27)
  %28 = load double, double* %f.addr, align 8
  %29 = fcmp oeq double 0x4006000000000000, %28
  %30 = select i1 %29, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %30)
  %31 = load double, double* %f.addr, align 8
  %32 = fmul double %31, 0x4010000000000000
  %33 = call i32 @llvm.fptosi.sat.i32.f64(double %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %33
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
