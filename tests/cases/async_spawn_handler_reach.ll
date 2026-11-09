%struct.Board = type { i32, i32, i1 }
%struct.Query = type { i32 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [0 x <2 x i64>], %struct.Board*, i64 }
%frame.start$arrow0 = type { i32, %struct.Query*, %struct.Board*, i32, i32, %frame.start$arrow0.rest }
%frame.start$arrow0.rest = type { [0 x <2 x i64>], i64 }
%frame.serveOne$fn.12.start$arrow0 = type { i32, i32, i32, %struct.Board*, i32, %frame.serveOne$fn.12.start$arrow0.rest }
%frame.serveOne$fn.12.start$arrow0.rest = type { [3 x <2 x i64>], i64, i32, { [0 x i64], %struct.Query }, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"start returns\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"main: hits \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" total \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"task \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c": answer \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare nonnull i8* @nish_async_spawn(i32 noundef, i64 noundef) #1
declare i8* @nish_async_enter(i8* nonnull) #1
declare void @nish_async_leave(i8* nonnull, i8*) #1
declare void @nish_async_done(i8* nonnull) #1
declare noundef i64 @nish_async_sleep(i32 noundef) #1
declare noundef i32 @nish_async_poll(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define weak_odr hidden i1 @nish.async.task.0(i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  %done = call i1 @serveOne$fn.12.start$arrow0.resume(i8* %frame)
  ret i1 %done
}

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

define internal void @Query.constructor(%struct.Query* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Query, %struct.Query* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(12) %struct.Board* @start() #1 {
entry:
  %board.addr = alloca %struct.Board*, align 8
  %scale.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.Board*
  %2 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !7
  %3 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 1
  store i32 0, i32* %3, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 2
  store i1 true, i1* %4, align 1, !tbaa !9
  store %struct.Board* %1, %struct.Board** %board.addr, align 8
  store i32 10, i32* %scale.addr, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sle i32 %5, 2
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = mul nsw i32 5, %8
  %10 = load %struct.Board*, %struct.Board** %board.addr, align 8
  %11 = load i32, i32* %scale.addr, align 4
  %12 = call i8* @nish_async_spawn(i32 0, i64 112)
  %13 = call i8* @nish_async_enter(i8* %12)
  %14 = getelementptr inbounds i8, i8* %12, i64 32
  %15 = bitcast i8* %14 to { i32, i32, i32, %struct.Board*, i32 }*
  %16 = getelementptr inbounds { i32, i32, i32, %struct.Board*, i32 }, { i32, i32, i32, %struct.Board*, i32 }* %15, i32 0, i32 0
  store i32 0, i32* %16
  %17 = getelementptr inbounds { i32, i32, i32, %struct.Board*, i32 }, { i32, i32, i32, %struct.Board*, i32 }* %15, i32 0, i32 1
  store i32 %7, i32* %17
  %18 = getelementptr inbounds { i32, i32, i32, %struct.Board*, i32 }, { i32, i32, i32, %struct.Board*, i32 }* %15, i32 0, i32 2
  store i32 %9, i32* %18
  %19 = getelementptr inbounds { i32, i32, i32, %struct.Board*, i32 }, { i32, i32, i32, %struct.Board*, i32 }* %15, i32 0, i32 3
  store %struct.Board* %10, %struct.Board** %19
  %20 = getelementptr inbounds { i32, i32, i32, %struct.Board*, i32 }, { i32, i32, i32, %struct.Board*, i32 }* %15, i32 0, i32 4
  store i32 %11, i32* %20
  %21 = call i1 @serveOne$fn.12.start$arrow0.resume(i8* %14)
  call void @nish_async_leave(i8* %12, i8* %13)
  br i1 %21, label %spawn.done, label %spawn.join

spawn.done:
  call void @nish_async_done(i8* %12)
  br label %spawn.join

spawn.join:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_print(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*))
  %24 = load %struct.Board*, %struct.Board** %board.addr, align 8
  ret %struct.Board* %24
}

define i1 @nish_main.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %board.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %0 = call %struct.Board* @start()
  store %struct.Board* %0, %struct.Board** %board.addr, align 8
  %1 = call i64 @nish_async_sleep(i32 40)
  store i64 %1, i64* %async.wait
  br label %wait.poll

wait.poll:
  %2 = load i64, i64* %async.wait
  %3 = call i32 @nish_async_poll(i64 %2)
  %4 = icmp slt i32 %3, 0
  br i1 %4, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %5 = icmp ne i32 %3, 0
  %6 = load %struct.Board*, %struct.Board** %board.addr, align 8
  %7 = getelementptr inbounds %struct.Board, %struct.Board* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !7
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*), i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  %12 = load %struct.Board*, %struct.Board** %board.addr, align 8
  %13 = getelementptr inbounds %struct.Board, %struct.Board* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !8
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %11, i8* %15)
  call void @nish_print(i8* %16)
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

define internal i1 @start$arrow0.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.start$arrow0*
  %async.state = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 0
  %q.at = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 1
  %q = load %struct.Query*, %struct.Query** %q.at
  %board.at = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 2
  %board = load %struct.Board*, %struct.Board** %board.at
  %scale.at = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 3
  %scale = load i32, i32* %scale.at
  %async.answer = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 4
  %async.rest = getelementptr inbounds %frame.start$arrow0, %frame.start$arrow0* %async.frame, i32 0, i32 5
  %async.kids = bitcast %frame.start$arrow0.rest* %async.rest to i8*
  %async.wait = getelementptr inbounds %frame.start$arrow0.rest, %frame.start$arrow0.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %0 = call i64 @nish_async_sleep(i32 1)
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
  %5 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !7
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 0
  store i32 %8, i32* %10, align 4, !tbaa !7
  %11 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !8
  %13 = getelementptr inbounds %struct.Query, %struct.Query* %q, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 %scale)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %16)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %21 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 1
  store i32 %19, i32* %21, align 4, !tbaa !8
  %22 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 2
  %23 = load i1, i1* %22, align 1, !tbaa !9
  br i1 %23, label %cond.true, label %cond.false

cond.true:
  %24 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 1
  %25 = load i32, i32* %24, align 4, !tbaa !8
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %26 = phi i32 [ %25, %cond.true ], [ -1, %cond.false ]
  store i32 %26, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  %ovf.op = phi i32 [ 0, %wait.ready ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal i1 @serveOne$fn.12.start$arrow0.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.serveOne$fn.12.start$arrow0*
  %async.state = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 0
  %n.at = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 1
  %n = load i32, i32* %n.at
  %ms.at = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 2
  %ms = load i32, i32* %ms.at
  %cap.0.at = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 3
  %cap.0 = load %struct.Board*, %struct.Board** %cap.0.at
  %cap.1.at = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 4
  %cap.1 = load i32, i32* %cap.1.at
  %async.rest = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0, %frame.serveOne$fn.12.start$arrow0* %async.frame, i32 0, i32 5
  %async.kids = bitcast %frame.serveOne$fn.12.start$arrow0.rest* %async.rest to i8*
  %async.wait = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0.rest, %frame.serveOne$fn.12.start$arrow0.rest* %async.rest, i32 0, i32 1
  %answer.addr = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0.rest, %frame.serveOne$fn.12.start$arrow0.rest* %async.rest, i32 0, i32 2
  %Query.obj = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0.rest, %frame.serveOne$fn.12.start$arrow0.rest* %async.rest, i32 0, i32 3, i32 1
  %async.spill.0 = getelementptr inbounds %frame.serveOne$fn.12.start$arrow0.rest, %frame.serveOne$fn.12.start$arrow0.rest* %async.rest, i32 0, i32 4
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll i32 2, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
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
  call void @Query.constructor(%struct.Query* %Query.obj, i32 %n)
  %5 = bitcast i8* %async.kids to { i32, %struct.Query*, %struct.Board*, i32, i32 }*
  %6 = getelementptr inbounds { i32, %struct.Query*, %struct.Board*, i32, i32 }, { i32, %struct.Query*, %struct.Board*, i32, i32 }* %5, i32 0, i32 0
  store i32 0, i32* %6
  %7 = getelementptr inbounds { i32, %struct.Query*, %struct.Board*, i32, i32 }, { i32, %struct.Query*, %struct.Board*, i32, i32 }* %5, i32 0, i32 1
  store %struct.Query* %Query.obj, %struct.Query** %7
  %8 = getelementptr inbounds { i32, %struct.Query*, %struct.Board*, i32, i32 }, { i32, %struct.Query*, %struct.Board*, i32, i32 }* %5, i32 0, i32 2
  store %struct.Board* %cap.0, %struct.Board** %8
  %9 = getelementptr inbounds { i32, %struct.Query*, %struct.Board*, i32, i32 }, { i32, %struct.Query*, %struct.Board*, i32, i32 }* %5, i32 0, i32 3
  store i32 %cap.1, i32* %9
  br label %await.poll

await.poll:
  %10 = call i1 @start$arrow0.resume(i8* %async.kids)
  br i1 %10, label %await.ready, label %await.pending

await.pending:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready:
  %11 = bitcast i8* %async.kids to { i32, %struct.Query*, %struct.Board*, i32, i32 }*
  %12 = getelementptr inbounds { i32, %struct.Query*, %struct.Board*, i32, i32 }, { i32, %struct.Query*, %struct.Board*, i32, i32 }* %11, i32 0, i32 4
  %13 = load i32, i32* %12
  store i32 %13, i32* %answer.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %n)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %17 = load i32, i32* %answer.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %16, i8* %18)
  call void @nish_print(i8* %19)
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

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!10, !11, !12, !13, !14}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Query", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"i1", !1, i64 0}
!6 = !{!"Board", !2, i64 0, !2, i64 4, !5, i64 8}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!6, !5, i64 8}
!10 = !{i32 8, !"cf-protection-branch", i32 1}
!11 = !{i32 8, !"cf-protection-return", i32 1}
!12 = !{i32 8, !"branch-target-enforcement", i32 1}
!13 = !{i32 8, !"sign-return-address", i32 1}
!14 = !{i32 4, !"probe-stack", !"inline-asm"}

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
  switch i32 %kind, label %bad [ i32 0, label %kind.0 ]

kind.0:
  %done.0 = call i1 @nish.async.task.0(i8* %frame)
  ret i1 %done.0

bad:
  call void @llvm.trap()
  unreachable
}
