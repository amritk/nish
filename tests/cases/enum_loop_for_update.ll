@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noundef zeroext i1 @first(i32 noundef %n) #0 {
entry:
  %k.addr = alloca i32, align 4
  %r.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  store i32 2, i32* %k.addr, align 4
  store i1 false, i1* %r.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp eq i32 %2, 2
  store i1 %3, i1* %r.addr, align 1
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %for.inc

for.inc:
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %6 = load i1, i1* %r.addr, align 1
  ret i1 %6
}

define internal noundef i32 @counted(i32 noundef %n) #1 {
entry:
  %k.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 2, i32* %k.addr, align 4
  store i32 0, i32* %r.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %k.addr, align 4
  switch i32 %2, label %sw.default [
    i32 2, label %sw.case
    i32 0, label %sw.case.1
  ]

sw.case:
  %3 = load i32, i32* %r.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %r.addr, align 4
  br label %sw.end

sw.case.1:
  %7 = load i32, i32* %r.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 10)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %9, i32* %r.addr, align 4
  br label %sw.end

sw.default:
  %11 = load i32, i32* %r.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 100)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %13, i32* %r.addr, align 4
  br label %sw.end

sw.end:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.inc

for.inc:
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %r.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @changed(i32 noundef %n) #0 {
entry:
  %k.addr = alloca i32, align 4
  %r.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  store i32 2, i32* %k.addr, align 4
  store i1 false, i1* %r.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp ne i32 %2, 2
  store i1 %3, i1* %r.addr, align 1
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %for.inc

for.inc:
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %6 = load i1, i1* %r.addr, align 1
  ret i1 %6
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i1 @first(i32 1)
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %1)
  %2 = call i1 @first(i32 2)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i32 @counted(i32 3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i1 @changed(i32 1)
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %7)
  %8 = call i1 @changed(i32 2)
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
