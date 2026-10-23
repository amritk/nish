@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare double @llvm.copysign.f64(double, double) #0

define noundef double @signF64(double noundef %x) #0 {
entry:
  %0 = call double @llvm.copysign.f64(double 1.0, double %x)
  %1 = fcmp ueq double %x, 0.0
  %2 = select i1 %1, double %x, double %0
  ret double %2
}

define noundef i32 @signI32(i32 noundef %x) #0 {
entry:
  %0 = icmp sgt i32 %x, 0
  %1 = icmp slt i32 %x, 0
  %2 = zext i1 %0 to i32
  %3 = zext i1 %1 to i32
  %4 = sub i32 %2, %3
  ret i32 %4
}

define noundef i32 @signU32(i32 noundef %x) #0 {
entry:
  %0 = icmp ne i32 %x, 0
  %1 = zext i1 %0 to i32
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %top.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = fneg double 0x4004000000000000
  %1 = call double @signF64(double %0)
  %2 = call i8* @nish_str_from_f64(double %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = call double @signF64(double 0x401C000000000000)
  %5 = call i8* @nish_str_from_f64(double %4)
  %6 = call i8* @nish_str_concat(i8* %3, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load double, double* %zero.addr, align 8
  %9 = call double @signF64(double %8)
  %10 = call i8* @nish_str_from_f64(double %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load double, double* %one.addr, align 8
  %14 = load double, double* %zero.addr, align 8
  %15 = fneg double %14
  %16 = call double @signF64(double %15)
  %17 = fdiv double %13, %16
  %18 = call i8* @nish_str_from_f64(double %17)
  %19 = call i8* @nish_str_concat(i8* %12, i8* %18)
  call void @nish_print(i8* %19)
  %20 = load double, double* %zero.addr, align 8
  %21 = load double, double* %zero.addr, align 8
  %22 = fdiv double %20, %21
  %23 = call double @signF64(double %22)
  %24 = call i8* @nish_str_from_f64(double %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %26 = load double, double* %one.addr, align 8
  %27 = fneg double %26
  %28 = load double, double* %zero.addr, align 8
  %29 = fdiv double %27, %28
  %30 = call double @signF64(double %29)
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %25, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @signI32(i32 -42)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = call i32 @signI32(i32 0)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %35, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = call i32 @signI32(i32 2147483647)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %39, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = call i32 @signI32(i32 -2147483648)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  call void @nish_print(i8* %46)
  store i32 4294967295, i32* %top.addr, align 4
  %47 = load i32, i32* %top.addr, align 4
  %48 = call i32 @signU32(i32 %47)
  %49 = zext i32 %48 to i64
  %50 = call i8* @nish_str_from_u64(i64 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = call i32 @signU32(i32 0)
  %53 = zext i32 %52 to i64
  %54 = call i8* @nish_str_from_u64(i64 %53)
  %55 = call i8* @nish_str_concat(i8* %51, i8* %54)
  call void @nish_print(i8* %55)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
