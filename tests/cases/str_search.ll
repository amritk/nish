@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"one,two\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"one\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"two\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"one,two,three\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"zzz\00" }, align 8

declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @amrit_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #2

define noundef i32 @find(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %needle) #0 {
entry:
  %str.at = alloca i64, align 8
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = bitcast i8* %needle to i64*
  %3 = load i64, i64* %2, align 8
  store i64 0, i64* %str.at, align 8
  br label %str.find

str.find:
  %4 = load i64, i64* %str.at, align 8
  %5 = add i64 %4, %3
  %6 = icmp ule i64 %5, %1
  br i1 %6, label %str.probe, label %str.miss

str.probe:
  %7 = call zeroext i1 @amrit_str_at(i8* %s, i64 %4, i8* %needle)
  br i1 %7, label %str.found, label %str.next

str.next:
  %8 = add i64 %4, 1
  store i64 %8, i64* %str.at, align 8
  br label %str.find

str.miss:
  br label %str.found

str.found:
  %9 = phi i64 [ %4, %str.probe ], [ -1, %str.miss ]
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %flags.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %arena.mark = call i64 @amrit_arena_mark()
  store i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %flags.addr, align 4
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call zeroext i1 @amrit_str_at(i8* %0, i64 0, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = load i32, i32* %flags.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %flags.addr, align 4
  br label %if.end

if.end:
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = bitcast i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*) to i64*
  %8 = load i64, i64* %7, align 8
  %9 = sub i64 %6, %8
  %10 = call zeroext i1 @amrit_str_at(i8* %4, i64 %9, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %flags.addr, align 4
  %12 = add i32 %11, 2
  store i32 %12, i32* %flags.addr, align 4
  br label %if.end.1

if.end.1:
  %13 = load i8*, i8** %s.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = bitcast i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*) to i64*
  %17 = load i64, i64* %16, align 8
  %18 = sub i64 %15, %17
  %19 = call zeroext i1 @amrit_str_at(i8* %13, i64 %18, i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*))
  br i1 %19, label %if.then.2, label %if.end.2

if.then.2:
  %20 = load i32, i32* %flags.addr, align 4
  %21 = add i32 %20, 4
  store i32 %21, i32* %flags.addr, align 4
  br label %if.end.2

if.end.2:
  %22 = trunc i64 44 to i8
  store i8 %22, i8* %chr, align 1
  %23 = call i8* @amrit_str_new(i8* %chr, i64 1)
  %24 = call zeroext i1 @amrit_str_eq(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  br i1 %24, label %if.then.3, label %if.end.3

if.then.3:
  %25 = load i32, i32* %flags.addr, align 4
  %26 = add i32 %25, 8
  store i32 %26, i32* %flags.addr, align 4
  br label %if.end.3

if.end.3:
  %27 = load i8*, i8** %s.addr, align 8
  %28 = call i32 @find(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %29 = mul i32 %28, 1000
  %30 = load i8*, i8** %s.addr, align 8
  %31 = call i32 @find(i8* %30, i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*))
  %32 = add i32 %29, %31
  %33 = load i32, i32* %flags.addr, align 4
  %34 = add i32 %32, %33
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %34
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
