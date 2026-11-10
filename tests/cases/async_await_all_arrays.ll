%struct.nish_array = type { i64, i64, i8* }
%frame.lane = type { i32, i32, i32, %struct.nish_array*, %frame.lane.rest }
%frame.lane.rest = type { [0 x <2 x i64>], %struct.nish_array*, i64 }
%frame.twice = type { i32, i32, %frame.twice.rest }
%frame.twice.rest = type { [6 x <2 x i64>], i64, i64, %struct.nish_array*, %struct.nish_array*, i64, i64, %struct.nish_array*, %struct.nish_array*, i64 }
%frame.inFor = type { i32, i32, %frame.inFor.rest }
%frame.inFor.rest = type { [6 x <2 x i64>], i32, i32, i64, i64, %struct.nish_array*, %struct.nish_array*, i8*, i64, i64 }
%frame.inWhile = type { i32, i32, %frame.inWhile.rest }
%frame.inWhile.rest = type { [6 x <2 x i64>], i32, i64, i64, %struct.nish_array*, %struct.nish_array*, i8*, i64, i64 }
%frame.inDo = type { i32, i32, %frame.inDo.rest }
%frame.inDo.rest = type { [6 x <2 x i64>], i32, i64, i64, %struct.nish_array*, %struct.nish_array*, i8*, i64, i64 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [12 x <2 x i64>], i32, i32, i32, i32, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_region_new() #2
declare i8* @nish_region_enter(i64 noundef) #2
declare void @nish_region_leave(i64 noundef, i8*) #2
declare void @nish_region_adopt(i64 noundef) #2
declare noundef i64 @nish_async_sleep(i32 noundef) #0
declare noundef i32 @nish_async_poll(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal i1 @lane.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.lane*
  %async.state = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 0
  %n.at = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 1
  %n = load i32, i32* %n.at
  %ms.at = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 2
  %ms = load i32, i32* %ms.at
  %async.answer = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 3
  %async.rest = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 4
  %async.kids = bitcast %frame.lane.rest* %async.rest to i8*
  %x.addr = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 %n, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %x.addr, align 8
  %8 = call i64 @nish_async_sleep(i32 %ms)
  store i64 %8, i64* %async.wait
  br label %wait.poll

wait.poll:
  %9 = load i64, i64* %async.wait
  %10 = call i32 @nish_async_poll(i64 %9)
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %12 = icmp ne i32 %10, 0
  %13 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  store %struct.nish_array* %13, %struct.nish_array** %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define internal i1 @twice.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.twice*
  %async.state = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.twice, %frame.twice* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.twice.rest* %async.rest to i8*
  %async.lane = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 1
  %async.lane.1 = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 2
  %a.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 3
  %b.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 4
  %async.lane.2 = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 5
  %async.lane.3 = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 6
  %c.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 7
  %d.addr = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 8
  %async.spill.0 = getelementptr inbounds %frame.twice.rest, %frame.twice.rest* %async.rest, i32 0, i32 9
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %0, i32 0, i32 1
  store i32 1, i32* %2
  %3 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %0, i32 0, i32 2
  store i32 1, i32* %3
  %4 = call i64 @nish_region_new()
  %5 = call i8* @nish_region_enter(i64 %4)
  %6 = call i1 @lane.resume(i8* %async.kids)
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
  %7 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %8 = bitcast i8* %7 to { i32, i32, i32, %struct.nish_array* }*
  %9 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %8, i32 0, i32 0
  store i32 0, i32* %9
  %10 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %8, i32 0, i32 1
  store i32 2, i32* %10
  %11 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %8, i32 0, i32 2
  store i32 1, i32* %11
  %12 = call i64 @nish_region_new()
  %13 = call i8* @nish_region_enter(i64 %12)
  %14 = call i1 @lane.resume(i8* %7)
  call void @nish_region_leave(i64 %12, i8* null)
  br i1 %14, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %12, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %12)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %15 = load i64, i64* %async.lane
  %16 = icmp eq i64 %15, 0
  br i1 %16, label %lane.next, label %lane.run

lane.run:
  %17 = call i8* @nish_region_enter(i64 %15)
  %18 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %15, i8* null)
  br i1 %18, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %15)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %19 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %20 = load i64, i64* %async.lane.1
  %21 = icmp eq i64 %20, 0
  br i1 %21, label %lane.next.1, label %lane.run.1

lane.run.1:
  %22 = call i8* @nish_region_enter(i64 %20)
  %23 = call i1 @lane.resume(i8* %19)
  call void @nish_region_leave(i64 %20, i8* null)
  br i1 %23, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %20)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %24 = load i64, i64* %async.lane
  %25 = icmp eq i64 %24, 0
  %26 = load i64, i64* %async.lane.1
  %27 = icmp eq i64 %26, 0
  %28 = and i1 %25, %27
  br i1 %28, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %29 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %30 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %29, i32 0, i32 3
  %31 = load %struct.nish_array*, %struct.nish_array** %30
  store %struct.nish_array* %31, %struct.nish_array** %a.addr, align 8
  %32 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %33 = bitcast i8* %32 to { i32, i32, i32, %struct.nish_array* }*
  %34 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %33, i32 0, i32 3
  %35 = load %struct.nish_array*, %struct.nish_array** %34
  store %struct.nish_array* %35, %struct.nish_array** %b.addr, align 8
  %36 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %37 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %36, i32 0, i32 0
  store i32 0, i32* %37
  %38 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %36, i32 0, i32 1
  store i32 3, i32* %38
  %39 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %36, i32 0, i32 2
  store i32 1, i32* %39
  %40 = call i64 @nish_region_new()
  %41 = call i8* @nish_region_enter(i64 %40)
  %42 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %40, i8* null)
  br i1 %42, label %lane.ran.2, label %lane.new.2

lane.new.2:
  store i64 %40, i64* %async.lane.2
  br label %lane.started.2

lane.ran.2:
  call void @nish_region_adopt(i64 %40)
  store i64 0, i64* %async.lane.2
  br label %lane.started.2

lane.started.2:
  %43 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %44 = bitcast i8* %43 to { i32, i32, i32, %struct.nish_array* }*
  %45 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %44, i32 0, i32 0
  store i32 0, i32* %45
  %46 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %44, i32 0, i32 1
  store i32 4, i32* %46
  %47 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %44, i32 0, i32 2
  store i32 1, i32* %47
  %48 = call i64 @nish_region_new()
  %49 = call i8* @nish_region_enter(i64 %48)
  %50 = call i1 @lane.resume(i8* %43)
  call void @nish_region_leave(i64 %48, i8* null)
  br i1 %50, label %lane.ran.3, label %lane.new.3

lane.new.3:
  store i64 %48, i64* %async.lane.3
  br label %lane.started.3

lane.ran.3:
  call void @nish_region_adopt(i64 %48)
  store i64 0, i64* %async.lane.3
  br label %lane.started.3

lane.started.3:
  br label %await.poll.1

await.poll.1:
  %51 = load i64, i64* %async.lane.2
  %52 = icmp eq i64 %51, 0
  br i1 %52, label %lane.next.2, label %lane.run.2

lane.run.2:
  %53 = call i8* @nish_region_enter(i64 %51)
  %54 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %51, i8* null)
  br i1 %54, label %lane.finish.2, label %lane.next.2

lane.finish.2:
  call void @nish_region_adopt(i64 %51)
  store i64 0, i64* %async.lane.2
  br label %lane.next.2

lane.next.2:
  %55 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %56 = load i64, i64* %async.lane.3
  %57 = icmp eq i64 %56, 0
  br i1 %57, label %lane.next.3, label %lane.run.3

lane.run.3:
  %58 = call i8* @nish_region_enter(i64 %56)
  %59 = call i1 @lane.resume(i8* %55)
  call void @nish_region_leave(i64 %56, i8* null)
  br i1 %59, label %lane.finish.3, label %lane.next.3

lane.finish.3:
  call void @nish_region_adopt(i64 %56)
  store i64 0, i64* %async.lane.3
  br label %lane.next.3

lane.next.3:
  %60 = load i64, i64* %async.lane.2
  %61 = icmp eq i64 %60, 0
  %62 = load i64, i64* %async.lane.3
  %63 = icmp eq i64 %62, 0
  %64 = and i1 %61, %63
  br i1 %64, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %65 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %66 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %65, i32 0, i32 3
  %67 = load %struct.nish_array*, %struct.nish_array** %66
  store %struct.nish_array* %67, %struct.nish_array** %c.addr, align 8
  %68 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %69 = bitcast i8* %68 to { i32, i32, i32, %struct.nish_array* }*
  %70 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %69, i32 0, i32 3
  %71 = load %struct.nish_array*, %struct.nish_array** %70
  store %struct.nish_array* %71, %struct.nish_array** %d.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 0, %74
  br i1 %75, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %74)
  unreachable

bounds.ok:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 0
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp ult i64 0, %83
  br i1 %84, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %83)
  unreachable

bounds.ok.1:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 0
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %80, i32 %89)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok

ovf.ok:
  %93 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 0, %95
  br i1 %96, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %95)
  unreachable

bounds.ok.2:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 0
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 %101)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %105 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ult i64 0, %107
  br i1 %108, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %107)
  unreachable

bounds.ok.3:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 0
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %114 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 %113)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %async.reload.0 = load i64, i64* %async.spill.0
  call void @nish_arena_release(i64 %async.reload.0)
  store i32 %115, i32* %async.answer
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

define internal i1 @inFor.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.inFor*
  %async.state = getelementptr inbounds %frame.inFor, %frame.inFor* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.inFor, %frame.inFor* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.inFor, %frame.inFor* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.inFor.rest* %async.rest to i8*
  %t.addr = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 1
  %i.addr = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 2
  %async.lane = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 3
  %async.lane.1 = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 4
  %a.addr = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 5
  %b.addr = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 6
  %async.spill.0 = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 7
  %async.spill.1 = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 8
  %async.spill.2 = getelementptr inbounds %frame.inFor.rest, %frame.inFor.rest* %async.rest, i32 0, i32 9
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.2
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  store i8* %3, i8** %async.spill.0
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i64 %5, i64* %async.spill.1
  %6 = load i32, i32* %i.addr, align 4
  %7 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %8 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %7, i32 0, i32 0
  store i32 0, i32* %8
  %9 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %7, i32 0, i32 1
  store i32 %6, i32* %9
  %10 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %7, i32 0, i32 2
  store i32 2, i32* %10
  %11 = call i64 @nish_region_new()
  %12 = call i8* @nish_region_enter(i64 %11)
  %13 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %11, i8* null)
  br i1 %13, label %lane.ran, label %lane.new

lane.new:
  store i64 %11, i64* %async.lane
  br label %lane.started

lane.ran:
  call void @nish_region_adopt(i64 %11)
  store i64 0, i64* %async.lane
  br label %lane.started

lane.started:
  %14 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %15 = bitcast i8* %14 to { i32, i32, i32, %struct.nish_array* }*
  %16 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %15, i32 0, i32 0
  store i32 0, i32* %16
  %17 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %15, i32 0, i32 1
  store i32 10, i32* %17
  %18 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %15, i32 0, i32 2
  store i32 1, i32* %18
  %19 = call i64 @nish_region_new()
  %20 = call i8* @nish_region_enter(i64 %19)
  %21 = call i1 @lane.resume(i8* %14)
  call void @nish_region_leave(i64 %19, i8* null)
  br i1 %21, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %19, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %19)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %22 = load i64, i64* %async.lane
  %23 = icmp eq i64 %22, 0
  br i1 %23, label %lane.next, label %lane.run

lane.run:
  %24 = call i8* @nish_region_enter(i64 %22)
  %25 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %22, i8* null)
  br i1 %25, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %22)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %26 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %27 = load i64, i64* %async.lane.1
  %28 = icmp eq i64 %27, 0
  br i1 %28, label %lane.next.1, label %lane.run.1

lane.run.1:
  %29 = call i8* @nish_region_enter(i64 %27)
  %30 = call i1 @lane.resume(i8* %26)
  call void @nish_region_leave(i64 %27, i8* null)
  br i1 %30, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %27)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %31 = load i64, i64* %async.lane
  %32 = icmp eq i64 %31, 0
  %33 = load i64, i64* %async.lane.1
  %34 = icmp eq i64 %33, 0
  %35 = and i1 %32, %34
  br i1 %35, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %36 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %37 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %36, i32 0, i32 3
  %38 = load %struct.nish_array*, %struct.nish_array** %37
  store %struct.nish_array* %38, %struct.nish_array** %a.addr, align 8
  %39 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %40 = bitcast i8* %39 to { i32, i32, i32, %struct.nish_array* }*
  %41 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %40, i32 0, i32 3
  %42 = load %struct.nish_array*, %struct.nish_array** %41
  store %struct.nish_array* %42, %struct.nish_array** %b.addr, align 8
  %43 = load i32, i32* %t.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 0
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = icmp ult i64 0, %55
  br i1 %56, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %55)
  unreachable

bounds.ok.1:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 0
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %61)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  %65 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %63, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %72 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %70)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %73, i32* %t.addr, align 4
  %75 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %76 = load i8*, i8** %75, align 8
  %async.reload.0 = load i8*, i8** %async.spill.0
  %77 = icmp eq i8* %76, %async.reload.0
  br i1 %77, label %pass.rewind, label %pass.free

pass.rewind:
  %78 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %async.reload.1 = load i64, i64* %async.spill.1
  store i64 %async.reload.1, i64* %78, align 8
  br label %pass.done

pass.free:
  %async.reload.2 = load i8*, i8** %async.spill.0
  %79 = ptrtoint i8* %async.reload.2 to i64
  %async.reload.3 = load i64, i64* %async.spill.1
  %80 = add i64 %79, %async.reload.3
  call void @nish_arena_release(i64 %80)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %81 = load i32, i32* %i.addr, align 4
  %82 = add nsw i32 %81, 1
  store i32 %82, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %83 = load i32, i32* %t.addr, align 4
  %async.reload.4 = load i64, i64* %async.spill.2
  call void @nish_arena_release(i64 %async.reload.4)
  store i32 %83, i32* %async.answer
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

define internal i1 @inWhile.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.inWhile*
  %async.state = getelementptr inbounds %frame.inWhile, %frame.inWhile* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.inWhile, %frame.inWhile* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.inWhile, %frame.inWhile* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.inWhile.rest* %async.rest to i8*
  %t.addr = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 1
  %async.lane = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 2
  %async.lane.1 = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 3
  %a.addr = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 4
  %b.addr = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 5
  %async.spill.0 = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 6
  %async.spill.1 = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 7
  %async.spill.2 = getelementptr inbounds %frame.inWhile.rest, %frame.inWhile.rest* %async.rest, i32 0, i32 8
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.2
  store i32 0, i32* %t.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %t.addr, align 4
  %1 = icmp slt i32 %0, 20
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  store i8* %3, i8** %async.spill.0
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i64 %5, i64* %async.spill.1
  %6 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %7 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %6, i32 0, i32 0
  store i32 0, i32* %7
  %8 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %6, i32 0, i32 1
  store i32 3, i32* %8
  %9 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %6, i32 0, i32 2
  store i32 1, i32* %9
  %10 = call i64 @nish_region_new()
  %11 = call i8* @nish_region_enter(i64 %10)
  %12 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %10, i8* null)
  br i1 %12, label %lane.ran, label %lane.new

lane.new:
  store i64 %10, i64* %async.lane
  br label %lane.started

lane.ran:
  call void @nish_region_adopt(i64 %10)
  store i64 0, i64* %async.lane
  br label %lane.started

lane.started:
  %13 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %14 = bitcast i8* %13 to { i32, i32, i32, %struct.nish_array* }*
  %15 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %14, i32 0, i32 0
  store i32 0, i32* %15
  %16 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %14, i32 0, i32 1
  store i32 4, i32* %16
  %17 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %14, i32 0, i32 2
  store i32 2, i32* %17
  %18 = call i64 @nish_region_new()
  %19 = call i8* @nish_region_enter(i64 %18)
  %20 = call i1 @lane.resume(i8* %13)
  call void @nish_region_leave(i64 %18, i8* null)
  br i1 %20, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %18, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %18)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %21 = load i64, i64* %async.lane
  %22 = icmp eq i64 %21, 0
  br i1 %22, label %lane.next, label %lane.run

lane.run:
  %23 = call i8* @nish_region_enter(i64 %21)
  %24 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %21, i8* null)
  br i1 %24, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %21)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %25 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %26 = load i64, i64* %async.lane.1
  %27 = icmp eq i64 %26, 0
  br i1 %27, label %lane.next.1, label %lane.run.1

lane.run.1:
  %28 = call i8* @nish_region_enter(i64 %26)
  %29 = call i1 @lane.resume(i8* %25)
  call void @nish_region_leave(i64 %26, i8* null)
  br i1 %29, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %26)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %30 = load i64, i64* %async.lane
  %31 = icmp eq i64 %30, 0
  %32 = load i64, i64* %async.lane.1
  %33 = icmp eq i64 %32, 0
  %34 = and i1 %31, %33
  br i1 %34, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %35 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %36 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %35, i32 0, i32 3
  %37 = load %struct.nish_array*, %struct.nish_array** %36
  store %struct.nish_array* %37, %struct.nish_array** %a.addr, align 8
  %38 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %39 = bitcast i8* %38 to { i32, i32, i32, %struct.nish_array* }*
  %40 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %39, i32 0, i32 3
  %41 = load %struct.nish_array*, %struct.nish_array** %40
  store %struct.nish_array* %41, %struct.nish_array** %b.addr, align 8
  %42 = load i32, i32* %t.addr, align 4
  %43 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 0, %45
  br i1 %46, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %45)
  unreachable

bounds.ok:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 0
  %51 = load i32, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %52 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 0
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %62)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %65, i32* %t.addr, align 4
  %67 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %68 = load i8*, i8** %67, align 8
  %async.reload.0 = load i8*, i8** %async.spill.0
  %69 = icmp eq i8* %68, %async.reload.0
  br i1 %69, label %pass.rewind, label %pass.free

pass.rewind:
  %70 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %async.reload.1 = load i64, i64* %async.spill.1
  store i64 %async.reload.1, i64* %70, align 8
  br label %pass.done

pass.free:
  %async.reload.2 = load i8*, i8** %async.spill.0
  %71 = ptrtoint i8* %async.reload.2 to i64
  %async.reload.3 = load i64, i64* %async.spill.1
  %72 = add i64 %71, %async.reload.3
  call void @nish_arena_release(i64 %72)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %73 = load i32, i32* %t.addr, align 4
  %async.reload.4 = load i64, i64* %async.spill.2
  call void @nish_arena_release(i64 %async.reload.4)
  store i32 %73, i32* %async.answer
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

define internal i1 @inDo.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.inDo*
  %async.state = getelementptr inbounds %frame.inDo, %frame.inDo* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.inDo, %frame.inDo* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.inDo, %frame.inDo* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.inDo.rest* %async.rest to i8*
  %t.addr = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 1
  %async.lane = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 2
  %async.lane.1 = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 3
  %a.addr = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 4
  %b.addr = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 5
  %async.spill.0 = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 6
  %async.spill.1 = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 7
  %async.spill.2 = getelementptr inbounds %frame.inDo.rest, %frame.inDo.rest* %async.rest, i32 0, i32 8
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.2
  store i32 0, i32* %t.addr, align 4
  br label %do.body

do.body:
  %0 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %1 = load i8*, i8** %0, align 8
  store i8* %1, i8** %async.spill.0
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %3 = load i64, i64* %2, align 8
  store i64 %3, i64* %async.spill.1
  %4 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %5 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %4, i32 0, i32 0
  store i32 0, i32* %5
  %6 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %4, i32 0, i32 1
  store i32 5, i32* %6
  %7 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %4, i32 0, i32 2
  store i32 1, i32* %7
  %8 = call i64 @nish_region_new()
  %9 = call i8* @nish_region_enter(i64 %8)
  %10 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %8, i8* null)
  br i1 %10, label %lane.ran, label %lane.new

lane.new:
  store i64 %8, i64* %async.lane
  br label %lane.started

lane.ran:
  call void @nish_region_adopt(i64 %8)
  store i64 0, i64* %async.lane
  br label %lane.started

lane.started:
  %11 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %12 = bitcast i8* %11 to { i32, i32, i32, %struct.nish_array* }*
  %13 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %12, i32 0, i32 0
  store i32 0, i32* %13
  %14 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %12, i32 0, i32 1
  store i32 6, i32* %14
  %15 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %12, i32 0, i32 2
  store i32 1, i32* %15
  %16 = call i64 @nish_region_new()
  %17 = call i8* @nish_region_enter(i64 %16)
  %18 = call i1 @lane.resume(i8* %11)
  call void @nish_region_leave(i64 %16, i8* null)
  br i1 %18, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %16, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %16)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %19 = load i64, i64* %async.lane
  %20 = icmp eq i64 %19, 0
  br i1 %20, label %lane.next, label %lane.run

lane.run:
  %21 = call i8* @nish_region_enter(i64 %19)
  %22 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %19, i8* null)
  br i1 %22, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %19)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %23 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %24 = load i64, i64* %async.lane.1
  %25 = icmp eq i64 %24, 0
  br i1 %25, label %lane.next.1, label %lane.run.1

lane.run.1:
  %26 = call i8* @nish_region_enter(i64 %24)
  %27 = call i1 @lane.resume(i8* %23)
  call void @nish_region_leave(i64 %24, i8* null)
  br i1 %27, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %24)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %28 = load i64, i64* %async.lane
  %29 = icmp eq i64 %28, 0
  %30 = load i64, i64* %async.lane.1
  %31 = icmp eq i64 %30, 0
  %32 = and i1 %29, %31
  br i1 %32, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %33 = bitcast i8* %async.kids to { i32, i32, i32, %struct.nish_array* }*
  %34 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %33, i32 0, i32 3
  %35 = load %struct.nish_array*, %struct.nish_array** %34
  store %struct.nish_array* %35, %struct.nish_array** %a.addr, align 8
  %36 = getelementptr inbounds i8, i8* %async.kids, i64 48
  %37 = bitcast i8* %36 to { i32, i32, i32, %struct.nish_array* }*
  %38 = getelementptr inbounds { i32, i32, i32, %struct.nish_array* }, { i32, i32, i32, %struct.nish_array* }* %37, i32 0, i32 3
  %39 = load %struct.nish_array*, %struct.nish_array** %38
  store %struct.nish_array* %39, %struct.nish_array** %b.addr, align 8
  %40 = load i32, i32* %t.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 0
  %49 = load i32, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 0, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 0
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %49, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok

ovf.ok:
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 %60)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %63, i32* %t.addr, align 4
  %65 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %66 = load i8*, i8** %65, align 8
  %async.reload.0 = load i8*, i8** %async.spill.0
  %67 = icmp eq i8* %66, %async.reload.0
  br i1 %67, label %pass.rewind, label %pass.free

pass.rewind:
  %68 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %async.reload.1 = load i64, i64* %async.spill.1
  store i64 %async.reload.1, i64* %68, align 8
  br label %pass.done

pass.free:
  %async.reload.2 = load i8*, i8** %async.spill.0
  %69 = ptrtoint i8* %async.reload.2 to i64
  %async.reload.3 = load i64, i64* %async.spill.1
  %70 = add i64 %69, %async.reload.3
  call void @nish_arena_release(i64 %70)
  br label %pass.done

pass.done:
  br label %do.cond

do.cond:
  %71 = load i32, i32* %t.addr, align 4
  %72 = icmp slt i32 %71, 60
  br i1 %72, label %do.body, label %do.end

do.end:
  %73 = load i32, i32* %t.addr, align 4
  %async.reload.4 = load i64, i64* %async.spill.2
  call void @nish_arena_release(i64 %async.reload.4)
  store i32 %73, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %sum.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %forSum.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %whileSum.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %doSum.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 i32 3, label %await.poll.2 i32 4, label %await.poll.3 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i32 }*
  %1 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  br label %await.poll

await.poll:
  %2 = call i1 @twice.resume(i8* %async.kids)
  br i1 %2, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %3 = bitcast i8* %async.kids to { i32, i32 }*
  %4 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %3, i32 0, i32 1
  %5 = load i32, i32* %4
  store i32 %5, i32* %sum.addr, align 4
  %6 = load i32, i32* %sum.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = bitcast i8* %async.kids to { i32, i32 }*
  %9 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %8, i32 0, i32 0
  store i32 0, i32* %9
  br label %await.poll.1

await.poll.1:
  %10 = call i1 @inFor.resume(i8* %async.kids)
  br i1 %10, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %11 = bitcast i8* %async.kids to { i32, i32 }*
  %12 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %11, i32 0, i32 1
  %13 = load i32, i32* %12
  store i32 %13, i32* %forSum.addr, align 4
  %14 = load i32, i32* %forSum.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = bitcast i8* %async.kids to { i32, i32 }*
  %17 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %16, i32 0, i32 0
  store i32 0, i32* %17
  br label %await.poll.2

await.poll.2:
  %18 = call i1 @inWhile.resume(i8* %async.kids)
  br i1 %18, label %await.ready.2, label %await.pending.2

await.pending.2:
  store i32 3, i32* %async.state
  br label %async.suspend

await.ready.2:
  %19 = bitcast i8* %async.kids to { i32, i32 }*
  %20 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %19, i32 0, i32 1
  %21 = load i32, i32* %20
  store i32 %21, i32* %whileSum.addr, align 4
  %22 = load i32, i32* %whileSum.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = bitcast i8* %async.kids to { i32, i32 }*
  %25 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %24, i32 0, i32 0
  store i32 0, i32* %25
  br label %await.poll.3

await.poll.3:
  %26 = call i1 @inDo.resume(i8* %async.kids)
  br i1 %26, label %await.ready.3, label %await.pending.3

await.pending.3:
  store i32 4, i32* %async.state
  br label %async.suspend

await.ready.3:
  %27 = bitcast i8* %async.kids to { i32, i32 }*
  %28 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %27, i32 0, i32 1
  %29 = load i32, i32* %28
  store i32 %29, i32* %doSum.addr, align 4
  %30 = load i32, i32* %doSum.addr, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
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
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}

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
