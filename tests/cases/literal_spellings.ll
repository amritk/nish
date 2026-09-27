declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0

define void @nish_main() #0 {
entry:
  %exponent.addr = alloca i32, align 4
  %upper.addr = alloca i32, align 4
  %exact.addr = alloca i32, align 4
  %binary.addr = alloca i32, align 4
  %octal.addr = alloca i32, align 4
  %separated.addr = alloca i32, align 4
  %hex.addr = alloca i32, align 4
  %min.addr = alloca i32, align 4
  %wideExponent.addr = alloca i64, align 8
  %wideBinary.addr = alloca i64, align 8
  %wideOctal.addr = alloca i64, align 8
  %floatBinary.addr = alloca double, align 8
  %floatOctal.addr = alloca double, align 8
  %floatExponent.addr = alloca double, align 8
  %floatSeparated.addr = alloca double, align 8
  %rounded.addr = alloca double, align 8
  %byte.addr = alloca i32, align 4
  %signed.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 100000, i32* %exponent.addr, align 4
  store i32 1000, i32* %upper.addr, align 4
  store i32 1, i32* %exact.addr, align 4
  store i32 10, i32* %binary.addr, align 4
  store i32 15, i32* %octal.addr, align 4
  store i32 1000, i32* %separated.addr, align 4
  store i32 65535, i32* %hex.addr, align 4
  %0 = sub nsw i32 0, -2147483648
  store i32 %0, i32* %min.addr, align 4
  %1 = load i32, i32* %exponent.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i32, i32* %upper.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load i32, i32* %exact.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = load i32, i32* %binary.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %octal.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %separated.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load i32, i32* %hex.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load i32, i32* %min.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  store i64 1000000000000000, i64* %wideExponent.addr, align 8
  store i64 68719476735, i64* %wideBinary.addr, align 8
  store i64 68719476735, i64* %wideOctal.addr, align 8
  %17 = load i64, i64* %wideExponent.addr, align 8
  %18 = call i8* @nish_str_from_i64(i64 %17)
  call void @nish_print(i8* %18)
  %19 = load i64, i64* %wideBinary.addr, align 8
  %20 = call i8* @nish_str_from_i64(i64 %19)
  call void @nish_print(i8* %20)
  %21 = load i64, i64* %wideOctal.addr, align 8
  %22 = call i8* @nish_str_from_i64(i64 %21)
  call void @nish_print(i8* %22)
  store double 0x4024000000000000, double* %floatBinary.addr, align 8
  store double 0x402E000000000000, double* %floatOctal.addr, align 8
  store double 0x4097700000000000, double* %floatExponent.addr, align 8
  store double 0x40934A3D70A3D70A, double* %floatSeparated.addr, align 8
  store double 0x4340000000000002, double* %rounded.addr, align 8
  %23 = load double, double* %floatBinary.addr, align 8
  %24 = call i8* @nish_str_from_f64(double %23)
  call void @nish_print(i8* %24)
  %25 = load double, double* %floatOctal.addr, align 8
  %26 = call i8* @nish_str_from_f64(double %25)
  call void @nish_print(i8* %26)
  %27 = load double, double* %floatExponent.addr, align 8
  %28 = call i8* @nish_str_from_f64(double %27)
  call void @nish_print(i8* %28)
  %29 = load double, double* %floatSeparated.addr, align 8
  %30 = call i8* @nish_str_from_f64(double %29)
  call void @nish_print(i8* %30)
  %31 = load double, double* %rounded.addr, align 8
  %32 = call i8* @nish_str_from_f64(double %31)
  call void @nish_print(i8* %32)
  store i32 255, i32* %byte.addr, align 4
  %33 = sub nsw i32 0, 1000
  store i32 %33, i32* %signed.addr, align 4
  %34 = load i32, i32* %byte.addr, align 4
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = load i32, i32* %signed.addr, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = call i8* @nish_str_from_i32(i32 1000)
  call void @nish_print(i8* %38)
  %39 = call i8* @nish_str_from_i64(i64 16)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
