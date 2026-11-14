%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [0 x <2 x i64>] }
%frame.later$fn.5.shout = type { i32, i8*, i32, %frame.later$fn.5.shout.rest }
%frame.later$fn.5.shout.rest = type { [0 x <2 x i64>], i64 }
%frame.later$fn.12.start$arrow0 = type { i32, i8*, i32, %frame.later$fn.12.start$arrow0.rest }
%frame.later$fn.12.start$arrow0.rest = type { [0 x <2 x i64>], i64 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"named\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"arrow\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"start returns\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"main done\00" }, align 8

declare void @llvm.trap()
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare nonnull i8* @nish_async_start(i32 noundef, i64 noundef, i8** nonnull) #0
declare void @nish_async_settle(i8* nonnull, i8*, i32 noundef) #0
declare noundef i64 @nish_async_sleep(i32 noundef) #0
declare noundef i32 @nish_async_poll(i64 noundef) #0
declare nonnull i8* @nish_async_copy_str(i8* nonnull) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define weak_odr hidden i1 @nish.async.task.0(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @later$fn.5.shout.resume(i8* %frame)
  ret i1 %done
}

define weak_odr hidden i1 @nish.async.task.1(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @later$fn.12.start$arrow0.resume(i8* %frame)
  ret i1 %done
}

define internal void @shout(i8* noundef nonnull noalias readonly align 8 nocapture %label, i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* %0, i8* %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @start() #0 {
entry:
  %async.prev = alloca i8*, align 8
  %async.prev.1 = alloca i8*, align 8
  %0 = call i8* @nish_async_start(i32 0, i64 48, i8** %async.prev)
  %1 = call i8* @nish_async_copy_str(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %2 = getelementptr inbounds i8, i8* %0, i64 32
  %3 = bitcast i8* %2 to { i32, i8*, i32 }*
  %4 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %3, i32 0, i32 0
  store i32 0, i32* %4
  %5 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %3, i32 0, i32 1
  store i8* %1, i8** %5
  %6 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %3, i32 0, i32 2
  store i32 10, i32* %6
  %7 = call i1 @later$fn.5.shout.resume(i8* %2)
  %8 = load i8*, i8** %async.prev
  %9 = zext i1 %7 to i32
  call void @nish_async_settle(i8* %0, i8* %8, i32 %9)
  %10 = call i8* @nish_async_start(i32 1, i64 48, i8** %async.prev.1)
  %11 = call i8* @nish_async_copy_str(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %12 = getelementptr inbounds i8, i8* %10, i64 32
  %13 = bitcast i8* %12 to { i32, i8*, i32 }*
  %14 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %13, i32 0, i32 0
  store i32 0, i32* %14
  %15 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %13, i32 0, i32 1
  store i8* %11, i8** %15
  %16 = getelementptr inbounds { i32, i8*, i32 }, { i32, i8*, i32 }* %13, i32 0, i32 2
  store i32 20, i32* %16
  %17 = call i1 @later$fn.12.start$arrow0.resume(i8* %12)
  %18 = load i8*, i8** %async.prev.1
  %19 = zext i1 %17 to i32
  call void @nish_async_settle(i8* %10, i8* %18, i32 %19)
  call void @nish_print(i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*))
  ret void
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  call void @start()
  call void @nish_print(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
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

define internal void @start$arrow0(i8* noundef nonnull noalias readonly align 8 nocapture %label, i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i8* @nish_str_from_i32(i32 %2)
  %5 = call i8* @nish_str_concat(i8* %0, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal i1 @later$fn.5.shout.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.later$fn.5.shout*
  %async.state = getelementptr inbounds %frame.later$fn.5.shout, %frame.later$fn.5.shout* %async.frame, i32 0, i32 0
  %label.at = getelementptr inbounds %frame.later$fn.5.shout, %frame.later$fn.5.shout* %async.frame, i32 0, i32 1
  %label = load i8*, i8** %label.at
  %ms.at = getelementptr inbounds %frame.later$fn.5.shout, %frame.later$fn.5.shout* %async.frame, i32 0, i32 2
  %ms = load i32, i32* %ms.at
  %async.rest = getelementptr inbounds %frame.later$fn.5.shout, %frame.later$fn.5.shout* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.later$fn.5.shout.rest* %async.rest to i8*
  %async.wait = getelementptr inbounds %frame.later$fn.5.shout.rest, %frame.later$fn.5.shout.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
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
  call void @shout(i8* %label, i32 %ms)
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define internal i1 @later$fn.12.start$arrow0.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.later$fn.12.start$arrow0*
  %async.state = getelementptr inbounds %frame.later$fn.12.start$arrow0, %frame.later$fn.12.start$arrow0* %async.frame, i32 0, i32 0
  %label.at = getelementptr inbounds %frame.later$fn.12.start$arrow0, %frame.later$fn.12.start$arrow0* %async.frame, i32 0, i32 1
  %label = load i8*, i8** %label.at
  %ms.at = getelementptr inbounds %frame.later$fn.12.start$arrow0, %frame.later$fn.12.start$arrow0* %async.frame, i32 0, i32 2
  %ms = load i32, i32* %ms.at
  %async.rest = getelementptr inbounds %frame.later$fn.12.start$arrow0, %frame.later$fn.12.start$arrow0* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.later$fn.12.start$arrow0.rest* %async.rest to i8*
  %async.wait = getelementptr inbounds %frame.later$fn.12.start$arrow0.rest, %frame.later$fn.12.start$arrow0.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
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
  call void @start$arrow0(i8* %label, i32 %ms)
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
  switch i32 %kind, label %bad [ i32 0, label %kind.0 i32 1, label %kind.1 ]

kind.0:
  %done.0 = call i1 @nish.async.task.0(i8* %frame)
  ret i1 %done.0

kind.1:
  %done.1 = call i1 @nish.async.task.1(i8* %frame)
  ret i1 %done.1

bad:
  call void @llvm.trap()
  unreachable
}
