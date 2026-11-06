%frame.sum = type { i32, i32, i32, i32, %frame.sum.rest }
%frame.sum.rest = type { [0 x <2 x i64>], i32, i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [4 x <2 x i64>], i32, i32, i32, i32, i64 }

declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  ret i32 %0
}

define internal i1 @sum.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.sum*
  %async.state = getelementptr inbounds %frame.sum, %frame.sum* %async.frame, i32 0, i32 0
  %x.at = getelementptr inbounds %frame.sum, %frame.sum* %async.frame, i32 0, i32 1
  %x = load i32, i32* %x.at
  %y.at = getelementptr inbounds %frame.sum, %frame.sum* %async.frame, i32 0, i32 2
  %y = load i32, i32* %y.at
  %async.answer = getelementptr inbounds %frame.sum, %frame.sum* %async.frame, i32 0, i32 3
  %async.rest = getelementptr inbounds %frame.sum, %frame.sum* %async.frame, i32 0, i32 4
  %async.kids = bitcast %frame.sum.rest* %async.rest to i8*
  %a.addr = getelementptr inbounds %frame.sum.rest, %frame.sum.rest* %async.rest, i32 0, i32 1
  %b.addr = getelementptr inbounds %frame.sum.rest, %frame.sum.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @square(i32 %x)
  store i32 %0, i32* %a.addr, align 4
  %1 = call i32 @square(i32 %y)
  store i32 %1, i32* %b.addr, align 4
  %2 = load i32, i32* %a.addr, align 4
  %3 = load i32, i32* %b.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %async.answer
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

define i1 @nish_main.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %p.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %q.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %r.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %async.spill.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.1
  %0 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %1 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %0, i32 0, i32 1
  store i32 1, i32* %2
  %3 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %0, i32 0, i32 2
  store i32 2, i32* %3
  %4 = call i1 @sum.resume(i8* %async.kids)
  %5 = call i32 @square(i32 3)
  store i32 %5, i32* %async.spill.0
  %6 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %7 = bitcast i8* %6 to { i32, i32, i32, i32 }*
  %8 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %7, i32 0, i32 0
  store i32 0, i32* %8
  %9 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %7, i32 0, i32 1
  store i32 2, i32* %9
  %10 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %7, i32 0, i32 2
  store i32 3, i32* %10
  %11 = call i1 @sum.resume(i8* %6)
  br label %await.poll

await.poll:
  %12 = call i1 @sum.resume(i8* %async.kids)
  %13 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %14 = call i1 @sum.resume(i8* %13)
  %15 = and i1 %12, %14
  br i1 %15, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %16 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %17 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %16, i32 0, i32 3
  %18 = load i32, i32* %17
  store i32 %18, i32* %p.addr, align 4
  %async.reload.0 = load i32, i32* %async.spill.0
  store i32 %async.reload.0, i32* %q.addr, align 4
  %19 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %20 = bitcast i8* %19 to { i32, i32, i32, i32 }*
  %21 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %20, i32 0, i32 3
  %22 = load i32, i32* %21
  store i32 %22, i32* %r.addr, align 4
  %23 = load i32, i32* %p.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = load i32, i32* %q.addr, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  %27 = load i32, i32* %r.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %async.reload.1 = load i64, i64* %async.spill.1
  call void @nish_arena_release(i64 %async.reload.1)
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
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
