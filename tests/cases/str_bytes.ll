@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @firstByte(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds i8, i8* %s, i64 8
  %4 = getelementptr inbounds i8, i8* %3, i64 0
  %5 = load i8, i8* %4, align 1
  %6 = zext i8 %5 to i32
  ret i32 %6
}

define internal noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %n to i64
  %3 = call i64 @llvm.smin.i64(i64 %2, i64 %1)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = call i64 @llvm.smin.i64(i64 0, i64 %4)
  %6 = call i64 @llvm.smax.i64(i64 0, i64 %4)
  %7 = sub i64 %6, %5
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %5
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  ret i8* %10
}

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %h.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @head(i8* %0, i32 2)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  store i8* %3, i8** %h.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = call i32 @firstByte(i8* %4)
  %6 = load i8*, i8** %h.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 1000)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %11)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %16 = load i8*, i8** %s.addr, align 8
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @head(i8* %16, i32 99)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %22, i32 100000)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %24)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %29 = load i8*, i8** %s.addr, align 8
  %30 = call i64 @nish_arena_mark()
  %31 = call i8* @head(i8* %29, i32 -4)
  %32 = call i8* @nish_arena_keep(i64 %30, i8* %31)
  %33 = bitcast i8* %32 to i64*
  %34 = load i64, i64* %33, align 8
  %35 = trunc i64 %34 to i32
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %37

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
