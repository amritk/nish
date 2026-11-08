%frame.waits = type { i32, i32, i32, %frame.waits.rest }
%frame.waits.rest = type { [0 x <2 x i64>], i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [2 x <2 x i64>], i32, i64 }

declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef i32 @leaf(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal i1 @waits.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.waits*
  %async.state = getelementptr inbounds %frame.waits, %frame.waits* %async.frame, i32 0, i32 0
  %x.at = getelementptr inbounds %frame.waits, %frame.waits* %async.frame, i32 0, i32 1
  %x = load i32, i32* %x.at
  %async.answer = getelementptr inbounds %frame.waits, %frame.waits* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.waits, %frame.waits* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.waits.rest* %async.rest to i8*
  %y.addr = getelementptr inbounds %frame.waits.rest, %frame.waits.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @leaf(i32 %x)
  store i32 %0, i32* %y.addr, align 4
  %1 = load i32, i32* %y.addr, align 4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %async.answer
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

define i1 @nish_main.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %v.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
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
  store i32 4, i32* %2
  br label %await.poll

await.poll:
  %3 = call i1 @waits.resume(i8* %async.kids)
  br i1 %3, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %4 = bitcast i8* %async.kids to { i32, i32, i32 }*
  %5 = getelementptr inbounds { i32, i32, i32 }, { i32, i32, i32 }* %4, i32 0, i32 2
  %6 = load i32, i32* %5
  store i32 %6, i32* %v.addr, align 4
  %7 = load i32, i32* %v.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
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
  switch i32 %kind, label %bad [  ]

bad:
  call void @llvm.trap()
  unreachable
}
