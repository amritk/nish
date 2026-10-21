%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @pick(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = icmp eq i32 %n, 1
  br i1 %1, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %2 = phi i32 [ 1, %cond.true.1 ], [ 2, %cond.false.1 ]
  br label %cond.end

cond.end:
  %3 = phi i32 [ 0, %cond.true ], [ %2, %cond.end.1 ]
  ret i32 %3
}

define internal noundef i32 @reassigned(i32 noundef %k) #0 {
entry:
  %m.addr = alloca i32, align 4
  store i32 %k, i32* %m.addr, align 4
  %0 = load i32, i32* %m.addr, align 4
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i32 @pick(i32 2)
  store i32 %2, i32* %m.addr, align 4
  %3 = load i32, i32* %m.addr, align 4
  %4 = icmp eq i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  ret i32 %5

if.end:
  ret i32 0
}

define internal noundef i32 @looped(i32 noundef %k) #1 {
entry:
  %m.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 %k, i32* %m.addr, align 4
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %m.addr, align 4
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %n.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp sgt i32 %6, 3
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  store i32 %8, i32* %m.addr, align 4
  br label %while.cond

while.end:
  %9 = load i32, i32* %n.addr, align 4
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @exhausted(i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 2

if.end.1:
  %2 = icmp eq i32 %k, 2
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 3

if.end.2:
  %3 = icmp eq i32 %k, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 4, %cond.true ], [ 5, %cond.false ]
  ret i32 %4
}

define internal noundef i32 @branches(i32 noundef %k) #0 {
entry:
  %0 = icmp ne i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 10, %cond.true ], [ 20, %cond.false ]
  ret i32 %2

if.end:
  %3 = icmp eq i32 %k, 0
  br i1 %3, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 30, %cond.true.1 ], [ 40, %cond.false.1 ]
  ret i32 %4
}

define internal noundef i32 @switched(i32 noundef %k) #0 {
entry:
  switch i32 %k, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 100

sw.case.1:
  %0 = icmp eq i32 %k, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 200, %cond.true ], [ 0, %cond.false ]
  ret i32 %1

sw.default:
  %2 = icmp eq i32 %k, 2
  br i1 %2, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %3 = phi i32 [ 300, %cond.true.1 ], [ 0, %cond.false.1 ]
  ret i32 %3
}

define void @nish_main() #1 {
entry:
  %i.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i32 @pick(i32 %6)
  store i32 %7, i32* %k.addr, align 4
  %8 = load i32, i32* %k.addr, align 4
  %9 = call i32 @reassigned(i32 %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %k.addr, align 4
  %12 = call i32 @looped(i32 %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load i32, i32* %k.addr, align 4
  %15 = call i32 @exhausted(i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load i32, i32* %k.addr, align 4
  %18 = call i32 @branches(i32 %17)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = load i32, i32* %k.addr, align 4
  %21 = call i32 @switched(i32 %20)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %26 = load i8*, i8** %25, align 8
  %27 = icmp eq i8* %26, %3
  br i1 %27, label %pass.rewind, label %pass.free

pass.rewind:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %28, align 8
  br label %pass.done

pass.free:
  %29 = ptrtoint i8* %3 to i64
  %30 = add i64 %29, %5
  call void @nish_arena_release(i64 %30)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
