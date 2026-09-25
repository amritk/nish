%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_arena_release(i64 noundef) #1
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
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %15 = load i8*, i8** %14, align 8
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %17 = load i64, i64* %16, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %row.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.2

for.cond.2:
  %18 = load i32, i32* %j.addr, align 4
  %19 = icmp slt i32 %18, 3
  br i1 %19, label %for.body.2, label %for.end.2

for.body.2:
  %20 = load i8*, i8** %row.addr, align 8
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %21, i8** %row.addr, align 8
  br label %for.inc.2

for.inc.2:
  %22 = load i32, i32* %j.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %j.addr, align 4
  br label %for.cond.2

for.end.2:
  %24 = load i32, i32* %rows.addr, align 4
  %25 = load i8*, i8** %row.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = add nsw i32 %24, %28
  store i32 %29, i32* %rows.addr, align 4
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %31 = load i8*, i8** %30, align 8
  %32 = icmp eq i8* %31, %15
  br i1 %32, label %pass.rewind, label %pass.free

pass.rewind:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %17, i64* %33, align 8
  br label %pass.done

pass.free:
  %34 = ptrtoint i8* %15 to i64
  %35 = add i64 %34, %17
  call void @nish_arena_release(i64 %35)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %36 = load i32, i32* %i.addr.1, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %tail.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %do.body

do.body:
  %38 = load i8*, i8** %tail.addr, align 8
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %39, i8** %tail.addr, align 8
  %40 = load i32, i32* %k.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %k.addr, align 4
  br label %do.cond

do.cond:
  %42 = load i32, i32* %k.addr, align 4
  %43 = icmp slt i32 %42, 2
  br i1 %43, label %do.body, label %do.end

do.end:
  %44 = load i8*, i8** %out.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = load i8*, i8** %tagged.addr, align 8
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = add nsw i32 %47, %51
  %53 = load i32, i32* %rows.addr, align 4
  %54 = add nsw i32 %52, %53
  %55 = load i8*, i8** %tail.addr, align 8
  %56 = bitcast i8* %55 to i64*
  %57 = load i64, i64* %56, align 8
  %58 = trunc i64 %57 to i32
  %59 = add nsw i32 %54, %58
  ret i32 %59
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
