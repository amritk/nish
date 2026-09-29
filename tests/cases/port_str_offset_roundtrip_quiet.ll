@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"=>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"cl\C3\A9: valeur \C3\A0 c\C3\B4t\C3\A9\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"arrow\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A0\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5

define internal noundef nonnull align 8 i8* @afterColon(i8* noundef nonnull noalias readonly align 8 %line) #0 {
entry:
  %at.addr = alloca i32, align 4
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  store i32 %1, i32* %at.addr, align 4
  %2 = load i32, i32* %at.addr, align 4
  %3 = icmp slt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* %line

if.end:
  %4 = bitcast i8* %line to i64*
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %at.addr, align 4
  %7 = add nsw i32 %6, 1
  %8 = sext i32 %7 to i64
  %9 = call i64 @llvm.smin.i64(i64 %8, i64 %5)
  %10 = call i64 @llvm.smax.i64(i64 %9, i64 0)
  %11 = call i64 @llvm.smin.i64(i64 %10, i64 %5)
  %12 = call i64 @llvm.smax.i64(i64 %10, i64 %5)
  %13 = sub i64 %12, %11
  %14 = getelementptr inbounds i8, i8* %line, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %11
  %16 = call i8* @nish_str_new(i8* %15, i64 %13)
  ret i8* %16
}

define internal noundef i32 @countSpaces(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %spaces.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %spaces.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = bitcast i8* %text to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds i8, i8* %text, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  %11 = icmp eq i32 %10, 32
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i32, i32* %spaces.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %spaces.addr, align 4
  br label %if.end

if.end:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %16 = load i32, i32* %spaces.addr, align 4
  ret i32 %16
}

define internal noundef zeroext i1 @hasArrow(i8* noundef nonnull noalias readonly align 8 nocapture %text) #2 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %text, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = sub nsw i32 0, 1
  %3 = icmp ne i32 %1, %2
  ret i1 %3
}

define internal noundef nonnull align 8 i8* @tail(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %from) #0 {
entry:
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = call i64 @llvm.smin.i64(i64 %2, i64 %1)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = bitcast i8* %text to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = sext i32 %7 to i64
  %9 = call i64 @llvm.smin.i64(i64 %8, i64 %1)
  %10 = call i64 @llvm.smax.i64(i64 %9, i64 0)
  %11 = call i64 @llvm.smin.i64(i64 %4, i64 %10)
  %12 = call i64 @llvm.smax.i64(i64 %4, i64 %10)
  %13 = sub i64 %12, %11
  %14 = getelementptr inbounds i8, i8* %text, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %11
  %16 = call i8* @nish_str_new(i8* %15, i64 %13)
  ret i8* %16
}

define noundef i32 @nish_main() #3 {
entry:
  %line.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [23 x i8] }* @.str.2 to i8*), i8** %line.addr, align 8
  %0 = load i8*, i8** %line.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @afterColon(i8* %0)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  call void @nish_print(i8* %3)
  %4 = load i8*, i8** %line.addr, align 8
  %5 = call i32 @countSpaces(i8* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = load i8*, i8** %line.addr, align 8
  %8 = call i1 @hasArrow(i8* %7)
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), %cond.false ]
  call void @nish_print(i8* %9)
  %10 = load i8*, i8** %line.addr, align 8
  %11 = load i8*, i8** %line.addr, align 8
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*))
  %13 = trunc i64 %12 to i32
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @tail(i8* %10, i32 %13)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish_print(i8* %16)
  %17 = load i8*, i8** %line.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = icmp eq i32 %20, 0
  br i1 %21, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind willreturn readnone }
