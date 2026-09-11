@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unbound\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"long \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"short \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"literal\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define internal noundef nonnull align 8 i8* @build(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %0, i8** %s.addr, align 8
  %1 = load i8*, i8** %s.addr, align 8
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %2, i8** %s.addr, align 8
  %3 = load i8*, i8** %s.addr, align 8
  ret i8* %3
}

define noundef i32 @test() #0 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %what.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %0, i8** %a.addr, align 8
  %1 = load i8*, i8** %a.addr, align 8
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %2, i8** %b.addr, align 8
  store i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8** %what.addr, align 8
  %3 = load i8*, i8** %b.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sgt i32 %6, 2
  br i1 %7, label %if.then, label %if.else

if.then:
  %8 = load i8*, i8** %b.addr, align 8
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %8)
  store i8* %9, i8** %what.addr, align 8
  br label %if.end

if.else:
  %10 = load i8*, i8** %b.addr, align 8
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*), i8* %10)
  store i8* %11, i8** %what.addr, align 8
  br label %if.end

if.end:
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %12, i8** %s.addr, align 8
  store i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i8** %s.addr, align 8
  %13 = load i8*, i8** %b.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = load i8*, i8** %what.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = add nsw i32 %16, %20
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = add nsw i32 %21, %25
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @build(i32 1)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = trunc i64 %31 to i32
  %33 = add nsw i32 %26, %32
  ret i32 %33
}

attributes #0 = { nounwind willreturn }
