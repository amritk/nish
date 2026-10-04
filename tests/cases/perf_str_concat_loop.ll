%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %30, i32* %rows.addr, align 4
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %33 = load i8*, i8** %32, align 8
  %34 = icmp eq i8* %33, %15
  br i1 %34, label %pass.rewind, label %pass.free

pass.rewind:
  %35 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %17, i64* %35, align 8
  br label %pass.done

pass.free:
  %36 = ptrtoint i8* %15 to i64
  %37 = add i64 %36, %17
  call void @nish_arena_release(i64 %37)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %38 = load i32, i32* %i.addr.1, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %tail.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %do.body

do.body:
  %40 = load i8*, i8** %tail.addr, align 8
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %41, i8** %tail.addr, align 8
  %42 = load i32, i32* %k.addr, align 4
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 1)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %44, i32* %k.addr, align 4
  br label %do.cond

do.cond:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp slt i32 %46, 2
  br i1 %47, label %do.body, label %do.end

do.end:
  %48 = load i8*, i8** %out.addr, align 8
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = load i8*, i8** %tagged.addr, align 8
  %53 = bitcast i8* %52 to i64*
  %54 = load i64, i64* %53, align 8
  %55 = trunc i64 %54 to i32
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %59 = load i32, i32* %rows.addr, align 4
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %59)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %63 = load i8*, i8** %tail.addr, align 8
  %64 = bitcast i8* %63 to i64*
  %65 = load i64, i64* %64, align 8
  %66 = trunc i64 %65 to i32
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %68

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
