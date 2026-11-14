%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box$un2.$Circle.$Square = type { %union.tagged* }
%struct.nish_result.un2.$Circle.$Square.str = type { i1, %union.tagged*, i8* }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"skip \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"boxes \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" skipped \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" total \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"probe \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast %union.tagged* %s to %struct.Circle*
  %9 = getelementptr inbounds %struct.Circle, %struct.Circle* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Square*
  %15 = getelementptr inbounds %struct.Square, %struct.Square* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = bitcast %union.tagged* %s to %struct.Square*
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !8
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %21

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.un2.$Circle.$Square.str* @build(i32 noundef %n) #1 {
entry:
  %0 = srem i32 %n, 5
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_str_from_i32(i32 %n)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %2)
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_result.un2.$Circle.$Square.str*
  %6 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %5, i32 0, i32 0
  store i1 false, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %5, i32 0, i32 2
  store i8* %3, i8** %7, align 8
  ret %struct.nish_result.un2.$Circle.$Square.str* %5

if.end:
  %8 = srem i32 %n, 2
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %11, i32 %n)
  %12 = bitcast %struct.Circle* %11 to %union.tagged*
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_result.un2.$Circle.$Square.str*
  %15 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %14, i32 0, i32 0
  store i1 true, i1* %15, align 1
  %16 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %14, i32 0, i32 1
  store %union.tagged* %12, %union.tagged** %16, align 8
  br label %cond.end

cond.false:
  %17 = call i8* @nish_alloc_struct(i64 8)
  %18 = bitcast i8* %17 to %struct.Square*
  call void @Square.constructor(%struct.Square* %18, i32 %n)
  %19 = bitcast %struct.Square* %18 to %union.tagged*
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_result.un2.$Circle.$Square.str*
  %22 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %21, i32 0, i32 0
  store i1 true, i1* %22, align 1
  %23 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %21, i32 0, i32 1
  store %union.tagged* %19, %union.tagged** %23, align 8
  br label %cond.end

cond.end:
  %24 = phi %struct.nish_result.un2.$Circle.$Square.str* [ %14, %cond.true ], [ %21, %cond.false ]
  ret %struct.nish_result.un2.$Circle.$Square.str* %24
}

define internal noundef i32 @probe(i32 noundef %n) #1 {
entry:
  %b.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %Box$un2.$Circle.$Square.obj = alloca %struct.Box$un2.$Circle.$Square, align 8
  %v.addr = alloca %union.tagged*, align 8
  %again.addr = alloca %union.tagged*, align 8
  %0 = srem i32 %n, 2
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %3, i32 %n)
  %4 = bitcast %struct.Circle* %3 to %union.tagged*
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Square*
  call void @Square.constructor(%struct.Square* %6, i32 %n)
  %7 = bitcast %struct.Square* %6 to %union.tagged*
  br label %cond.end

cond.end:
  %8 = phi %union.tagged* [ %4, %cond.true ], [ %7, %cond.false ]
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %union.tagged* %8)
  store %struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %9 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %10 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %9, i32 0, i32 0
  %11 = load %union.tagged*, %union.tagged** %10, align 8, !tbaa !11
  store %union.tagged* %11, %union.tagged** %v.addr, align 8
  %12 = load %union.tagged*, %union.tagged** %v.addr, align 8
  %13 = getelementptr inbounds %union.tagged, %union.tagged* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4
  %15 = icmp eq i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load %union.tagged*, %union.tagged** %v.addr, align 8
  %17 = bitcast %union.tagged* %16 to %struct.Circle*
  %18 = load %union.tagged*, %union.tagged** %v.addr, align 8
  %19 = bitcast %union.tagged* %18 to %struct.Circle*
  %20 = getelementptr inbounds %struct.Circle, %struct.Circle* %19, i32 0, i32 1
  %21 = load i32, i32* %20, align 4, !tbaa !5
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 10)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  %25 = getelementptr inbounds %struct.Circle, %struct.Circle* %17, i32 0, i32 1
  store i32 %23, i32* %25, align 4, !tbaa !5
  br label %if.end

if.end:
  %26 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %27 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %26, i32 0, i32 0
  %28 = load %union.tagged*, %union.tagged** %27, align 8, !tbaa !11
  store %union.tagged* %28, %union.tagged** %again.addr, align 8
  %29 = load %union.tagged*, %union.tagged** %again.addr, align 8
  %30 = getelementptr inbounds %union.tagged, %union.tagged* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4
  switch i32 %31, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %32 = load %union.tagged*, %union.tagged** %again.addr, align 8
  %33 = bitcast %union.tagged* %32 to %struct.Circle*
  %34 = getelementptr inbounds %struct.Circle, %struct.Circle* %33, i32 0, i32 1
  %35 = load i32, i32* %34, align 4, !tbaa !5
  ret i32 %35

sw.case.1:
  %36 = load %union.tagged*, %union.tagged** %again.addr, align 8
  %37 = bitcast %union.tagged* %36 to %struct.Square*
  %38 = getelementptr inbounds %struct.Square, %struct.Square* %37, i32 0, i32 1
  %39 = load i32, i32* %38, align 4, !tbaa !8
  %40 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %39)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %41

sw.unreachable:
  unreachable

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 3, %sw.case.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish_main() #1 {
entry:
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %skipped.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.nish_result.un2.$Circle.$Square.str*, align 8
  %total.addr = alloca i32, align 4
  %b.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %forof.idx = alloca i64, align 8
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %boxes.addr, align 8
  store i32 0, i32* %skipped.addr, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp sle i32 %3, 8
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = call %struct.nish_result.un2.$Circle.$Square.str* @build(i32 %5)
  store %struct.nish_result.un2.$Circle.$Square.str* %6, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %7 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  br i1 %9, label %if.then, label %if.else

if.then:
  %10 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Box$un2.$Circle.$Square*
  %13 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %13, i32 0, i32 1
  %15 = load %union.tagged*, %union.tagged** %14, align 8
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %12, %union.tagged* %15)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %23 = bitcast i8* %22 to %struct.Box$un2.$Circle.$Square**
  %24 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %23, i64 %17
  store %struct.Box$un2.$Circle.$Square* %12, %struct.Box$un2.$Circle.$Square** %24, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %26 = trunc i64 %25 to i32
  br label %if.end

if.else:
  %27 = load i32, i32* %skipped.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %skipped.addr, align 4
  %29 = load %struct.nish_result.un2.$Circle.$Square.str*, %struct.nish_result.un2.$Circle.$Square.str** %r.addr, align 8
  %30 = getelementptr inbounds %struct.nish_result.un2.$Circle.$Square.str, %struct.nish_result.un2.$Circle.$Square.str* %29, i32 0, i32 2
  %31 = load i8*, i8** %30, align 8
  call void @nish_print(i8* %31)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %forof.body, label %forof.end

forof.body:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %41 = bitcast i8* %40 to %struct.Box$un2.$Circle.$Square**
  %42 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %41, i64 %35
  %43 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %42, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  store %struct.Box$un2.$Circle.$Square* %43, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %44 = load i32, i32* %total.addr, align 4
  %45 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %46 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %45, i32 0, i32 0
  %47 = load %union.tagged*, %union.tagged** %46, align 8, !tbaa !11
  %48 = call i32 @area(%union.tagged* %47)
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %50, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = add i64 %52, 1
  store i64 %53, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %54 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %57 = trunc i64 %56 to i32
  %58 = call i8* @nish_str_from_i32(i32 %57)
  %59 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*), i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [10 x i8] }* @.str.2 to i8*))
  %61 = load i32, i32* %skipped.addr, align 4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %60, i8* %62)
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %65 = load i32, i32* %total.addr, align 4
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %64, i8* %66)
  call void @nish_print(i8* %67)
  store i32 1, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %68 = load i32, i32* %i.addr.1, align 4
  %69 = icmp sle i32 %68, 4
  br i1 %69, label %for.body.1, label %for.end.1

for.body.1:
  %70 = load i32, i32* %i.addr.1, align 4
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %74 = load i32, i32* %i.addr.1, align 4
  %75 = call i32 @probe(i32 %74)
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %73, i8* %76)
  call void @nish_print(i8* %77)
  br label %for.inc.1

for.inc.1:
  %78 = load i32, i32* %i.addr.1, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !11
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
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!"ptr", !1, i64 0}
!10 = !{!"Box$un2.$Circle.$Square", !9, i64 0}
!11 = !{!10, !9, i64 0}
!12 = !{!"nish array"}
!13 = !{!"header", !12}
!14 = !{!"elements", !12}
!15 = !{!13}
!16 = !{!14}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !17, i64 0}
!21 = !{!19, !17, i64 8}
!22 = !{!19, !18, i64 16}
!23 = !{!"element ptr", !1, i64 0}
!24 = !{!23, !23, i64 0}
!25 = !{i32 8, !"cf-protection-branch", i32 1}
!26 = !{i32 8, !"cf-protection-return", i32 1}
!27 = !{i32 8, !"branch-target-enforcement", i32 1}
!28 = !{i32 8, !"sign-return-address", i32 1}
!29 = !{i32 4, !"probe-stack", !"inline-asm"}
