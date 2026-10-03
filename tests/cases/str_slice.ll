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
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 2)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %28, i32* %flags.addr, align 4
  br label %if.end.1

if.end.1:
  %30 = load i8*, i8** %empty.addr, align 8
  %31 = call zeroext i1 @nish_str_eq(i8* %30, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  br i1 %31, label %if.then.2, label %if.end.2

if.then.2:
  %32 = load i32, i32* %flags.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 4)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %34, i32* %flags.addr, align 4
  br label %if.end.2

if.end.2:
  %36 = load i8*, i8** %whole.addr, align 8
  %37 = load i8*, i8** %s.addr, align 8
  %38 = call zeroext i1 @nish_str_eq(i8* %36, i8* %37)
  br i1 %38, label %if.then.3, label %if.end.3

if.then.3:
  %39 = load i32, i32* %flags.addr, align 4
  %40 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 8)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %41, i32* %flags.addr, align 4
  br label %if.end.3

if.end.3:
  %43 = load i8*, i8** %s.addr, align 8
  %44 = load i8*, i8** %s.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = call i64 @nish_arena_mark()
  %49 = call i8* @rest(i8* %43, i32 %47)
  %50 = call i8* @nish_arena_keep(i64 %48, i8* %49)
  %51 = call zeroext i1 @nish_str_eq(i8* %50, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  br i1 %51, label %if.then.4, label %if.end.4

if.then.4:
  %52 = load i32, i32* %flags.addr, align 4
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 16)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %54, i32* %flags.addr, align 4
  br label %if.end.4

if.end.4:
  %56 = load i8*, i8** %head.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %59, i32 1000)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %63 = load i8*, i8** %tail.addr, align 8
  %64 = bitcast i8* %63 to i64*
  %65 = load i64, i64* %64, align 8
  %66 = trunc i64 %65 to i32
  %67 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %66, i32 100)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %68)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %73 = load i32, i32* %flags.addr, align 4
  %74 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %73)
  %75 = extractvalue { i32, i1 } %74, 0
  %76 = extractvalue { i32, i1 } %74, 1
  br i1 %76, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %75

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then.1 ], [ 0, %if.then.2 ], [ 0, %if.then.3 ], [ 0, %if.then.4 ], [ 2, %if.end.4 ], [ 2, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 0, %ovf.ok.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
