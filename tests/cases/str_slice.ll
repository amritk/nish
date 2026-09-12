@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello,world\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"world\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noundef nonnull align 8 i8* @cut(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = sext i32 %to to i64
  %4 = icmp ule i64 %2, %3
  %5 = icmp ule i64 %3, %1
  %6 = and i1 %4, %5
  br i1 %6, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %3, i64 %1)
  unreachable

slice.ok:
  %7 = sub i64 %3, %2
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %2
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  ret i8* %10
}

define internal noundef nonnull align 8 i8* @rest(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %from) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = icmp ule i64 %2, %1
  br i1 %3, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %1, i64 %1)
  unreachable

slice.ok:
  %4 = sub i64 %1, %2
  %5 = getelementptr inbounds i8, i8* %s, i64 8
  %6 = getelementptr inbounds i8, i8* %5, i64 %2
  %7 = call i8* @nish_str_new(i8* %6, i64 %4)
  ret i8* %7
}

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %head.addr = alloca i8*, align 8
  %tail.addr = alloca i8*, align 8
  %empty.addr = alloca i8*, align 8
  %whole.addr = alloca i8*, align 8
  %flags.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @cut(i8* %0, i32 0, i32 5)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  store i8* %3, i8** %head.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @rest(i8* %4, i32 6)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  store i8* %7, i8** %tail.addr, align 8
  %8 = load i8*, i8** %s.addr, align 8
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @cut(i8* %8, i32 3, i32 3)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  store i8* %11, i8** %empty.addr, align 8
  %12 = load i8*, i8** %s.addr, align 8
  %13 = load i8*, i8** %s.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @cut(i8* %12, i32 0, i32 %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  store i8* %19, i8** %whole.addr, align 8
  store i32 0, i32* %flags.addr, align 4
  %20 = load i8*, i8** %head.addr, align 8
  %21 = call zeroext i1 @nish_str_eq(i8* %20, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %flags.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %flags.addr, align 4
  br label %if.end

if.end:
  %24 = load i8*, i8** %tail.addr, align 8
  %25 = call zeroext i1 @nish_str_eq(i8* %24, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  %26 = load i32, i32* %flags.addr, align 4
  %27 = add nsw i32 %26, 2
  store i32 %27, i32* %flags.addr, align 4
  br label %if.end.1

if.end.1:
  %28 = load i8*, i8** %empty.addr, align 8
  %29 = call zeroext i1 @nish_str_eq(i8* %28, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  br i1 %29, label %if.then.2, label %if.end.2

if.then.2:
  %30 = load i32, i32* %flags.addr, align 4
  %31 = add nsw i32 %30, 4
  store i32 %31, i32* %flags.addr, align 4
  br label %if.end.2

if.end.2:
  %32 = load i8*, i8** %whole.addr, align 8
  %33 = load i8*, i8** %s.addr, align 8
  %34 = call zeroext i1 @nish_str_eq(i8* %32, i8* %33)
  br i1 %34, label %if.then.3, label %if.end.3

if.then.3:
  %35 = load i32, i32* %flags.addr, align 4
  %36 = add nsw i32 %35, 8
  store i32 %36, i32* %flags.addr, align 4
  br label %if.end.3

if.end.3:
  %37 = load i8*, i8** %s.addr, align 8
  %38 = load i8*, i8** %s.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = call i64 @nish_arena_mark()
  %43 = call i8* @rest(i8* %37, i32 %41)
  %44 = call i8* @nish_arena_keep(i64 %42, i8* %43)
  %45 = call zeroext i1 @nish_str_eq(i8* %44, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  br i1 %45, label %if.then.4, label %if.end.4

if.then.4:
  %46 = load i32, i32* %flags.addr, align 4
  %47 = add nsw i32 %46, 16
  store i32 %47, i32* %flags.addr, align 4
  br label %if.end.4

if.end.4:
  %48 = load i8*, i8** %head.addr, align 8
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = mul nsw i32 %51, 1000
  %53 = load i8*, i8** %tail.addr, align 8
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = trunc i64 %55 to i32
  %57 = mul nsw i32 %56, 100
  %58 = add nsw i32 %52, %57
  %59 = load i32, i32* %flags.addr, align 4
  %60 = add nsw i32 %58, %59
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %60
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
