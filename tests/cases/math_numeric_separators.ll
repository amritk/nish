@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %million.addr = alloca i32, align 4
  %mask.addr = alloca i32, align 4
  %big.addr = alloca i64, align 8
  %price.addr = alloca double, align 8
  %tenBillion.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 1000000, i32* %million.addr, align 4
  store i32 65535, i32* %mask.addr, align 4
  store i64 9007199254740991, i64* %big.addr, align 8
  store double 0x40934A3D70A3D70A, double* %price.addr, align 8
  store double 0x4202A05F20000000, double* %tenBillion.addr, align 8
  %0 = load i32, i32* %million.addr, align 4
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = load i32, i32* %mask.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load i64, i64* %big.addr, align 8
  %8 = call i8* @nish_str_from_i64(i64 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  call void @nish_print(i8* %9)
  %10 = load double, double* %price.addr, align 8
  %11 = call i8* @nish_str_from_f64(double %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load double, double* %tenBillion.addr, align 8
  %14 = call i8* @nish_str_from_f64(double %13)
  %15 = call i8* @nish_str_concat(i8* %12, i8* %14)
  call void @nish_print(i8* %15)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
