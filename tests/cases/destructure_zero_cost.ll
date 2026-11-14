%struct.Point = type { i32, i32 }
%struct.Holder = type { %struct.Point*, %struct.nish_array* }
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Point* noundef nonnull align 8 dereferenceable(8) %pt, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %items) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Point* %pt, %struct.Point** %0, align 8, !tbaa !23
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.nish_array* %items, %struct.nish_array** %1, align 8, !tbaa !24
  ret void
}

define noundef i32 @member_pattern(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %pattern.4668.addr = alloca %struct.Point*, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %pattern.4692.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Point*, %struct.Point** %0, align 8, !tbaa !23
  store %struct.Point* %1, %struct.Point** %pattern.4668.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %pattern.4668.addr, align 8
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !4
  store i32 %4, i32* %x.addr, align 4
  %5 = load %struct.Point*, %struct.Point** %pattern.4668.addr, align 8
  %6 = getelementptr inbounds %struct.Point, %struct.Point* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !5
  store i32 %7, i32* %y.addr, align 4
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  store %struct.nish_array* %9, %struct.nish_array** %pattern.4692.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %pattern.4692.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 0, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  %18 = load i32, i32* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %18, i32* %a.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %pattern.4692.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = icmp ult i64 1, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 1
  %27 = load i32, i32* %26, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %27, i32* %b.addr, align 4
  %28 = load i32, i32* %x.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = load i32, i32* %y.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %36 = load i32, i32* %a.addr, align 4
  %37 = load i32, i32* %b.addr, align 4
  %38 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %36, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %39)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %42

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @member_plain(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #1 {
entry:
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Point*, %struct.Point** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  store i32 %3, i32* %x.addr, align 4
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %5 = load %struct.Point*, %struct.Point** %4, align 8, !tbaa !23
  %6 = getelementptr inbounds %struct.Point, %struct.Point* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !5
  store i32 %7, i32* %y.addr, align 4
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
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
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !24
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = icmp ult i64 1, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 1
  %27 = load i32, i32* %26, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %27, i32* %b.addr, align 4
  %28 = load i32, i32* %x.addr, align 4
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 3)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = load i32, i32* %y.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %36 = load i32, i32* %a.addr, align 4
  %37 = load i32, i32* %b.addr, align 4
  %38 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %36, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %39)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %42

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %points.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point*], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x %struct.nish_array*], align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 2, i32 5)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 4, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 7, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Point*
  call void @Point.constructor(%struct.Point* %12, i32 1, i32 2)
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = bitcast i8* %13 to %struct.Point*
  call void @Point.constructor(%struct.Point* %14, i32 3, i32 4)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %17 = bitcast [2 x %struct.Point*]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %19 = bitcast i8* %17 to %struct.Point**
  %20 = getelementptr inbounds %struct.Point*, %struct.Point** %19, i64 0
  store %struct.Point* %12, %struct.Point** %20, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %21 = getelementptr inbounds %struct.Point*, %struct.Point** %19, i64 1
  store %struct.Point* %14, %struct.Point** %21, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %points.addr, align 8
  %22 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %23 = call i32 @object_pattern(%struct.Point* %22)
  %24 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %25 = call i32 @object_plain(%struct.Point* %24)
  %26 = icmp eq i32 %23, %25
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = call i32 @array_pattern(%struct.nish_array* %28)
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = call i32 @array_plain(%struct.nish_array* %30)
  %32 = icmp eq i32 %29, %31
  %33 = select i1 %32, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %35 = call i32 @for_pattern(%struct.nish_array* %34)
  %36 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %37 = call i32 @for_plain(%struct.nish_array* %36)
  %38 = icmp eq i32 %35, %37
  %39 = select i1 %38, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %39)
  %40 = call i32 @local_pattern(i32 5)
  %41 = call i32 @local_plain(i32 5)
  %42 = icmp eq i32 %40, %41
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %43)
  %44 = call i32 @fresh_pattern(i32 4)
  %45 = call i32 @fresh_plain(i32 4)
  %46 = icmp eq i32 %44, %45
  %47 = select i1 %46, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = call i32 @guard_pattern(%struct.nish_array* %48)
  %50 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %51 = call i32 @guard_plain(%struct.nish_array* %50)
  %52 = icmp eq i32 %49, %51
  %53 = select i1 %52, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %53)
  %54 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %55 = call i32 @guard_loop_pattern(%struct.nish_array* %54, i32 3)
  %56 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %57 = call i32 @guard_loop_plain(%struct.nish_array* %56, i32 3)
  %58 = icmp eq i32 %55, %57
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %59)
  %60 = call i32 @call_pattern(i32 6)
  %61 = call i32 @call_plain(i32 6)
  %62 = icmp eq i32 %60, %61
  %63 = select i1 %62, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %63)
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %64, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %65, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %66 = bitcast [3 x i32]* %arr.data.1 to i8*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %66, i8** %67, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %68 = bitcast i8* %66 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  store i32 1, i32* %69, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %70 = getelementptr inbounds i32, i32* %68, i64 1
  store i32 2, i32* %70, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %71 = getelementptr inbounds i32, i32* %68, i64 2
  store i32 3, i32* %71, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %73 = call i32 @hole_pattern(%struct.nish_array* %72)
  %74 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %75 = call i32 @hole_plain(%struct.nish_array* %74)
  %76 = icmp eq i32 %73, %75
  %77 = select i1 %76, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %77)
  %78 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %79 = call i32 @let_pattern(%struct.Point* %78)
  %80 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %81 = call i32 @let_plain(%struct.Point* %80)
  %82 = icmp eq i32 %79, %81
  %83 = select i1 %82, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %83)
  %84 = call i8* @nish_alloc_struct(i64 24)
  %85 = bitcast i8* %84 to %struct.nish_array*
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  store i64 2, i64* %86, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 1
  store i64 2, i64* %87, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %88 = call i8* @nish_alloc_struct(i64 8)
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  store i8* %88, i8** %89, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %90 = bitcast i8* %88 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 0
  store i32 1, i32* %91, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %92 = getelementptr inbounds i32, i32* %90, i64 1
  store i32 2, i32* %92, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %93 = call i8* @nish_alloc_struct(i64 24)
  %94 = bitcast i8* %93 to %struct.nish_array*
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  store i64 2, i64* %95, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 1
  store i64 2, i64* %96, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %97 = call i8* @nish_alloc_struct(i64 8)
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  store i8* %97, i8** %98, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %99 = bitcast i8* %97 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 0
  store i32 3, i32* %100, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %101 = getelementptr inbounds i32, i32* %99, i64 1
  store i32 4, i32* %101, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %102, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %103, align 8, !alias.scope !9, !noalias !10, !tbaa !20
  %104 = bitcast [2 x %struct.nish_array*]* %arr.data.2 to i8*
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %104, i8** %105, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %106 = bitcast i8* %104 to %struct.nish_array**
  %107 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %106, i64 0
  store %struct.nish_array* %85, %struct.nish_array** %107, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %108 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %106, i64 1
  store %struct.nish_array* %94, %struct.nish_array** %108, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %rows.addr, align 8
  %109 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %110 = call i32 @rows_pattern(%struct.nish_array* %109)
  %111 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %112 = call i32 @rows_plain(%struct.nish_array* %111)
  %113 = icmp eq i32 %110, %112
  %114 = select i1 %113, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %114)
  %115 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.Point* %115, %struct.nish_array* %116)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %117 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %118 = call i32 @member_pattern(%struct.Holder* %117)
  %119 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %120 = call i32 @member_plain(%struct.Holder* %119)
  %121 = icmp eq i32 %118, %120
  %122 = select i1 %121, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %122)
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

!llvm.module.flags = !{!25, !26, !27, !28, !29}
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
!21 = !{!"ptr", !1, i64 0}
!22 = !{!"Holder", !21, i64 0, !21, i64 8}
!23 = !{!22, !21, i64 0}
!24 = !{!22, !21, i64 8}
!25 = !{i32 8, !"cf-protection-branch", i32 1}
!26 = !{i32 8, !"cf-protection-return", i32 1}
!27 = !{i32 8, !"branch-target-enforcement", i32 1}
!28 = !{i32 8, !"sign-return-address", i32 1}
!29 = !{i32 4, !"probe-stack", !"inline-asm"}
