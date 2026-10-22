@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %steps.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  store i32 0, i32* %steps.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = load i8*, i8** %word.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %0, %4
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %steps.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %steps.addr, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %12 = load i32, i32* %k.addr, align 4
  %13 = load i8*, i8** %word.addr, align 8
  %14 = call i64 @nish_str_index_of(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %12, %15
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %k.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %d.addr, align 4
  br label %do.body

do.body:
  %19 = load i32, i32* %d.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %d.addr, align 4
  br label %do.cond

do.cond:
  %23 = load i32, i32* %d.addr, align 4
  %24 = load i8*, i8** %word.addr, align 8
  %25 = bitcast i8* %24 to i64*
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = icmp sge i32 %23, %27
  %29 = xor i1 %28, true
  br i1 %29, label %do.body, label %do.end

do.end:
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %30 = load i32, i32* %i.addr.1, align 4
  %31 = load i8*, i8** %word.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = icmp slt i32 %30, %34
  br i1 %35, label %for.body.1, label %for.end.1

for.body.1:
  %36 = load i8*, i8** %word.addr, align 8
  %37 = load i32, i32* %i.addr.1, align 4
  %38 = sext i32 %37 to i64
  %39 = getelementptr inbounds i8, i8* %36, i64 8
  %40 = getelementptr inbounds i8, i8* %39, i64 %38
  %41 = load i8, i8* %40, align 1
  %42 = zext i8 %41 to i32
  %43 = icmp eq i32 %42, 108
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %sum.addr, align 4
  %45 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 1)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %46, i32* %sum.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %48 = load i32, i32* %i.addr.1, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %50 = load i32, i32* %steps.addr, align 4
  %51 = load i32, i32* %k.addr, align 4
  %52 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %51)
  %53 = extractvalue { i32, i1 } %52, 0
  %54 = extractvalue { i32, i1 } %52, 1
  br i1 %54, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %55 = load i32, i32* %d.addr, align 4
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %59 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %59)
  %60 = load i32, i32* %sum.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
