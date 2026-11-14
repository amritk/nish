%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define noundef i32 @object_pattern(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %x.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 3)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = load i32, i32* %y.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %10

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @object_plain(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %x.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 3)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = load i32, i32* %y.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %10

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @array_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
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
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = load i32, i32* %b.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @array_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
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
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = load i32, i32* %b.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @for_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %points) #1 {
entry:
  %total.addr = alloca i32, align 4
  %pattern.883.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %points, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %points, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to %struct.Point**
  %7 = getelementptr inbounds %struct.Point*, %struct.Point** %6, i64 %0
  %8 = load %struct.Point*, %struct.Point** %7, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.Point* %8, %struct.Point** %pattern.883.addr, align 8
  %9 = load %struct.Point*, %struct.Point** %pattern.883.addr, align 8
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !4
  store i32 %11, i32* %x.addr, align 4
  %12 = load %struct.Point*, %struct.Point** %pattern.883.addr, align 8
  %13 = getelementptr inbounds %struct.Point, %struct.Point* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !5
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %total.addr, align 4
  %16 = load i32, i32* %x.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %18)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = load i32, i32* %y.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %25, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = add i64 %27, 1
  store i64 %28, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %29 = load i32, i32* %total.addr, align 4
  ret i32 %29

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @for_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %points) #1 {
entry:
  %total.addr = alloca i32, align 4
  %point.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %points, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %points, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to %struct.Point**
  %7 = getelementptr inbounds %struct.Point*, %struct.Point** %6, i64 %0
  %8 = load %struct.Point*, %struct.Point** %7, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.Point* %8, %struct.Point** %point.addr, align 8
  %9 = load %struct.Point*, %struct.Point** %point.addr, align 8
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !4
  store i32 %11, i32* %x.addr, align 4
  %12 = load %struct.Point*, %struct.Point** %point.addr, align 8
  %13 = getelementptr inbounds %struct.Point, %struct.Point* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !5
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %total.addr, align 4
  %16 = load i32, i32* %x.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %18)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = load i32, i32* %y.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %25, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = add i64 %27, 1
  store i64 %28, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %29 = load i32, i32* %total.addr, align 4
  ret i32 %29

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @local_pattern(i32 noundef %n) #1 {
entry:
  %points.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point*], align 8
  %total.addr = alloca i32, align 4
  %pattern.1439.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 %n, i32 2)
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 3, i32 %n)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %6 = bitcast [2 x %struct.Point*]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = bitcast i8* %6 to %struct.Point**
  %9 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 0
  store %struct.Point* %1, %struct.Point** %9, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %10 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 1
  store %struct.Point* %3, %struct.Point** %10, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %points.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = bitcast i8* %17 to %struct.Point**
  %19 = getelementptr inbounds %struct.Point*, %struct.Point** %18, i64 %12
  %20 = load %struct.Point*, %struct.Point** %19, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.Point* %20, %struct.Point** %pattern.1439.addr, align 8
  %21 = load %struct.Point*, %struct.Point** %pattern.1439.addr, align 8
  %22 = getelementptr inbounds %struct.Point, %struct.Point* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !4
  store i32 %23, i32* %x.addr, align 4
  %24 = load %struct.Point*, %struct.Point** %pattern.1439.addr, align 8
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !5
  store i32 %26, i32* %y.addr, align 4
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %x.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %30)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = load i32, i32* %y.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = load i32, i32* %total.addr, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @local_plain(i32 noundef %n) #1 {
entry:
  %points.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point*], align 8
  %total.addr = alloca i32, align 4
  %point.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 %n, i32 2)
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 3, i32 %n)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %6 = bitcast [2 x %struct.Point*]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = bitcast i8* %6 to %struct.Point**
  %9 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 0
  store %struct.Point* %1, %struct.Point** %9, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %10 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 1
  store %struct.Point* %3, %struct.Point** %10, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %points.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = bitcast i8* %17 to %struct.Point**
  %19 = getelementptr inbounds %struct.Point*, %struct.Point** %18, i64 %12
  %20 = load %struct.Point*, %struct.Point** %19, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.Point* %20, %struct.Point** %point.addr, align 8
  %21 = load %struct.Point*, %struct.Point** %point.addr, align 8
  %22 = getelementptr inbounds %struct.Point, %struct.Point* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !4
  store i32 %23, i32* %x.addr, align 4
  %24 = load %struct.Point*, %struct.Point** %point.addr, align 8
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !5
  store i32 %26, i32* %y.addr, align 4
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %x.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %30)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = load i32, i32* %y.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = load i32, i32* %total.addr, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @fresh_pattern(i32 noundef %n) #1 {
entry:
  %pattern.1901.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %5 = bitcast [2 x i32]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 %n, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 %1, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pattern.1901.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %pattern.1901.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %a.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %pattern.1901.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 1
  %21 = load i32, i32* %20, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %21, i32* %b.addr, align 4
  %22 = load i32, i32* %a.addr, align 4
  %23 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %22, i32 3)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = load i32, i32* %b.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @fresh_plain(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %5 = bitcast [2 x i32]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 %n, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 %1, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %a.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 1
  %21 = load i32, i32* %20, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %21, i32* %b.addr, align 4
  %22 = load i32, i32* %a.addr, align 4
  %23 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %22, i32 3)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = load i32, i32* %b.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @guard_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = icmp sge i32 %2, 2
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  %8 = load i32, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %8, i32* %a.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 1
  %13 = load i32, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %13, i32* %b.addr, align 4
  %14 = load i32, i32* %a.addr, align 4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 3)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = load i32, i32* %b.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %20

if.end:
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @guard_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = icmp sge i32 %2, 2
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  %8 = load i32, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %8, i32* %a.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 1
  %13 = load i32, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %13, i32* %b.addr, align 4
  %14 = load i32, i32* %a.addr, align 4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 3)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = load i32, i32* %b.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %20

if.end:
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @guard_loop_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = trunc i64 %1 to i32
  %7 = icmp sge i32 %6, 2
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = bitcast i8* %3 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  %10 = load i32, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %10, i32* %a.addr, align 4
  %11 = bitcast i8* %3 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 1
  %13 = load i32, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %13, i32* %b.addr, align 4
  %14 = load i32, i32* %total.addr, align 4
  %15 = load i32, i32* %a.addr, align 4
  %16 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %15, i32 3)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = load i32, i32* %b.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %24, i32* %total.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load i32, i32* %total.addr, align 4
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @guard_loop_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = trunc i64 %1 to i32
  %7 = icmp sge i32 %6, 2
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = bitcast i8* %3 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  %10 = load i32, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %10, i32* %a.addr, align 4
  %11 = bitcast i8* %3 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 1
  %13 = load i32, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %13, i32* %b.addr, align 4
  %14 = load i32, i32* %total.addr, align 4
  %15 = load i32, i32* %a.addr, align 4
  %16 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %15, i32 3)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = load i32, i32* %b.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %24, i32* %total.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load i32, i32* %total.addr, align 4
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Point* @make(i32 noundef %n) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Point.constructor(%struct.Point* %1, i32 %n, i32 %3)
  ret %struct.Point* %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @call_pattern(i32 noundef %n) #1 {
entry:
  %pattern.3120.addr = alloca %struct.Point*, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Point* @make(i32 %n)
  store %struct.Point* %0, %struct.Point** %pattern.3120.addr, align 8
  %1 = load %struct.Point*, %struct.Point** %pattern.3120.addr, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  store i32 %3, i32* %x.addr, align 4
  %4 = load %struct.Point*, %struct.Point** %pattern.3120.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  store i32 %6, i32* %y.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 3)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = load i32, i32* %y.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @call_plain(i32 noundef %n) #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Point* @make(i32 %n)
  store %struct.Point* %0, %struct.Point** %p.addr, align 8
  %1 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  store i32 %3, i32* %x.addr, align 4
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  store i32 %6, i32* %y.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 3)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = load i32, i32* %y.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @hole_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %a.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
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
  %10 = icmp ult i64 2, %9
  br i1 %10, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %9)
  unreachable

bounds.ok.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 2
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %c.addr, align 4
  %16 = load i32, i32* %a.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = load i32, i32* %c.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @hole_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %a.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
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
  %10 = icmp ult i64 2, %9
  br i1 %10, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %9)
  unreachable

bounds.ok.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 2
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %c.addr, align 4
  %16 = load i32, i32* %a.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = load i32, i32* %c.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @let_pattern(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %x.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = load i32, i32* %y.addr, align 4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %x.addr, align 4
  %9 = load i32, i32* %y.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 2)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %y.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %13, i32 3)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %17 = load i32, i32* %y.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %19

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @let_plain(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %x.addr, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = load i32, i32* %y.addr, align 4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %x.addr, align 4
  %9 = load i32, i32* %y.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 2)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %y.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %13, i32 3)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %17 = load i32, i32* %y.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %19

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @rows_pattern(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rows) #1 {
entry:
  %total.addr = alloca i32, align 4
  %pattern.3983.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to %struct.nish_array**
  %7 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %6, i64 %0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %8, %struct.nish_array** %pattern.3983.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %pattern.3983.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  %17 = load i32, i32* %16, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %17, i32* %a.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %pattern.3983.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = icmp ult i64 1, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 1
  %26 = load i32, i32* %25, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %26, i32* %b.addr, align 4
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %a.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %30)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = load i32, i32* %b.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = load i32, i32* %total.addr, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @rows_plain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rows) #1 {
entry:
  %total.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to %struct.nish_array**
  %7 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %6, i64 %0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %8, %struct.nish_array** %row.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  %17 = load i32, i32* %16, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %17, i32* %a.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = icmp ult i64 1, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 1
  %26 = load i32, i32* %25, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %26, i32* %b.addr, align 4
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %a.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %30)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = load i32, i32* %b.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = load i32, i32* %total.addr, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %points.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %struct.Point*], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x %struct.nish_array*], align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Point.constructor(%struct.Point* %Point.obj, i32 2, i32 5)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 4, i32* %5, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 7, i32* %6, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Point*
  call void @Point.constructor(%struct.Point* %8, i32 1, i32 2)
  %9 = call i8* @nish_alloc_struct(i64 8)
  %10 = bitcast i8* %9 to %struct.Point*
  call void @Point.constructor(%struct.Point* %10, i32 3, i32 4)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %13 = bitcast [2 x %struct.Point*]* %arr.data.1 to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = bitcast i8* %13 to %struct.Point**
  %16 = getelementptr inbounds %struct.Point*, %struct.Point** %15, i64 0
  store %struct.Point* %8, %struct.Point** %16, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %17 = getelementptr inbounds %struct.Point*, %struct.Point** %15, i64 1
  store %struct.Point* %10, %struct.Point** %17, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %points.addr, align 8
  %18 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %19 = call i32 @object_pattern(%struct.Point* %18)
  %20 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %21 = call i32 @object_plain(%struct.Point* %20)
  %22 = icmp eq i32 %19, %21
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = call i32 @array_pattern(%struct.nish_array* %24)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = call i32 @array_plain(%struct.nish_array* %26)
  %28 = icmp eq i32 %25, %27
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %31 = call i32 @for_pattern(%struct.nish_array* %30)
  %32 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %33 = call i32 @for_plain(%struct.nish_array* %32)
  %34 = icmp eq i32 %31, %33
  %35 = select i1 %34, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %35)
  %36 = call i32 @local_pattern(i32 5)
  %37 = call i32 @local_plain(i32 5)
  %38 = icmp eq i32 %36, %37
  %39 = select i1 %38, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %39)
  %40 = call i32 @fresh_pattern(i32 4)
  %41 = call i32 @fresh_plain(i32 4)
  %42 = icmp eq i32 %40, %41
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %43)
  %44 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %45 = call i32 @guard_pattern(%struct.nish_array* %44)
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = call i32 @guard_plain(%struct.nish_array* %46)
  %48 = icmp eq i32 %45, %47
  %49 = select i1 %48, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %49)
  %50 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %51 = call i32 @guard_loop_pattern(%struct.nish_array* %50, i32 3)
  %52 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %53 = call i32 @guard_loop_plain(%struct.nish_array* %52, i32 3)
  %54 = icmp eq i32 %51, %53
  %55 = select i1 %54, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %55)
  %56 = call i32 @call_pattern(i32 6)
  %57 = call i32 @call_plain(i32 6)
  %58 = icmp eq i32 %56, %57
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %59)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %60, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %61, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %62 = bitcast [3 x i32]* %arr.data.2 to i8*
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %62, i8** %63, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %64 = bitcast i8* %62 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 0
  store i32 1, i32* %65, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %66 = getelementptr inbounds i32, i32* %64, i64 1
  store i32 2, i32* %66, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %67 = getelementptr inbounds i32, i32* %64, i64 2
  store i32 3, i32* %67, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %ys.addr, align 8
  %68 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %69 = call i32 @hole_pattern(%struct.nish_array* %68)
  %70 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %71 = call i32 @hole_plain(%struct.nish_array* %70)
  %72 = icmp eq i32 %69, %71
  %73 = select i1 %72, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %73)
  %74 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %75 = call i32 @let_pattern(%struct.Point* %74)
  %76 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %77 = call i32 @let_plain(%struct.Point* %76)
  %78 = icmp eq i32 %75, %77
  %79 = select i1 %78, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %79)
  %80 = call i8* @nish_alloc_struct(i64 24)
  %81 = bitcast i8* %80 to %struct.nish_array*
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  store i64 2, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 1
  store i64 2, i64* %83, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %84 = call i8* @nish_alloc_struct(i64 8)
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  store i8* %84, i8** %85, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %86 = bitcast i8* %84 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 0
  store i32 1, i32* %87, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %88 = getelementptr inbounds i32, i32* %86, i64 1
  store i32 2, i32* %88, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %89 = call i8* @nish_alloc_struct(i64 24)
  %90 = bitcast i8* %89 to %struct.nish_array*
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  store i64 2, i64* %91, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 1
  store i64 2, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %93 = call i8* @nish_alloc_struct(i64 8)
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  store i8* %93, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %95 = bitcast i8* %93 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 0
  store i32 3, i32* %96, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %97 = getelementptr inbounds i32, i32* %95, i64 1
  store i32 4, i32* %97, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %98, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %99, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %100 = bitcast [2 x %struct.nish_array*]* %arr.data.3 to i8*
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %100, i8** %101, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %102 = bitcast i8* %100 to %struct.nish_array**
  %103 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %102, i64 0
  store %struct.nish_array* %81, %struct.nish_array** %103, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %104 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %102, i64 1
  store %struct.nish_array* %90, %struct.nish_array** %104, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %rows.addr, align 8
  %105 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %106 = call i32 @rows_pattern(%struct.nish_array* %105)
  %107 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %108 = call i32 @rows_plain(%struct.nish_array* %107)
  %109 = icmp eq i32 %106, %108
  %110 = select i1 %109, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %110)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
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
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!13, !11, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
