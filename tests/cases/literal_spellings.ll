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
  store i32 -2147483648, i32* %min.addr, align 4
  %0 = load i32, i32* %exponent.addr, align 4
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = load i32, i32* %upper.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load i32, i32* %exact.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i32, i32* %binary.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load i32, i32* %octal.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = load i32, i32* %separated.addr, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load i32, i32* %hex.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load i32, i32* %min.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  store i64 1000000000000000, i64* %wideExponent.addr, align 8
  store i64 68719476735, i64* %wideBinary.addr, align 8
  store i64 68719476735, i64* %wideOctal.addr, align 8
  %16 = load i64, i64* %wideExponent.addr, align 8
  %17 = call i8* @nish_str_from_i64(i64 %16)
  call void @nish_print(i8* %17)
  %18 = load i64, i64* %wideBinary.addr, align 8
  %19 = call i8* @nish_str_from_i64(i64 %18)
  call void @nish_print(i8* %19)
  %20 = load i64, i64* %wideOctal.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  call void @nish_print(i8* %21)
  store double 0x4024000000000000, double* %floatBinary.addr, align 8
  store double 0x402E000000000000, double* %floatOctal.addr, align 8
  store double 0x4097700000000000, double* %floatExponent.addr, align 8
  store double 0x40934A3D70A3D70A, double* %floatSeparated.addr, align 8
  store double 0x4340000000000002, double* %rounded.addr, align 8
  %22 = load double, double* %floatBinary.addr, align 8
  %23 = call i8* @nish_str_from_f64(double %22)
  call void @nish_print(i8* %23)
  %24 = load double, double* %floatOctal.addr, align 8
  %25 = call i8* @nish_str_from_f64(double %24)
  call void @nish_print(i8* %25)
  %26 = load double, double* %floatExponent.addr, align 8
  %27 = call i8* @nish_str_from_f64(double %26)
  call void @nish_print(i8* %27)
  %28 = load double, double* %floatSeparated.addr, align 8
  %29 = call i8* @nish_str_from_f64(double %28)
  call void @nish_print(i8* %29)
  %30 = load double, double* %rounded.addr, align 8
  %31 = call i8* @nish_str_from_f64(double %30)
  call void @nish_print(i8* %31)
  store i32 255, i32* %byte.addr, align 4
  store i32 -1000, i32* %signed.addr, align 4
  %32 = load i32, i32* %byte.addr, align 4
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = load i32, i32* %signed.addr, align 4
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = call i8* @nish_str_from_i32(i32 1000)
  call void @nish_print(i8* %36)
  %37 = call i8* @nish_str_from_i64(i64 16)
  call void @nish_print(i8* %37)
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
