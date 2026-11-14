%frame.nap = type { i32, i32, i32, %frame.nap.rest }
%frame.nap.rest = type { [0 x <2 x i64>], i1, i64, i64 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [0 x <2 x i64>], i8*, i8*, i8*, i1, i64, i1, i64, i64 }

declare void @llvm.trap()
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare nonnull i8* @nish_async_start(i32 noundef, i64 noundef, i8** nonnull) #0
declare void @nish_async_settle(i8* nonnull, i8*, i32 noundef) #0
declare noundef i64 @nish_async_sleep(i32 noundef) #0
declare noundef i32 @nish_async_poll(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define weak_odr hidden i1 @nish.async.task.0(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @nap.resume(i8* %frame)
  ret i1 %done
}

define internal i1 @nap.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nap*
  %async.state = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 0
  %label.at = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 1
  %label = load i32, i32* %label.at
  %ms.at = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 2
  %ms = load i32, i32* %ms.at
  %async.rest = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.nap.rest* %async.rest to i8*
  %ok.addr = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = call i64 @nish_async_sleep(i32 %ms)
  store i64 %0, i64* %async.wait
  br label %wait.poll

wait.poll:
  %1 = load i64, i64* %async.wait
  %2 = call i32 @nish_async_poll(i64 %1)
  %3 = icmp slt i32 %2, 0
  br i1 %3, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %4 = icmp ne i32 %2, 0
  store i1 %4, i1* %ok.addr, align 1
  %5 = load i1, i1* %ok.addr, align 1
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %6 = sub nsw i32 0, %label
  br label %cond.end

cond.end:
  %7 = phi i32 [ %label, %cond.true ], [ %6, %cond.false ]
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %async.reload.0 = load i64, i64* %async.spill.0
  call void @nish_arena_release(i64 %async.reload.0)
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %async.prev = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.prev.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.prev.2 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %none.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %async.wait = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %ok.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 6
  %async.wait.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 7
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 8
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll i32 2, label %wait.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = call i8* @nish_async_start(i32 0, i64 48, i8** %async.prev)
  %1 = getelementptr inbounds i8, i8* %0, i64 32
  %2 = bitcast i8* %1 to { i32, i32, i32 }*
  %3 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %2, i32 0, i32 0
  store i32 0, i32* %3
  %4 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %2, i32 0, i32 1
  store i32 3, i32* %4
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %2, i32 0, i32 2
  store i32 30, i32* %5
  %6 = call i1 @nap.resume(i8* %1)
  %7 = load i8*, i8** %async.prev
  %8 = zext i1 %6 to i32
  call void @nish_async_settle(i8* %0, i8* %7, i32 %8)
  %9 = call i8* @nish_async_start(i32 0, i64 48, i8** %async.prev.1)
  %10 = getelementptr inbounds i8, i8* %9, i64 32
  %11 = bitcast i8* %10 to { i32, i32, i32 }*
  %12 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %11, i32 0, i32 0
  store i32 0, i32* %12
  %13 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %11, i32 0, i32 1
  store i32 1, i32* %13
  %14 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %11, i32 0, i32 2
  store i32 10, i32* %14
  %15 = call i1 @nap.resume(i8* %10)
  %16 = load i8*, i8** %async.prev.1
  %17 = zext i1 %15 to i32
  call void @nish_async_settle(i8* %9, i8* %16, i32 %17)
  %18 = call i8* @nish_async_start(i32 0, i64 48, i8** %async.prev.2)
  %19 = getelementptr inbounds i8, i8* %18, i64 32
  %20 = bitcast i8* %19 to { i32, i32, i32 }*
  %21 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %20, i32 0, i32 0
  store i32 0, i32* %21
  %22 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %20, i32 0, i32 1
  store i32 2, i32* %22
  %23 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %20, i32 0, i32 2
  store i32 20, i32* %23
  %24 = call i1 @nap.resume(i8* %19)
  %25 = load i8*, i8** %async.prev.2
  %26 = zext i1 %24 to i32
  call void @nish_async_settle(i8* %18, i8* %25, i32 %26)
  %27 = call i64 @nish_async_sleep(i32 -1)
  store i64 %27, i64* %async.wait
  br label %wait.poll

wait.poll:
  %28 = load i64, i64* %async.wait
  %29 = call i32 @nish_async_poll(i64 %28)
  %30 = icmp slt i32 %29, 0
  br i1 %30, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %31 = icmp ne i32 %29, 0
  store i1 %31, i1* %none.addr, align 1
  %32 = load i1, i1* %none.addr, align 1
  br i1 %32, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %33 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = call i64 @nish_async_sleep(i32 60)
  store i64 %35, i64* %async.wait.1
  br label %wait.poll.1

wait.poll.1:
  %36 = load i64, i64* %async.wait.1
  %37 = call i32 @nish_async_poll(i64 %36)
  %38 = icmp slt i32 %37, 0
  br i1 %38, label %wait.pending.1, label %wait.ready.1

wait.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

wait.ready.1:
  %39 = icmp ne i32 %37, 0
  store i1 %39, i1* %ok.addr, align 1
  %40 = load i1, i1* %ok.addr, align 1
  br i1 %40, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %41 = phi i32 [ 9, %cond.true.1 ], [ -9, %cond.false.1 ]
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %async.reload.0 = load i64, i64* %async.spill.0
  call void @nish_arena_release(i64 %async.reload.0)
  store i32 0, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %async.main = alloca %frame.nish_main, align 16
  %0 = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.main, i32 0, i32 0
  store i32 0, i32* %0
  %1 = bitcast %frame.nish_main* %async.main to i8*
  br label %async.poll

async.poll:
  %2 = call i1 @nish_main.resume(i8* %1)
  br i1 %2, label %async.done, label %async.wait

async.wait:
  %3 = call i1 @nish.async.run()
  br i1 %3, label %async.poll, label %async.stuck

async.stuck:
  call void @llvm.trap()
  unreachable

async.done:
  call void @nish.async.drain()
  %4 = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.main, i32 0, i32 1
  %5 = load i32, i32* %4
  call void @nish_free_arena()
  ret i32 %5
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

declare i8* @nish_async_next()
declare i8* @nish_async_enter(i8* nonnull)
declare void @nish_async_leave(i8* nonnull, i8*)
declare void @nish_async_done(i8* nonnull)

define hidden i1 @nish.async.run() nounwind "probe-stack"="inline-asm" {
entry:
  br label %loop

loop:
  %node = call i8* @nish_async_next()
  %idle = icmp eq i8* %node, null
  br i1 %idle, label %idle.out, label %got

idle.out:
  ret i1 false

got:
  %kind.at = getelementptr inbounds i8, i8* %node, i64 8
  %kind.ptr = bitcast i8* %kind.at to i32*
  %kind = load i32, i32* %kind.ptr, align 8
  %main = icmp slt i32 %kind, 0
  br i1 %main, label %main.out, label %task

main.out:
  ret i1 true

task:
  %prev = call i8* @nish_async_enter(i8* %node)
  %frame = getelementptr inbounds i8, i8* %node, i64 32
  %finished = call i1 @nish.async.resume(i32 %kind, i8* %frame)
  call void @nish_async_leave(i8* %node, i8* %prev)
  br i1 %finished, label %release, label %loop

release:
  call void @nish_async_done(i8* %node)
  br label %loop
}

define hidden void @nish.async.drain() nounwind "probe-stack"="inline-asm" {
entry:
  br label %loop

loop:
  %woke = call i1 @nish.async.run()
  br i1 %woke, label %loop, label %done

done:
  ret void
}

define internal i1 @nish.async.resume(i32 %kind, i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  switch i32 %kind, label %bad [ i32 0, label %kind.0 ]

kind.0:
  %done.0 = call i1 @nish.async.task.0(i8* %frame)
  ret i1 %done.0

bad:
  call void @llvm.trap()
  unreachable
}
