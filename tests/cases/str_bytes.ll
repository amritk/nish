@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3

define noundef i32 @firstByte(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds i8, i8* %s, i64 8
  %4 = getelementptr inbounds i8, i8* %3, i64 0
  %5 = load i8, i8* %4, align 1
  %6 = zext i8 %5 to i32
  ret i32 %6
}

define noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @llvm.smin.i64(i64 0, i64 %1)
  %3 = call i64 @llvm.smax.i64(i64 %2, i64 0)
  %4 = sext i32 %n to i64
  %5 = call i64 @llvm.smin.i64(i64 %4, i64 %1)
  %6 = call i64 @llvm.smax.i64(i64 %5, i64 0)
  %7 = call i64 @llvm.smin.i64(i64 %3, i64 %6)
  %8 = call i64 @llvm.smax.i64(i64 %3, i64 %6)
  %9 = sub i64 %8, %7
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 %7
  %12 = call i8* @amrit_str_new(i8* %11, i64 %9)
  ret i8* %12
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %h.addr = alloca i8*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call i8* @head(i8* %0, i32 2)
  store i8* %1, i8** %h.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = call i32 @firstByte(i8* %2)
  %4 = load i8*, i8** %h.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = mul i32 %7, 1000
  %9 = add i32 %3, %8
  %10 = load i8*, i8** %s.addr, align 8
  %11 = call i8* @head(i8* %10, i32 99)
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = mul i32 %14, 100000
  %16 = add i32 %9, %15
  %17 = load i8*, i8** %s.addr, align 8
  %18 = sub i32 0, 4
  %19 = call i8* @head(i8* %17, i32 %18)
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = add i32 %16, %22
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %23
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
