%struct.Box = type { i32 }
%frame.total = type { i32, i32, i32, %frame.total.rest }
%frame.total.rest = type { [3 x <2 x i64>], %struct.Box* }
%frame.nish_main = type { i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [5 x <2 x i64>], i32, i64 }
%frame.later$fn.12.total$arrow0 = type { i32, %struct.Box*, i32, %frame.later$fn.12.total$arrow0.rest }
%frame.later$fn.12.total$arrow0.rest = type { [0 x <2 x i64>], i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @tick() #1 {
entry:
  ret i32 1
}

define internal i1 @total.resume(i8* %async.raw) #2 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.total*
  %async.state = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 0
  %n.at = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 1
  %n = load i32, i32* %n.at
  %async.answer = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.total.rest* %async.rest to i8*
  %b.addr = getelementptr inbounds %frame.total.rest, %frame.total.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Box*
  call void @Box.constructor(%struct.Box* %1, i32 %n)
  store %struct.Box* %1, %struct.Box** %b.addr, align 8
  %2 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %3 = bitcast i8* %async.kids to { i32, %struct.Box*, i32 }*
  %4 = getelementptr inbounds { i32, %struct.Box*, i32 }, { i32, %struct.Box*, i32 }* %3, i32 0, i32 0
  store i32 0, i32* %4
  %5 = getelementptr inbounds { i32, %struct.Box*, i32 }, { i32, %struct.Box*, i32 }* %3, i32 0, i32 1
  store %struct.Box* %2, %struct.Box** %5
  br label %await.poll

await.poll:
  %6 = call i1 @later$fn.12.total$arrow0.resume(i8* %async.kids)
  br i1 %6, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %7 = bitcast i8* %async.kids to { i32, %struct.Box*, i32 }*
  %8 = getelementptr inbounds { i32, %struct.Box*, i32 }, { i32, %struct.Box*, i32 }* %7, i32 0, i32 2
  %9 = load i32, i32* %8
  store i32 %9, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define i1 @nish_main.resume(i8* %async.raw) #2 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %r.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %1 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %0, i32 0, i32 1
  store i32 20, i32* %2
  br label %await.poll

await.poll:
  %3 = call i1 @total.resume(i8* %async.kids)
  br i1 %3, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %4 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %4, i32 0, i32 2
  %6 = load i32, i32* %5
  store i32 %6, i32* %r.addr, align 4
  %7 = load i32, i32* %r.addr, align 4
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

define internal noundef i32 @total$arrow0(%struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal i1 @later$fn.12.total$arrow0.resume(i8* %async.raw) #2 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.later$fn.12.total$arrow0*
  %async.state = getelementptr inbounds %frame.later$fn.12.total$arrow0, %frame.later$fn.12.total$arrow0* %async.frame, i32 0, i32 0
  %cap.0.at = getelementptr inbounds %frame.later$fn.12.total$arrow0, %frame.later$fn.12.total$arrow0* %async.frame, i32 0, i32 1
  %cap.0 = load %struct.Box*, %struct.Box** %cap.0.at
  %async.answer = getelementptr inbounds %frame.later$fn.12.total$arrow0, %frame.later$fn.12.total$arrow0* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.later$fn.12.total$arrow0, %frame.later$fn.12.total$arrow0* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.later$fn.12.total$arrow0.rest* %async.rest to i8*
  %t.addr = getelementptr inbounds %frame.later$fn.12.total$arrow0.rest, %frame.later$fn.12.total$arrow0.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @tick()
  store i32 %0, i32* %t.addr, align 4
  %1 = call i32 @total$arrow0(%struct.Box* %cap.0)
  %2 = load i32, i32* %t.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %async.answer
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
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
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}

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
