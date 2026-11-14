%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%frame.nish_main = type { i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [0 x <2 x i64>], %struct.Point*, { [0 x i64], %struct.Point }, %struct.nish_array*, %struct.nish_array, [2 x %struct.Point*], %struct.Point*, i64, i32, i32, i32, %struct.nish_array, { [0 x i64], [2 x i32] }, %struct.nish_array*, %struct.nish_array, { [0 x i64], [2 x i32] }, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Point.sum(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %x.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = load i32, i32* %y.addr, align 4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @scaled(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, i32 noundef %k) #1 {
entry:
  %px.addr = alloca i32, align 4
  %py.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %px.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %py.addr, align 4
  %4 = load i32, i32* %px.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %k)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = load i32, i32* %py.addr, align 4
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 %k)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @later(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %7, i32* %a.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = icmp ult i64 1, %9
  br i1 %10, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %9)
  unreachable

bounds.ok.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 1
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %b.addr, align 4
  %16 = load i32, i32* %a.addr, align 4
  %17 = load i32, i32* %b.addr, align 4
  %18 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %16, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define i1 @nish_main.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %p.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %Point.obj = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2, i32 1
  %rows.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %arr.hdr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %arr.data = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %pattern.752.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 6
  %forof.idx = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 7
  %x.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 8
  %y.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 9
  %d.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 10
  %arr.hdr.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 11
  %arr.data.1 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 12, i32 1
  %xs.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 13
  %arr.hdr.2 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 14
  %arr.data.2 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 15, i32 1
  %i.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 16
  %n.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 17
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = call i32 @Point.sum(%struct.Point* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %4 = call i32 @scaled(%struct.Point* %3, i32 2)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Point*
  call void @Point.constructor(%struct.Point* %7, i32 1, i32 2)
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Point*
  call void @Point.constructor(%struct.Point* %9, i32 5, i32 6)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %12 = bitcast [2 x %struct.Point*]* %arr.data to i8*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = bitcast i8* %12 to %struct.Point**
  %15 = getelementptr inbounds %struct.Point*, %struct.Point** %14, i64 0
  store %struct.Point* %7, %struct.Point** %15, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %16 = getelementptr inbounds %struct.Point*, %struct.Point** %14, i64 1
  store %struct.Point* %9, %struct.Point** %16, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %18 = load i64, i64* %forof.idx, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %forof.body, label %forof.end

forof.body:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = bitcast i8* %23 to %struct.Point**
  %25 = getelementptr inbounds %struct.Point*, %struct.Point** %24, i64 %18
  %26 = load %struct.Point*, %struct.Point** %25, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  store %struct.Point* %26, %struct.Point** %pattern.752.addr, align 8
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = load %struct.Point*, %struct.Point** %pattern.752.addr, align 8
  %32 = getelementptr inbounds %struct.Point, %struct.Point* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4, !tbaa !4
  store i32 %33, i32* %x.addr, align 4
  %34 = load %struct.Point*, %struct.Point** %pattern.752.addr, align 8
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %34, i32 0, i32 1
  %36 = load i32, i32* %35, align 4, !tbaa !5
  store i32 %36, i32* %y.addr, align 4
  %37 = load i32, i32* %x.addr, align 4
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 10)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %39, i32* %x.addr, align 4
  %41 = load i32, i32* %x.addr, align 4
  %42 = load i32, i32* %y.addr, align 4
  %43 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %41, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %46 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %46)
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %48 = load i8*, i8** %47, align 8
  %49 = icmp eq i8* %48, %28
  br i1 %49, label %pass.rewind, label %pass.free

pass.rewind:
  %50 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %30, i64* %50, align 8
  br label %pass.done

pass.free:
  %51 = ptrtoint i8* %28 to i64
  %52 = add i64 %51, %30
  call void @nish_arena_release(i64 %52)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %53 = load i64, i64* %forof.idx, align 8
  %54 = add i64 %53, 1
  store i64 %54, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %55, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %56, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %57 = bitcast [2 x i32]* %arr.data.1 to i8*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %57, i8** %58, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %57 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 0
  store i32 9, i32* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %61 = getelementptr inbounds i32, i32* %59, i64 1
  store i32 4, i32* %61, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %62 = call i32 @later(%struct.nish_array* %arr.hdr.1)
  store i32 %62, i32* %d.addr, align 4
  %63 = load i32, i32* %d.addr, align 4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  call void @nish_print(i8* %64)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %65, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %66, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %67 = bitcast [2 x i32]* %arr.data.2 to i8*
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %67, i8** %68, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %69 = bitcast i8* %67 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 0
  store i32 0, i32* %70, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %71 = getelementptr inbounds i32, i32* %69, i64 1
  store i32 3, i32* %71, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %xs.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 0
  %77 = load i32, i32* %76, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %77, i32* %i.addr, align 4
  %78 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %81 = bitcast i8* %80 to i32*
  %82 = getelementptr inbounds i32, i32* %81, i64 1
  %83 = load i32, i32* %82, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %83, i32* %n.addr, align 4
  %84 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %87 = load i32, i32* %i.addr, align 4
  %88 = load i32, i32* %n.addr, align 4
  %89 = icmp slt i32 %87, %88
  br i1 %89, label %for.body, label %for.end

for.body:
  %90 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %91 = load i8*, i8** %90, align 8
  %92 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %93 = load i64, i64* %92, align 8
  %94 = load i32, i32* %i.addr, align 4
  %95 = call i8* @nish_str_from_i32(i32 %94)
  call void @nish_print(i8* %95)
  %96 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %97 = load i8*, i8** %96, align 8
  %98 = icmp eq i8* %97, %91
  br i1 %98, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %93, i64* %99, align 8
  br label %pass.done.1

pass.free.1:
  %100 = ptrtoint i8* %91 to i64
  %101 = add i64 %100, %93
  call void @nish_arena_release(i64 %101)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %102 = load i32, i32* %i.addr, align 4
  %103 = add nsw i32 %102, 1
  store i32 %103, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  %ovf.op = phi i32 [ 0, %forof.body ], [ 2, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!"element ptr", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}

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
