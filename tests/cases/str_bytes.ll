@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3

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

define noundef i32 @test() #1 {
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
  %10 = mul nsw i32 %9, 1000
  %11 = add nsw i32 %5, %10
  %12 = load i8*, i8** %s.addr, align 8
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @head(i8* %12, i32 99)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = mul nsw i32 %18, 100000
  %20 = add nsw i32 %11, %19
  %21 = load i8*, i8** %s.addr, align 8
  %22 = sub nsw i32 0, 4
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @head(i8* %21, i32 %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = add nsw i32 %20, %28
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %29
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
