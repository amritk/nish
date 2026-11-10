%frame.sum = type { i32, i32, i32, i32, %frame.sum.rest }
%frame.sum.rest = type { [0 x <2 x i64>], i32, i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [4 x <2 x i64>], i64, i64, i32, i32, i32, i32, i64 }

declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_region_new() #2
declare i8* @nish_region_enter(i64 noundef) #2
declare void @nish_region_leave(i64 noundef, i8*) #2
declare void @nish_region_adopt(i64 noundef) #2
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
  %async.lane = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.lane.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %p.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %q.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %r.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 6
  %async.spill.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 7
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
  %4 = call i64 @nish_region_new()
  %5 = call i8* @nish_region_enter(i64 %4)
  %6 = call i1 @sum.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %4, i8* null)
  br i1 %6, label %lane.ran, label %lane.new

lane.new:
  store i64 %4, i64* %async.lane
  br label %lane.started

lane.ran:
  call void @nish_region_adopt(i64 %4)
  store i64 0, i64* %async.lane
  br label %lane.started

lane.started:
  %7 = call i32 @square(i32 3)
  store i32 %7, i32* %async.spill.0
  %8 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %9 = bitcast i8* %8 to { i32, i32, i32, i32 }*
  %10 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %9, i32 0, i32 0
  store i32 0, i32* %10
  %11 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %9, i32 0, i32 1
  store i32 2, i32* %11
  %12 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %9, i32 0, i32 2
  store i32 3, i32* %12
  %13 = call i64 @nish_region_new()
  %14 = call i8* @nish_region_enter(i64 %13)
  %15 = call i1 @sum.resume(i8* %8)
  call void @nish_region_leave(i64 %13, i8* null)
  br i1 %15, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %13, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %13)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %16 = load i64, i64* %async.lane
  %17 = icmp eq i64 %16, 0
  br i1 %17, label %lane.next, label %lane.run

lane.run:
  %18 = call i8* @nish_region_enter(i64 %16)
  %19 = call i1 @sum.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %16, i8* null)
  br i1 %19, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %16)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %20 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %21 = load i64, i64* %async.lane.1
  %22 = icmp eq i64 %21, 0
  br i1 %22, label %lane.next.1, label %lane.run.1

lane.run.1:
  %23 = call i8* @nish_region_enter(i64 %21)
  %24 = call i1 @sum.resume(i8* %20)
  call void @nish_region_leave(i64 %21, i8* null)
  br i1 %24, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %21)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %25 = load i64, i64* %async.lane
  %26 = icmp eq i64 %25, 0
  %27 = load i64, i64* %async.lane.1
  %28 = icmp eq i64 %27, 0
  %29 = and i1 %26, %28
  br i1 %29, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %30 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %31 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %30, i32 0, i32 3
  %32 = load i32, i32* %31
  store i32 %32, i32* %p.addr, align 4
  %async.reload.0 = load i32, i32* %async.spill.0
  store i32 %async.reload.0, i32* %q.addr, align 4
  %33 = getelementptr inbounds i8, i8* %async.kids, i64 32
  %34 = bitcast i8* %33 to { i32, i32, i32, i32 }*
  %35 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %34, i32 0, i32 3
  %36 = load i32, i32* %35
  store i32 %36, i32* %r.addr, align 4
  %37 = load i32, i32* %p.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  call void @nish_print(i8* %38)
  %39 = load i32, i32* %q.addr, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  call void @nish_print(i8* %40)
  %41 = load i32, i32* %r.addr, align 4
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
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
