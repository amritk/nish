@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"one,two\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"one\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"two\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"one,two,three\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"zzz\00" }, align 8

declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noundef i32 @find(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %needle) #0 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %s, i8* %needle)
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %flags.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %flags.addr, align 4
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call zeroext i1 @nish_str_at(i8* %0, i64 0, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = load i32, i32* %flags.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %flags.addr, align 4
  br label %if.end

if.end:
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = bitcast i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*) to i64*
  %8 = load i64, i64* %7, align 8
  %9 = sub i64 %6, %8
  %10 = call zeroext i1 @nish_str_at(i8* %4, i64 %9, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %flags.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 2)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %flags.addr, align 4
  br label %if.end.1

if.end.1:
  %15 = load i8*, i8** %s.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = bitcast i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*) to i64*
  %19 = load i64, i64* %18, align 8
  %20 = sub i64 %17, %19
  %21 = call zeroext i1 @nish_str_at(i8* %15, i64 %20, i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*))
  br i1 %21, label %if.then.2, label %if.end.2

if.then.2:
  %22 = load i32, i32* %flags.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 4)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %24, i32* %flags.addr, align 4
  br label %if.end.2

if.end.2:
  %26 = trunc i64 44 to i8
  store i8 %26, i8* %chr, align 1
  %27 = call i8* @nish_str_new(i8* %chr, i64 1)
  %28 = call zeroext i1 @nish_str_eq(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  br i1 %28, label %if.then.3, label %if.end.3

if.then.3:
  %29 = load i32, i32* %flags.addr, align 4
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 8)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %31, i32* %flags.addr, align 4
  br label %if.end.3

if.end.3:
  %33 = load i8*, i8** %s.addr, align 8
  %34 = call i32 @find(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %35 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %34, i32 1000)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %38 = load i8*, i8** %s.addr, align 8
  %39 = call i32 @find(i8* %38, i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*))
  %40 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %36, i32 %39)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %43 = load i32, i32* %flags.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %45

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then.1 ], [ 0, %if.then.2 ], [ 0, %if.then.3 ], [ 2, %if.end.3 ], [ 0, %ovf.ok.3 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
