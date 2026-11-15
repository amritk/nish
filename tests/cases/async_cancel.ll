%struct.Slot = type { i64 }
%frame.quiet = type { i32, i32, %frame.quiet.rest }
%frame.quiet.rest = type { [0 x <2 x i64>], i1, i64, i1, i64, i64 }
%frame.parked = type { i32, %struct.Slot*, %frame.parked.rest }
%frame.parked.rest = type { [0 x <2 x i64>], i1, i64, i64 }
%frame.nap = type { i32, %frame.nap.rest }
%frame.nap.rest = type { [0 x <2 x i64>], i1, i1, i64, i1, i64, i64 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [4 x <2 x i64>], i32, %struct.Slot*, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"quiet: ready \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c", open \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c", cancelled \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"parked: slept \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"nap: armed \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", slept \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", again \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"bind failed: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"main: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c", cancel main \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", cancel parked \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare nonnull i8* @nish_async_spawn(i32 noundef, i64 noundef) #0
declare i8* @nish_async_enter(i8* nonnull) #0
declare void @nish_async_leave(i8* nonnull, i8*) #0
declare void @nish_async_done(i8* nonnull) #0
declare noundef i64 @nish_async_sleep(i32 noundef) #0
declare noundef i32 @nish_async_poll(i64 noundef) #0
declare noundef i64 @nish_async_wait_fd_within(i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i64 @nish_async_task_id() #0
declare noundef i32 @nish_async_cancel(i64 noundef) #0
declare noundef i32 @nish_async_cancelled() #0
declare noundef i32 @nish_async_cancel_after(i64 noundef, i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2

define weak_odr hidden i1 @nish.async.task.0(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @parked.resume(i8* %frame)
  ret i1 %done
}

define weak_odr hidden i1 @nish.async.task.1(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @nap.resume(i8* %frame)
  ret i1 %done
}

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal i1 @quiet.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.quiet*
  %async.state = getelementptr inbounds %frame.quiet, %frame.quiet* %async.frame, i32 0, i32 0
  %fd.at = getelementptr inbounds %frame.quiet, %frame.quiet* %async.frame, i32 0, i32 1
  %fd = load i32, i32* %fd.at
  %async.rest = getelementptr inbounds %frame.quiet, %frame.quiet* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.quiet.rest* %async.rest to i8*
  %ready.addr = getelementptr inbounds %frame.quiet.rest, %frame.quiet.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.quiet.rest, %frame.quiet.rest* %async.rest, i32 0, i32 2
  %open.addr = getelementptr inbounds %frame.quiet.rest, %frame.quiet.rest* %async.rest, i32 0, i32 3
  %async.wait.1 = getelementptr inbounds %frame.quiet.rest, %frame.quiet.rest* %async.rest, i32 0, i32 4
  %async.spill.0 = getelementptr inbounds %frame.quiet.rest, %frame.quiet.rest* %async.rest, i32 0, i32 5
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll i32 2, label %wait.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = call i64 @nish_async_wait_fd_within(i32 %fd, i32 0, i32 5)
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
  store i1 %4, i1* %ready.addr, align 1
  %5 = call i64 @nish_async_wait_fd_within(i32 %fd, i32 1, i32 5)
  store i64 %5, i64* %async.wait.1
  br label %wait.poll.1

wait.poll.1:
  %6 = load i64, i64* %async.wait.1
  %7 = call i32 @nish_async_poll(i64 %6)
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %wait.pending.1, label %wait.ready.1

wait.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

wait.ready.1:
  %9 = icmp ne i32 %7, 0
  store i1 %9, i1* %open.addr, align 1
  %10 = load i1, i1* %ready.addr, align 1
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %14 = load i1, i1* %open.addr, align 1
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*))
  %18 = call i32 @nish_async_cancelled()
  %19 = icmp ne i32 %18, 0
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  call void @nish_print(i8* %21)
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

define internal i1 @parked.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.parked*
  %async.state = getelementptr inbounds %frame.parked, %frame.parked* %async.frame, i32 0, i32 0
  %slot.at = getelementptr inbounds %frame.parked, %frame.parked* %async.frame, i32 0, i32 1
  %slot = load %struct.Slot*, %struct.Slot** %slot.at
  %async.rest = getelementptr inbounds %frame.parked, %frame.parked* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.parked.rest* %async.rest to i8*
  %slept.addr = getelementptr inbounds %frame.parked.rest, %frame.parked.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.parked.rest, %frame.parked.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.parked.rest, %frame.parked.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = call i64 @nish_async_task_id()
  %1 = getelementptr inbounds %struct.Slot, %struct.Slot* %slot, i32 0, i32 0
  store i64 %0, i64* %1, align 8, !tbaa !4
  %2 = call i64 @nish_async_sleep(i32 1000)
  store i64 %2, i64* %async.wait
  br label %wait.poll

wait.poll:
  %3 = load i64, i64* %async.wait
  %4 = call i32 @nish_async_poll(i64 %3)
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %6 = icmp ne i32 %4, 0
  store i1 %6, i1* %slept.addr, align 1
  %7 = load i1, i1* %slept.addr, align 1
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*))
  %11 = call i32 @nish_async_cancelled()
  %12 = icmp ne i32 %11, 0
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %14 = call i8* @nish_str_concat(i8* %10, i8* %13)
  call void @nish_print(i8* %14)
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

define internal i1 @nap.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nap*
  %async.state = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 0
  %async.rest = getelementptr inbounds %frame.nap, %frame.nap* %async.frame, i32 0, i32 1
  %async.kids = bitcast %frame.nap.rest* %async.rest to i8*
  %armed.addr = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 1
  %slept.addr = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 2
  %async.wait = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 3
  %again.addr = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 4
  %async.wait.1 = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 5
  %async.spill.0 = getelementptr inbounds %frame.nap.rest, %frame.nap.rest* %async.rest, i32 0, i32 6
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll i32 2, label %wait.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = call i64 @nish_async_task_id()
  %1 = call i32 @nish_async_cancel_after(i64 %0, i32 10)
  %2 = icmp ne i32 %1, 0
  store i1 %2, i1* %armed.addr, align 1
  %3 = call i64 @nish_async_sleep(i32 1000)
  store i64 %3, i64* %async.wait
  br label %wait.poll

wait.poll:
  %4 = load i64, i64* %async.wait
  %5 = call i32 @nish_async_poll(i64 %4)
  %6 = icmp slt i32 %5, 0
  br i1 %6, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %7 = icmp ne i32 %5, 0
  store i1 %7, i1* %slept.addr, align 1
  %8 = call i64 @nish_async_sleep(i32 1000)
  store i64 %8, i64* %async.wait.1
  br label %wait.poll.1

wait.poll.1:
  %9 = load i64, i64* %async.wait.1
  %10 = call i32 @nish_async_poll(i64 %9)
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %wait.pending.1, label %wait.ready.1

wait.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

wait.ready.1:
  %12 = icmp ne i32 %10, 0
  store i1 %12, i1* %again.addr, align 1
  %13 = load i1, i1* %armed.addr, align 1
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.6 to i8*), i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*))
  %17 = load i1, i1* %slept.addr, align 1
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %19 = call i8* @nish_str_concat(i8* %16, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [9 x i8] }* @.str.8 to i8*))
  %21 = load i1, i1* %again.addr, align 1
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %23 = call i8* @nish_str_concat(i8* %20, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*))
  %25 = call i32 @nish_async_cancelled()
  %26 = icmp ne i32 %25, 0
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %28 = call i8* @nish_str_concat(i8* %24, i8* %27)
  call void @nish_print(i8* %28)
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
  %fd.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %slot.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.wait = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %wait.poll ]

entry:
  %0 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.9 to i8*), i32 0, i32 0)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.10 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  store i32 1, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

if.end:
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Slot*
  %8 = getelementptr inbounds %struct.Slot, %struct.Slot* %7, i32 0, i32 0
  store i64 0, i64* %8, align 8, !tbaa !4
  store %struct.Slot* %7, %struct.Slot** %slot.addr, align 8
  %9 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %10 = call i8* @nish_async_spawn(i32 0, i64 48)
  %11 = call i8* @nish_async_enter(i8* %10)
  %12 = getelementptr inbounds i8, i8* %10, i64 32
  %13 = bitcast i8* %12 to { i32, %struct.Slot* }*
  %14 = getelementptr inbounds { i32, %struct.Slot* }, { i32, %struct.Slot* }* %13, i32 0, i32 0
  store i32 0, i32* %14
  %15 = getelementptr inbounds { i32, %struct.Slot* }, { i32, %struct.Slot* }* %13, i32 0, i32 1
  store %struct.Slot* %9, %struct.Slot** %15
  %16 = call i1 @parked.resume(i8* %12)
  call void @nish_async_leave(i8* %10, i8* %11)
  br i1 %16, label %spawn.done, label %spawn.join

spawn.done:
  call void @nish_async_done(i8* %10)
  br label %spawn.join

spawn.join:
  %17 = call i64 @nish_async_task_id()
  %18 = call i8* @nish_str_from_i64(i64 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*), i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [15 x i8] }* @.str.12 to i8*))
  %21 = call i64 @nish_async_task_id()
  %22 = call i32 @nish_async_cancel(i64 %21)
  %23 = icmp ne i32 %22, 0
  %24 = select i1 %23, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %25 = call i8* @nish_str_concat(i8* %20, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [17 x i8] }* @.str.13 to i8*))
  %27 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %28 = getelementptr inbounds %struct.Slot, %struct.Slot* %27, i32 0, i32 0
  %29 = load i64, i64* %28, align 8, !tbaa !4
  %30 = call i32 @nish_async_cancel(i64 %29)
  %31 = icmp ne i32 %30, 0
  %32 = select i1 %31, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %33 = call i8* @nish_str_concat(i8* %26, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [9 x i8] }* @.str.8 to i8*))
  %35 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %36 = getelementptr inbounds %struct.Slot, %struct.Slot* %35, i32 0, i32 0
  %37 = load i64, i64* %36, align 8, !tbaa !4
  %38 = call i32 @nish_async_cancel(i64 %37)
  %39 = icmp ne i32 %38, 0
  %40 = select i1 %39, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %41 = call i8* @nish_str_concat(i8* %34, i8* %40)
  call void @nish_print(i8* %41)
  %42 = load i32, i32* %fd.addr, align 4
  %43 = bitcast i8* %async.kids to { i32, i32 }*
  %44 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %43, i32 0, i32 0
  store i32 0, i32* %44
  %45 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %43, i32 0, i32 1
  store i32 %42, i32* %45
  br label %await.poll

await.poll:
  %46 = call i1 @quiet.resume(i8* %async.kids)
  br i1 %46, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %47 = call i8* @nish_async_spawn(i32 1, i64 64)
  %48 = call i8* @nish_async_enter(i8* %47)
  %49 = getelementptr inbounds i8, i8* %47, i64 32
  %50 = bitcast i8* %49 to { i32 }*
  %51 = getelementptr inbounds { i32 }, { i32 }* %50, i32 0, i32 0
  store i32 0, i32* %51
  %52 = call i1 @nap.resume(i8* %49)
  call void @nish_async_leave(i8* %47, i8* %48)
  br i1 %52, label %spawn.done.1, label %spawn.join.1

spawn.done.1:
  call void @nish_async_done(i8* %47)
  br label %spawn.join.1

spawn.join.1:
  %53 = call i64 @nish_async_sleep(i32 200)
  store i64 %53, i64* %async.wait
  br label %wait.poll

wait.poll:
  %54 = load i64, i64* %async.wait
  %55 = call i32 @nish_async_poll(i64 %54)
  %56 = icmp slt i32 %55, 0
  br i1 %56, label %wait.pending, label %wait.ready

wait.pending:
  store i32 2, i32* %async.state
  br label %async.suspend

wait.ready:
  %57 = icmp ne i32 %55, 0
  %58 = load i32, i32* %fd.addr, align 4
  %59 = call i32 @nish_net_close(i32 %58)
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
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i64", !1, i64 0}
!3 = !{!"Slot", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}

declare i8* @nish_async_next()

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
