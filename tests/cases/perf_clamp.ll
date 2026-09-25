%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

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
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %step.addr, align 4
  store i32 %6, i32* %from.addr, align 4
  %7 = load i32, i32* %step.addr, align 4
  %8 = add nsw i32 %7, 5
  store i32 %8, i32* %to.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i8*, i8** %s.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = load i32, i32* %from.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = call i64 @llvm.smin.i64(i64 %14, i64 %12)
  %16 = call i64 @llvm.smax.i64(i64 %15, i64 0)
  %17 = load i32, i32* %to.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = call i64 @llvm.smin.i64(i64 %18, i64 %12)
  %20 = call i64 @llvm.smax.i64(i64 %19, i64 0)
  %21 = call i64 @llvm.smin.i64(i64 %16, i64 %20)
  %22 = call i64 @llvm.smax.i64(i64 %16, i64 %20)
  %23 = sub i64 %22, %21
  %24 = getelementptr inbounds i8, i8* %10, i64 8
  %25 = getelementptr inbounds i8, i8* %24, i64 %21
  %26 = call i8* @nish_str_new(i8* %25, i64 %23)
  %27 = bitcast i8* %26 to i64*
  %28 = load i64, i64* %27, align 8
  %29 = trunc i64 %28 to i32
  %30 = add nsw i32 %9, %29
  store i32 %30, i32* %total.addr, align 4
  %31 = load i32, i32* %step.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %step.addr, align 4
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %34 = load i8*, i8** %33, align 8
  %35 = icmp eq i8* %34, %3
  br i1 %35, label %pass.rewind, label %pass.free

pass.rewind:
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %36, align 8
  br label %pass.done

pass.free:
  %37 = ptrtoint i8* %3 to i64
  %38 = add i64 %37, %5
  call void @nish_arena_release(i64 %38)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %39 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %39
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
