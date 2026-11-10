%struct.nish_array = type { i64, i64, i8* }
%frame.lane = type { i32, i32, i32, i32, i32, %frame.lane.rest }
%frame.lane.rest = type { [0 x <2 x i64>], %struct.nish_array*, i32, i64, %struct.nish_array*, i64, i32, i64 }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [12 x <2 x i64>], i64, i64, i32, i32, i64, i64, i32, i32, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
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
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4

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
  %seed.at = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 2
  %seed = load i32, i32* %seed.at
  %ms.at = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 3
  %ms = load i32, i32* %ms.at
  %async.answer = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 4
  %async.rest = getelementptr inbounds %frame.lane, %frame.lane* %async.frame, i32 0, i32 5
  %async.kids = bitcast %frame.lane.rest* %async.rest to i8*
  %xs.addr = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 1
  %i.addr = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 2
  %async.wait = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 3
  %ys.addr = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 4
  %async.wait.1 = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 5
  %sum.addr = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 6
  %async.spill.0 = getelementptr inbounds %frame.lane.rest, %frame.lane.rest* %async.rest, i32 0, i32 7
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll i32 2, label %wait.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %seed, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = bitcast i8* %13 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %18
  store i32 %21, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %27 = call i64 @nish_async_sleep(i32 %ms)
  store i64 %27, i64* %async.wait
  br label %wait.poll

wait.poll:
  %28 = load i64, i64* %async.wait
  %29 = call i32 @nish_async_poll(i64 %28)
  %30 = icmp slt i32 %29, 0
  br i1 %30, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %31 = icmp ne i32 %29, 0
  %32 = sext i32 %n to i64
  %33 = icmp ule i64 %32, 2147483647
  br i1 %33, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok.1:
  %34 = call i8* @nish_alloc_struct(i64 24)
  %35 = bitcast i8* %34 to %struct.nish_array*
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  store i64 %32, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1
  store i64 %32, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = mul i64 %32, 4
  %39 = call i8* @nish_alloc_struct(i64 %38)
  call void @llvm.memset.p0i8.i64(i8* align 8 %39, i8 0, i64 %38, i1 false), !alias.scope !4, !noalias !3
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %35, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %51 = load i32, i32* %i.addr, align 4
  %52 = trunc i64 %43 to i32
  %53 = icmp slt i32 %51, %52
  br i1 %53, label %land.rhs, label %land.end

land.rhs:
  %54 = load i32, i32* %i.addr, align 4
  %55 = trunc i64 %48 to i32
  %56 = icmp slt i32 %54, %55
  br label %land.end

land.end:
  %57 = phi i1 [ false, %while.cond.1 ], [ %56, %land.rhs ]
  br i1 %57, label %while.body.1, label %while.end.1

while.body.1:
  %58 = load i32, i32* %i.addr, align 4
  %59 = sext i32 %58 to i64
  %60 = load i32, i32* %i.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = bitcast i8* %45 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %61
  %64 = load i32, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %64, i32 %seed)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %68 = bitcast i8* %50 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 %59
  store i32 %66, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = load i32, i32* %i.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %72 = call i64 @nish_async_sleep(i32 %ms)
  store i64 %72, i64* %async.wait.1
  br label %wait.poll.1

wait.poll.1:
  %73 = load i64, i64* %async.wait.1
  %74 = call i32 @nish_async_poll(i64 %73)
  %75 = icmp slt i32 %74, 0
  br i1 %75, label %wait.pending.1, label %wait.ready.1

wait.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

wait.ready.1:
  %76 = icmp ne i32 %74, 0
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %77 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.2

while.cond.2:
  %87 = load i32, i32* %i.addr, align 4
  %88 = trunc i64 %79 to i32
  %89 = icmp slt i32 %87, %88
  br i1 %89, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %90 = load i32, i32* %i.addr, align 4
  %91 = trunc i64 %84 to i32
  %92 = icmp slt i32 %90, %91
  br label %land.end.1

land.end.1:
  %93 = phi i1 [ false, %while.cond.2 ], [ %92, %land.rhs.1 ]
  br i1 %93, label %while.body.2, label %while.end.2

while.body.2:
  %94 = load i32, i32* %sum.addr, align 4
  %95 = load i32, i32* %i.addr, align 4
  %96 = sext i32 %95 to i64
  %97 = bitcast i8* %81 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 %96
  %99 = load i32, i32* %98, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %100 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %99, i32 %seed)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %103 = load i32, i32* %i.addr, align 4
  %104 = sext i32 %103 to i64
  %105 = bitcast i8* %86 to i32*
  %106 = getelementptr inbounds i32, i32* %105, i64 %104
  %107 = load i32, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %108 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %101, i32 %107)
  %109 = extractvalue { i32, i1 } %108, 0
  %110 = extractvalue { i32, i1 } %108, 1
  br i1 %110, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %111 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 %109)
  %112 = extractvalue { i32, i1 } %111, 0
  %113 = extractvalue { i32, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %112, i32* %sum.addr, align 4
  %114 = load i32, i32* %i.addr, align 4
  %115 = add nsw i32 %114, 1
  store i32 %115, i32* %i.addr, align 4
  br label %while.cond.2

while.end.2:
  %116 = load i32, i32* %sum.addr, align 4
  %117 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  %120 = load i64, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %121 = trunc i64 %120 to i32
  %122 = sub nsw i32 %121, 1
  %123 = sext i32 %122 to i64
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = icmp ult i64 %123, %125
  br i1 %126, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %123, i64 %125)
  unreachable

bounds.ok:
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %128 to i32*
  %130 = getelementptr inbounds i32, i32* %129, i64 %123
  %131 = load i32, i32* %130, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %132 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %116, i32 %131)
  %133 = extractvalue { i32, i1 } %132, 0
  %134 = extractvalue { i32, i1 } %132, 1
  br i1 %134, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %async.reload.0 = load i64, i64* %async.spill.0
  call void @nish_arena_release(i64 %async.reload.0)
  store i32 %133, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.body ], [ 1, %while.body.1 ], [ 1, %while.body.2 ], [ 1, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %bounds.ok ]
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
  %async.lane = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.lane.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %a.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %b.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %async.lane.2 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %async.lane.3 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 6
  %c.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 7
  %d.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 8
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 9
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = bitcast i8* %async.kids to { i32, i32, i32, i32, i32 }*
  %1 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %0, i32 0, i32 0
  store i32 0, i32* %1
  %2 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %0, i32 0, i32 1
  store i32 200000, i32* %2
  %3 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %0, i32 0, i32 2
  store i32 1, i32* %3
  %4 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %0, i32 0, i32 3
  store i32 2, i32* %4
  %5 = call i64 @nish_region_new()
  %6 = call i8* @nish_region_enter(i64 %5)
  %7 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %5, i8* null)
  br i1 %7, label %lane.ran, label %lane.new

lane.new:
  store i64 %5, i64* %async.lane
  br label %lane.started

lane.ran:
  call void @nish_region_adopt(i64 %5)
  store i64 0, i64* %async.lane
  br label %lane.started

lane.started:
  %8 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %9 = bitcast i8* %8 to { i32, i32, i32, i32, i32 }*
  %10 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %9, i32 0, i32 0
  store i32 0, i32* %10
  %11 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %9, i32 0, i32 1
  store i32 200000, i32* %11
  %12 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %9, i32 0, i32 2
  store i32 1000, i32* %12
  %13 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %9, i32 0, i32 3
  store i32 1, i32* %13
  %14 = call i64 @nish_region_new()
  %15 = call i8* @nish_region_enter(i64 %14)
  %16 = call i1 @lane.resume(i8* %8)
  call void @nish_region_leave(i64 %14, i8* null)
  br i1 %16, label %lane.ran.1, label %lane.new.1

lane.new.1:
  store i64 %14, i64* %async.lane.1
  br label %lane.started.1

lane.ran.1:
  call void @nish_region_adopt(i64 %14)
  store i64 0, i64* %async.lane.1
  br label %lane.started.1

lane.started.1:
  br label %await.poll

await.poll:
  %17 = load i64, i64* %async.lane
  %18 = icmp eq i64 %17, 0
  br i1 %18, label %lane.next, label %lane.run

lane.run:
  %19 = call i8* @nish_region_enter(i64 %17)
  %20 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %17, i8* null)
  br i1 %20, label %lane.finish, label %lane.next

lane.finish:
  call void @nish_region_adopt(i64 %17)
  store i64 0, i64* %async.lane
  br label %lane.next

lane.next:
  %21 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %22 = load i64, i64* %async.lane.1
  %23 = icmp eq i64 %22, 0
  br i1 %23, label %lane.next.1, label %lane.run.1

lane.run.1:
  %24 = call i8* @nish_region_enter(i64 %22)
  %25 = call i1 @lane.resume(i8* %21)
  call void @nish_region_leave(i64 %22, i8* null)
  br i1 %25, label %lane.finish.1, label %lane.next.1

lane.finish.1:
  call void @nish_region_adopt(i64 %22)
  store i64 0, i64* %async.lane.1
  br label %lane.next.1

lane.next.1:
  %26 = load i64, i64* %async.lane
  %27 = icmp eq i64 %26, 0
  %28 = load i64, i64* %async.lane.1
  %29 = icmp eq i64 %28, 0
  %30 = and i1 %27, %29
  br i1 %30, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %31 = bitcast i8* %async.kids to { i32, i32, i32, i32, i32 }*
  %32 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %31, i32 0, i32 4
  %33 = load i32, i32* %32
  store i32 %33, i32* %a.addr, align 4
  %34 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %35 = bitcast i8* %34 to { i32, i32, i32, i32, i32 }*
  %36 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %35, i32 0, i32 4
  %37 = load i32, i32* %36
  store i32 %37, i32* %b.addr, align 4
  %38 = load i32, i32* %a.addr, align 4
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = load i32, i32* %b.addr, align 4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  call void @nish_print(i8* %41)
  %42 = bitcast i8* %async.kids to { i32, i32, i32, i32, i32 }*
  %43 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %42, i32 0, i32 0
  store i32 0, i32* %43
  %44 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %42, i32 0, i32 1
  store i32 32000, i32* %44
  %45 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %42, i32 0, i32 2
  store i32 7, i32* %45
  %46 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %42, i32 0, i32 3
  store i32 1, i32* %46
  %47 = call i64 @nish_region_new()
  %48 = call i8* @nish_region_enter(i64 %47)
  %49 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %47, i8* null)
  br i1 %49, label %lane.ran.2, label %lane.new.2

lane.new.2:
  store i64 %47, i64* %async.lane.2
  br label %lane.started.2

lane.ran.2:
  call void @nish_region_adopt(i64 %47)
  store i64 0, i64* %async.lane.2
  br label %lane.started.2

lane.started.2:
  %50 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %51 = bitcast i8* %50 to { i32, i32, i32, i32, i32 }*
  %52 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %51, i32 0, i32 0
  store i32 0, i32* %52
  %53 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %51, i32 0, i32 1
  store i32 32000, i32* %53
  %54 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %51, i32 0, i32 2
  store i32 70, i32* %54
  %55 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %51, i32 0, i32 3
  store i32 2, i32* %55
  %56 = call i64 @nish_region_new()
  %57 = call i8* @nish_region_enter(i64 %56)
  %58 = call i1 @lane.resume(i8* %50)
  call void @nish_region_leave(i64 %56, i8* null)
  br i1 %58, label %lane.ran.3, label %lane.new.3

lane.new.3:
  store i64 %56, i64* %async.lane.3
  br label %lane.started.3

lane.ran.3:
  call void @nish_region_adopt(i64 %56)
  store i64 0, i64* %async.lane.3
  br label %lane.started.3

lane.started.3:
  br label %await.poll.1

await.poll.1:
  %59 = load i64, i64* %async.lane.2
  %60 = icmp eq i64 %59, 0
  br i1 %60, label %lane.next.2, label %lane.run.2

lane.run.2:
  %61 = call i8* @nish_region_enter(i64 %59)
  %62 = call i1 @lane.resume(i8* %async.kids)
  call void @nish_region_leave(i64 %59, i8* null)
  br i1 %62, label %lane.finish.2, label %lane.next.2

lane.finish.2:
  call void @nish_region_adopt(i64 %59)
  store i64 0, i64* %async.lane.2
  br label %lane.next.2

lane.next.2:
  %63 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %64 = load i64, i64* %async.lane.3
  %65 = icmp eq i64 %64, 0
  br i1 %65, label %lane.next.3, label %lane.run.3

lane.run.3:
  %66 = call i8* @nish_region_enter(i64 %64)
  %67 = call i1 @lane.resume(i8* %63)
  call void @nish_region_leave(i64 %64, i8* null)
  br i1 %67, label %lane.finish.3, label %lane.next.3

lane.finish.3:
  call void @nish_region_adopt(i64 %64)
  store i64 0, i64* %async.lane.3
  br label %lane.next.3

lane.next.3:
  %68 = load i64, i64* %async.lane.2
  %69 = icmp eq i64 %68, 0
  %70 = load i64, i64* %async.lane.3
  %71 = icmp eq i64 %70, 0
  %72 = and i1 %69, %71
  br i1 %72, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %73 = bitcast i8* %async.kids to { i32, i32, i32, i32, i32 }*
  %74 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %73, i32 0, i32 4
  %75 = load i32, i32* %74
  store i32 %75, i32* %c.addr, align 4
  %76 = getelementptr inbounds i8, i8* %async.kids, i64 96
  %77 = bitcast i8* %76 to { i32, i32, i32, i32, i32 }*
  %78 = getelementptr inbounds { i32, i32, i32, i32, i32 }, { i32, i32, i32, i32, i32 }* %77, i32 0, i32 4
  %79 = load i32, i32* %78
  store i32 %79, i32* %d.addr, align 4
  %80 = load i32, i32* %c.addr, align 4
  %81 = call i8* @nish_str_from_i32(i32 %80)
  call void @nish_print(i8* %81)
  %82 = load i32, i32* %d.addr, align 4
  %83 = call i8* @nish_str_from_i32(i32 %82)
  call void @nish_print(i8* %83)
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
