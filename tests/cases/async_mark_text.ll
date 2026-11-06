%frame.two = type { i32, i32, %frame.two.rest }
%frame.two.rest = type { [0 x <2 x i64>], i32, i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [2 x <2 x i64>], i8*, i32, i64 }

@.str.0 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"@@async.bytes:9@@ x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"@@async.kids:0@@\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"see @@async. here\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"\01async.kids:0\01\00" }, align 8

declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @answer(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 40
  ret i32 %0
}

define internal i1 @two.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.two*
  %async.state = getelementptr inbounds %frame.two, %frame.two* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.two, %frame.two* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.two, %frame.two* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.two.rest* %async.rest to i8*
  %a.addr = getelementptr inbounds %frame.two.rest, %frame.two.rest* %async.rest, i32 0, i32 1
  %b.addr = getelementptr inbounds %frame.two.rest, %frame.two.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @answer(i32 1)
  store i32 %0, i32* %a.addr, align 4
  %1 = call i32 @answer(i32 2)
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
  %raw.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %v.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  call void @nish_print(i8* bitcast ({ i64, [20 x i8] }* @.str.0 to i8*))
  call void @nish_print(i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*))
  call void @nish_print(i8* bitcast ({ i64, [18 x i8] }* @.str.2 to i8*))
  store i8* bitcast ({ i64, [15 x i8] }* @.str.3 to i8*), i8** %raw.addr, align 8
  %0 = load i8*, i8** %raw.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = bitcast i8* %async.kids to { i32, i32 }*
  %6 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %5, i32 0, i32 0
  store i32 0, i32* %6
  br label %await.poll

await.poll:
  %7 = call i1 @two.resume(i8* %async.kids)
  br i1 %7, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %8 = bitcast i8* %async.kids to { i32, i32 }*
  %9 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %8, i32 0, i32 1
  %10 = load i32, i32* %9
  store i32 %10, i32* %v.addr, align 4
  %11 = load i32, i32* %v.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
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
