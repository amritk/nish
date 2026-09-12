@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"ab cd ef\00" }, align 8

define internal noundef zeroext i1 @isAlpha(i32 noundef %c) #0 {
entry:
  %0 = icmp sge i32 %c, 97
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %c, 122
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %words.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %words.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %0, %4
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i8*, i8** %s.addr, align 8
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds i8, i8* %6, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1
  %12 = zext i8 %11 to i32
  %13 = call i1 @isAlpha(i32 %12)
  br i1 %13, label %if.then, label %if.else

if.then:
  %14 = load i32, i32* %words.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %words.addr, align 4
  br label %while.cond.1

while.cond.1:
  %16 = load i32, i32* %i.addr, align 4
  %17 = load i8*, i8** %s.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = icmp slt i32 %16, %20
  br i1 %21, label %land.rhs, label %land.end

land.rhs:
  %22 = load i8*, i8** %s.addr, align 8
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds i8, i8* %22, i64 8
  %26 = getelementptr inbounds i8, i8* %25, i64 %24
  %27 = load i8, i8* %26, align 1
  %28 = zext i8 %27 to i32
  %29 = call i1 @isAlpha(i32 %28)
  br label %land.end

land.end:
  %30 = phi i1 [ false, %while.cond.1 ], [ %29, %land.rhs ]
  br i1 %30, label %while.body.1, label %while.end.1

while.body.1:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  br label %if.end

if.else:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %if.end

if.end:
  br label %while.cond

while.end:
  %35 = load i32, i32* %words.addr, align 4
  ret i32 %35
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind readonly }
