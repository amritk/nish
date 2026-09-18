declare i32 @abs(i32)
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define noundef i32 @exported(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  %1 = add nsw i32 %0, 1
  ret i32 %1
}

define noundef i32 @internalHelper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define noundef i32 @test() #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i32 @exported(i32 %3)
  %5 = add nsw i32 %2, %4
  store i32 %5, i32* %total.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %8 = load i32, i32* %total.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = call i32 @internalHelper(i32 %9)
  %11 = add nsw i32 %8, %10
  store i32 %11, i32* %total.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %12 = load i32, i32* %j.addr, align 4
  %13 = icmp slt i32 %12, 4
  br i1 %13, label %while.body.1, label %while.end.1

while.body.1:
  %14 = load i32, i32* %total.addr, align 4
  %15 = load i32, i32* %j.addr, align 4
  %16 = sub nsw i32 0, %15
  %17 = call i32 @abs(i32 %16)
  %18 = add nsw i32 %14, %17
  store i32 %18, i32* %total.addr, align 4
  %19 = load i32, i32* %j.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %21 = load i32, i32* %total.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  store i8* %22, i8** %s.addr, align 8
  %23 = load i32, i32* %total.addr, align 4
  %24 = load i8*, i8** %s.addr, align 8
  %25 = bitcast i8* %24 to i64*
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = add nsw i32 %23, %27
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %28
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
