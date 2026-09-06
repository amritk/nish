@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @sts_free_arena() #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define noundef i32 @sts_main() #0 {
entry:
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %0 = sub i32 0, -2147483648
  store i32 %0, i32* %lo.addr, align 4
  store i32 2147483647, i32* %hi.addr, align 4
  %1 = load i32, i32* %lo.addr, align 4
  %2 = call i8* @sts_str_from_i32(i32 %1)
  %3 = call i8* @sts_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = load i32, i32* %hi.addr, align 4
  %5 = call i8* @sts_str_from_i32(i32 %4)
  %6 = call i8* @sts_str_concat(i8* %3, i8* %5)
  %7 = call i8* @sts_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load i32, i32* %lo.addr, align 4
  %9 = load i32, i32* %hi.addr, align 4
  %10 = add i32 %8, %9
  %11 = call i8* @sts_str_from_i32(i32 %10)
  %12 = call i8* @sts_str_concat(i8* %7, i8* %11)
  call void @sts_print(i8* %12)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
