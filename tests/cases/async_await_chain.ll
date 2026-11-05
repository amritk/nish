%frame.step = type { i32, i32, i32, %frame.step.rest }
%frame.step.rest = type { [0 x <2 x i64>], i32, i32 }
%frame.twice = type { i32, i32, i32, %frame.twice.rest }
%frame.twice.rest = type { [2 x <2 x i64>], i32, i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [4 x <2 x i64>], i32, i32, i64 }

declare void @llvm.trap()
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @inc(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal i1 @step.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.step*
  %async.state = getelementptr inbounds %frame.step, %frame.step* %async.frame, i32 0, i32 0
  %x.at = getelementptr inbounds %frame.step, %frame.step* %async.frame, i32 0, i32 1
  %x = load i32, i32* %x.at
  %async.answer = getelementptr inbounds %frame.step, %frame.step* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.step, %frame.step* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.step.rest* %async.rest to i8*
  %a.addr = getelementptr inbounds %frame.step.rest, %frame.step.rest* %async.rest, i32 0, i32 1
  %b.addr = getelementptr inbounds %frame.step.rest, %frame.step.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @inc(i32 %x)
  store i32 %0, i32* %a.addr, align 4
  %1 = load i32, i32* %a.addr, align 4
  %2 = call i32 @inc(i32 %1)
  store i32 %2, i32* %b.addr, align 4
  %3 = load i32, i32* %a.addr, align 4
  %4 = load i32, i32* %b.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal i1 @twice.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.twice*
  %async.state = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 0
  %x.at = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 1
  %x = load i32, i32* %x.at
  %async.answer = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.twice.rest* %async.rest to i8*
  %first.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 1
  %second.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %0 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %1 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 1
  store i32 %x, i32* %2
  br label %await.poll

await.poll:
  %3 = call i1 @step.resume(i8* %async.kids)
  br i1 %3, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %4 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %4, i32 0, i32 2
  %6 = load i32, i32* %5
  store i32 %6, i32* %first.addr, align 4
  %7 = load i32, i32* %first.addr, align 4
  %8 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %9 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %8, i32 0, i32 0
  store i32 0, i32* %9
  %10 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %8, i32 0, i32 1
  store i32 %7, i32* %10
  br label %await.poll.1

await.poll.1:
  %11 = call i1 @step.resume(i8* %async.kids)
  br i1 %11, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %12 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %13 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %12, i32 0, i32 2
  %14 = load i32, i32* %13
  store i32 %14, i32* %second.addr, align 4
  %15 = load i32, i32* %first.addr, align 4
  %16 = load i32, i32* %second.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %n.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %m.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %1 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 1
  store i32 1, i32* %2
  br label %await.poll

await.poll:
  %3 = call i1 @twice.resume(i8* %async.kids)
  br i1 %3, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %4 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %4, i32 0, i32 2
  %6 = load i32, i32* %5
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %n.addr, align 4
  %10 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %11 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %10, i32 0, i32 0
  store i32 0, i32* %11
  %12 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %10, i32 0, i32 1
  store i32 %9, i32* %12
  br label %await.poll.1

await.poll.1:
  %13 = call i1 @twice.resume(i8* %async.kids)
  br i1 %13, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %14 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %15 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %14, i32 0, i32 2
  %16 = load i32, i32* %15
  store i32 %16, i32* %m.addr, align 4
  %17 = load i32, i32* %m.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
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
  %3 = call i1 @nish.async.step()
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

@nish.async.head = internal global i8* null, align 8
@nish.async.tail = internal global i8* null, align 8

declare void @free(i8*)

define hidden void @nish.async.enqueue(i8* %node) nounwind "probe-stack"="inline-asm" {
entry:
  %link = bitcast i8* %node to i8**
  store i8* null, i8** %link, align 8
  %tail = load i8*, i8** @nish.async.tail, align 8
  %empty = icmp eq i8* %tail, null
  br i1 %empty, label %first, label %append

first:
  store i8* %node, i8** @nish.async.head, align 8
  br label %done

append:
  %prev = bitcast i8* %tail to i8**
  store i8* %node, i8** %prev, align 8
  br label %done

done:
  store i8* %node, i8** @nish.async.tail, align 8
  ret void
}

define hidden i1 @nish.async.step() nounwind "probe-stack"="inline-asm" {
entry:
  %first = load i8*, i8** @nish.async.head, align 8
  store i8* null, i8** @nish.async.head, align 8
  store i8* null, i8** @nish.async.tail, align 8
  br label %loop

loop:
  %node = phi i8* [ %first, %entry ], [ %next, %advance ]
  %progress = phi i1 [ false, %entry ], [ %progress.next, %advance ]
  %more = icmp ne i8* %node, null
  br i1 %more, label %run, label %out

run:
  %link = bitcast i8* %node to i8**
  %next = load i8*, i8** %link, align 8
  %kind.at = getelementptr inbounds i8, i8* %node, i64 8
  %kind.ptr = bitcast i8* %kind.at to i32*
  %kind = load i32, i32* %kind.ptr, align 8
  %frame = getelementptr inbounds i8, i8* %node, i64 16
  %finished = call i1 @nish.async.resume(i32 %kind, i8* %frame)
  br i1 %finished, label %release, label %again

release:
  call void @free(i8* %node)
  br label %advance

again:
  call void @nish.async.enqueue(i8* %node)
  br label %advance

advance:
  %progress.next = or i1 %progress, %finished
  br label %loop

out:
  ret i1 %progress
}

define hidden void @nish.async.drain() nounwind "probe-stack"="inline-asm" {
entry:
  br label %check

check:
  %head = load i8*, i8** @nish.async.head, align 8
  %empty = icmp eq i8* %head, null
  br i1 %empty, label %done, label %step

step:
  %progress = call i1 @nish.async.step()
  br i1 %progress, label %check, label %stuck

stuck:
  call void @llvm.trap()
  unreachable

done:
  ret void
}

define internal i1 @nish.async.resume(i32 %kind, i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  switch i32 %kind, label %bad [  ]

bad:
  call void @llvm.trap()
  unreachable
}
