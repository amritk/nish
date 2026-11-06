%struct.nish_result.i32.str = type { i1, i32, i8* }
%frame.total = type { i32, i8*, i8*, %struct.nish_result.i32.str*, %frame.total.rest }
%frame.total.rest = type { [0 x <2 x i64>], %struct.nish_result.i32.str*, %struct.nish_result.i32.str* }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [3 x <2 x i64>], %struct.nish_result.i32.str*, %struct.nish_result.i32.str*, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"cde\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parse(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.nish_result.i32.str*
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 0
  store i1 false, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %7, align 8
  ret %struct.nish_result.i32.str* %5

if.end:
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = call i8* @nish_alloc_struct(i64 16)
  %15 = bitcast i8* %14 to %struct.nish_result.i32.str*
  %16 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %15, i32 0, i32 0
  store i1 true, i1* %16, align 1
  %17 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %15, i32 0, i32 1
  store i32 %12, i32* %17, align 4
  ret %struct.nish_result.i32.str* %15

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal i1 @total.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.total*
  %async.state = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 0
  %a.at = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 1
  %a = load i8*, i8** %a.at
  %b.at = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 2
  %b = load i8*, i8** %b.at
  %async.answer = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 3
  %async.rest = getelementptr inbounds %frame.total, %frame.total* %async.frame, i32 0, i32 4
  %async.kids = bitcast %frame.total.rest* %async.rest to i8*
  %x.addr = getelementptr inbounds %frame.total.rest, %frame.total.rest* %async.rest, i32 0, i32 1
  %y.addr = getelementptr inbounds %frame.total.rest, %frame.total.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call %struct.nish_result.i32.str* @parse(i8* %a)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %x.addr, align 8
  %1 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %x.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %x.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  %8 = call i8* @nish_alloc_struct(i64 16)
  %9 = bitcast i8* %8 to %struct.nish_result.i32.str*
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %9, i32 0, i32 0
  store i1 false, i1* %10, align 1
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %9, i32 0, i32 2
  store i8* %7, i8** %11, align 8
  store %struct.nish_result.i32.str* %9, %struct.nish_result.i32.str** %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

if.end:
  %12 = call %struct.nish_result.i32.str* @parse(i8* %b)
  store %struct.nish_result.i32.str* %12, %struct.nish_result.i32.str** %y.addr, align 8
  %13 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %y.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  %16 = xor i1 %15, true
  br i1 %16, label %if.then.1, label %if.end.1

if.then.1:
  %17 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %y.addr, align 8
  %18 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %17, i32 0, i32 2
  %19 = load i8*, i8** %18, align 8
  %20 = call i8* @nish_alloc_struct(i64 16)
  %21 = bitcast i8* %20 to %struct.nish_result.i32.str*
  %22 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %21, i32 0, i32 0
  store i1 false, i1* %22, align 1
  %23 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %21, i32 0, i32 2
  store i8* %19, i8** %23, align 8
  store %struct.nish_result.i32.str* %21, %struct.nish_result.i32.str** %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

if.end.1:
  %24 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %x.addr, align 8
  %25 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4
  %27 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %y.addr, align 8
  %28 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %27, i32 0, i32 1
  %29 = load i32, i32* %28, align 4
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = call i8* @nish_alloc_struct(i64 16)
  %34 = bitcast i8* %33 to %struct.nish_result.i32.str*
  %35 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %34, i32 0, i32 0
  store i1 true, i1* %35, align 1
  %36 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %34, i32 0, i32 1
  store i32 %31, i32* %36, align 4
  store %struct.nish_result.i32.str* %34, %struct.nish_result.i32.str** %async.answer
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
  %good.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %bad.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i8*, i8*, %struct.nish_result.i32.str* }*
  %1 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %0, i32 0, i32 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %2
  %3 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %0, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %3
  br label %await.poll

await.poll:
  %4 = call i1 @total.resume(i8* %async.kids)
  br i1 %4, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %5 = bitcast i8* %async.kids to { i32, i8*, i8*, %struct.nish_result.i32.str* }*
  %6 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %5, i32 0, i32 3
  %7 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %6
  store %struct.nish_result.i32.str* %7, %struct.nish_result.i32.str** %good.addr, align 8
  %8 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %good.addr, align 8
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %good.addr, align 8
  %12 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  br label %if.end

if.end:
  %15 = bitcast i8* %async.kids to { i32, i8*, i8*, %struct.nish_result.i32.str* }*
  %16 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %15, i32 0, i32 0
  store i32 0, i32* %16
  %17 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %15, i32 0, i32 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %17
  %18 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %15, i32 0, i32 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %18
  br label %await.poll.1

await.poll.1:
  %19 = call i1 @total.resume(i8* %async.kids)
  br i1 %19, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %20 = bitcast i8* %async.kids to { i32, i8*, i8*, %struct.nish_result.i32.str* }*
  %21 = getelementptr inbounds { i32, i8*, i8*, %struct.nish_result.i32.str* }, { i32, i8*, i8*, %struct.nish_result.i32.str* }* %20, i32 0, i32 3
  %22 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %21
  store %struct.nish_result.i32.str* %22, %struct.nish_result.i32.str** %bad.addr, align 8
  %23 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %bad.addr, align 8
  %24 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %23, i32 0, i32 0
  %25 = load i1, i1* %24, align 1
  %26 = xor i1 %25, true
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  %27 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %bad.addr, align 8
  %28 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %27, i32 0, i32 2
  %29 = load i8*, i8** %28, align 8
  call void @nish_print(i8* %29)
  br label %if.end.1

if.end.1:
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
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
