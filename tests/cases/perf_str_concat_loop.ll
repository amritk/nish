@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8

declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @test() #0 {
entry:
  %out.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %tagged.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %rows.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %row.addr = alloca i8*, align 8
  %j.addr = alloca i32, align 4
  %tail.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i8*, i8** %out.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  store i8* %3, i8** %out.addr, align 8
  br label %for.inc

for.inc:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %tagged.addr, align 8
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %6, 2
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i8*, i8** %tagged.addr, align 8
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %9, i8** %tagged.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %n.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %rows.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %12 = load i32, i32* %i.addr.1, align 4
  %13 = icmp slt i32 %12, 2
  br i1 %13, label %for.body.1, label %for.end.1

for.body.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %row.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.2

for.cond.2:
  %14 = load i32, i32* %j.addr, align 4
  %15 = icmp slt i32 %14, 3
  br i1 %15, label %for.body.2, label %for.end.2

for.body.2:
  %16 = load i8*, i8** %row.addr, align 8
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %17, i8** %row.addr, align 8
  br label %for.inc.2

for.inc.2:
  %18 = load i32, i32* %j.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %j.addr, align 4
  br label %for.cond.2

for.end.2:
  %20 = load i32, i32* %rows.addr, align 4
  %21 = load i8*, i8** %row.addr, align 8
  %22 = bitcast i8* %21 to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  %25 = add nsw i32 %20, %24
  store i32 %25, i32* %rows.addr, align 4
  br label %for.inc.1

for.inc.1:
  %26 = load i32, i32* %i.addr.1, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %tail.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %do.body

do.body:
  %28 = load i8*, i8** %tail.addr, align 8
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %29, i8** %tail.addr, align 8
  %30 = load i32, i32* %k.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %k.addr, align 4
  br label %do.cond

do.cond:
  %32 = load i32, i32* %k.addr, align 4
  %33 = icmp slt i32 %32, 2
  br i1 %33, label %do.body, label %do.end

do.end:
  %34 = load i8*, i8** %out.addr, align 8
  %35 = bitcast i8* %34 to i64*
  %36 = load i64, i64* %35, align 8
  %37 = trunc i64 %36 to i32
  %38 = load i8*, i8** %tagged.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = add nsw i32 %37, %41
  %43 = load i32, i32* %rows.addr, align 4
  %44 = add nsw i32 %42, %43
  %45 = load i8*, i8** %tail.addr, align 8
  %46 = bitcast i8* %45 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = trunc i64 %47 to i32
  %49 = add nsw i32 %44, %48
  ret i32 %49
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
