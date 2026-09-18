@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare i64 @llvm.smin.i64(i64, i64) #2
declare i64 @llvm.smax.i64(i64, i64) #2

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %total.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %step.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %step.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %step.addr, align 4
  store i32 %2, i32* %from.addr, align 4
  %3 = load i32, i32* %step.addr, align 4
  %4 = add nsw i32 %3, 5
  store i32 %4, i32* %to.addr, align 4
  %5 = load i32, i32* %total.addr, align 4
  %6 = load i8*, i8** %s.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = call i64 @llvm.smin.i64(i64 %10, i64 %8)
  %12 = call i64 @llvm.smax.i64(i64 %11, i64 0)
  %13 = load i32, i32* %to.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = call i64 @llvm.smin.i64(i64 %14, i64 %8)
  %16 = call i64 @llvm.smax.i64(i64 %15, i64 0)
  %17 = call i64 @llvm.smin.i64(i64 %12, i64 %16)
  %18 = call i64 @llvm.smax.i64(i64 %12, i64 %16)
  %19 = sub i64 %18, %17
  %20 = getelementptr inbounds i8, i8* %6, i64 8
  %21 = getelementptr inbounds i8, i8* %20, i64 %17
  %22 = call i8* @nish_str_new(i8* %21, i64 %19)
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = add nsw i32 %5, %25
  store i32 %26, i32* %total.addr, align 4
  %27 = load i32, i32* %step.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %step.addr, align 4
  br label %while.cond

while.end:
  %29 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %29
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
