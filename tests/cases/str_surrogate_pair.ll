@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\F0\9F\98\80\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %pair.addr = alloca i8*, align 8
  %braced.addr = alloca i8*, align 8
  %literal.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %pair.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %braced.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %literal.addr, align 8
  %0 = load i8*, i8** %pair.addr, align 8
  %1 = load i8*, i8** %literal.addr, align 8
  %2 = call zeroext i1 @nish_str_eq(i8* %0, i8* %1)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %5 = load i8*, i8** %pair.addr, align 8
  %6 = load i8*, i8** %braced.addr, align 8
  %7 = call zeroext i1 @nish_str_eq(i8* %5, i8* %6)
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %9 = call i8* @nish_str_concat(i8* %4, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %11 = load i8*, i8** %pair.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %10, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %18 = load i8*, i8** %literal.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %17, i8* %22)
  call void @nish_print(i8* %23)
  %24 = load i8*, i8** %literal.addr, align 8
  %25 = call zeroext i1 @nish_str_eq(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %24)
  %26 = select i1 %25, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %28 = load i8*, i8** %literal.addr, align 8
  %29 = call zeroext i1 @nish_str_eq(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %28)
  %30 = select i1 %29, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  call void @nish_print(i8* %31)
  %32 = load i8*, i8** %pair.addr, align 8
  %33 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  call void @nish_print(i8* %34)
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
attributes #2 = { nounwind willreturn memory(argmem: read) }
