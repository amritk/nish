@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %lo.addr = alloca i64, align 8
  %hex.addr = alloca i64, align 8
  %min.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i64 -9007199254740992, i64* %lo.addr, align 8
  store i64 -9007199254740992, i64* %hex.addr, align 8
  %0 = load i64, i64* %lo.addr, align 8
  %1 = shl i64 %0, 10
  store i64 %1, i64* %min.addr, align 8
  %2 = load i64, i64* %lo.addr, align 8
  %3 = call i8* @nish_str_from_i64(i64 %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load i64, i64* %hex.addr, align 8
  %6 = load i64, i64* %lo.addr, align 8
  %7 = icmp eq i64 %5, %6
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %9 = call i8* @nish_str_concat(i8* %4, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load i64, i64* %min.addr, align 8
  %12 = call i8* @nish_str_from_i64(i64 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i64, i64* %min.addr, align 8
  %16 = add nsw i64 %15, 1
  %17 = call i8* @nish_str_from_i64(i64 %16)
  %18 = call i8* @nish_str_concat(i8* %14, i8* %17)
  call void @nish_print(i8* %18)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
