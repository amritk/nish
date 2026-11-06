%frame.report = type { i32, i32, i32, %frame.report.rest }
%frame.report.rest = type { [0 x <2 x i64>], i32 }

declare noalias i8* @malloc(i64)
declare void @free(i8*)
declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define weak_odr hidden i1 @nish.async.task.0(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @report.resume(i8* %frame)
  ret i1 %done
}

define internal noundef i32 @double(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal i1 @report.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.report*
  %async.state = getelementptr inbounds %frame.report, %frame.report* %async.frame, i32 0, i32 0
  %label.at = getelementptr inbounds %frame.report, %frame.report* %async.frame, i32 0, i32 1
  %label = load i32, i32* %label.at
  %x.at = getelementptr inbounds %frame.report, %frame.report* %async.frame, i32 0, i32 2
  %x = load i32, i32* %x.at
  %async.rest = getelementptr inbounds %frame.report, %frame.report* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.report.rest* %async.rest to i8*
  %d.addr = getelementptr inbounds %frame.report.rest, %frame.report.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @double(i32 %x)
  store i32 %0, i32* %d.addr, align 4
  %1 = mul nsw i32 %label, 1000
  %2 = load i32, i32* %d.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %6)
  call void @nish_arena_release(i64 %arena.mark)
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

define internal void @shout(i32 noundef %x) #2 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %x)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call noalias i8* @malloc(i64 48)
  %1 = icmp eq i8* %0, null
  br i1 %1, label %spawn.oom, label %spawn.go

spawn.oom:
  call void @llvm.trap()
  unreachable

spawn.go:
  %2 = getelementptr inbounds i8, i8* %0, i64 16
  %3 = bitcast i8* %2 to { i32, i32, i32 }*
  %4 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %3, i32 0, i32 0
  store i32 0, i32* %4
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %3, i32 0, i32 1
  store i32 1, i32* %5
  %6 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %3, i32 0, i32 2
  store i32 10, i32* %6
  %7 = call i1 @report.resume(i8* %2)
  br i1 %7, label %spawn.done, label %spawn.queue

spawn.done:
  call void @free(i8* %0)
  br label %spawn.join

spawn.queue:
  %8 = getelementptr inbounds i8, i8* %0, i64 8
  %9 = bitcast i8* %8 to i32*
  store i32 0, i32* %9
  call void @nish.async.enqueue(i8* %0)
  br label %spawn.join

spawn.join:
  call void @shout(i32 7)
  %10 = call noalias i8* @malloc(i64 48)
  %11 = icmp eq i8* %10, null
  br i1 %11, label %spawn.oom.1, label %spawn.go.1

spawn.oom.1:
  call void @llvm.trap()
  unreachable

spawn.go.1:
  %12 = getelementptr inbounds i8, i8* %10, i64 16
  %13 = bitcast i8* %12 to { i32, i32, i32 }*
  %14 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %13, i32 0, i32 0
  store i32 0, i32* %14
  %15 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %13, i32 0, i32 1
  store i32 2, i32* %15
  %16 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %13, i32 0, i32 2
  store i32 21, i32* %16
  %17 = call i1 @report.resume(i8* %12)
  br i1 %17, label %spawn.done.1, label %spawn.queue.1

spawn.done.1:
  call void @free(i8* %10)
  br label %spawn.join.1

spawn.queue.1:
  %18 = getelementptr inbounds i8, i8* %10, i64 8
  %19 = bitcast i8* %18 to i32*
  store i32 0, i32* %19
  call void @nish.async.enqueue(i8* %10)
  br label %spawn.join.1

spawn.join.1:
  %20 = call i8* @nish_str_from_i32(i32 0)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish.async.drain()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

@nish.async.head = internal global i8* null, align 8
@nish.async.tail = internal global i8* null, align 8


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
  switch i32 %kind, label %bad [ i32 0, label %kind.0 ]

kind.0:
  %done.0 = call i1 @nish.async.task.0(i8* %frame)
  ret i1 %done.0

bad:
  call void @llvm.trap()
  unreachable
}
