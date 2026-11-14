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
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"before \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" after \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @grow(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = bitcast %union.tagged* %s to %struct.Circle*
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 10)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  store i32 %8, i32* %10, align 4, !tbaa !5
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
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
  %held.addr = alloca %union.tagged*, align 8
  %before.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !12, !noalias !13, !tbaa !19
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
  %17 = load i64, i64* %16, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %23 = bitcast i8* %22 to %struct.Box$un2.$Circle.$Square**
  %24 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %23, i64 %17
  store %struct.Box$un2.$Circle.$Square* %12, %struct.Box$un2.$Circle.$Square** %24, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !12, !noalias !13, !tbaa !17
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
  %37 = load i64, i64* %36, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %forof.body, label %forof.end

forof.body:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %41 = bitcast i8* %40 to %struct.Box$un2.$Circle.$Square**
  %42 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %41, i64 %35
  %43 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %42, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.Box$un2.$Circle.$Square* %43, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %44 = load i32, i32* %total.addr, align 4
  %45 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %46 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %45, i32 0, i32 0
  %47 = load %union.tagged*, %union.tagged** %46, align 8, !tbaa !24
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
  %56 = load i64, i64* %55, align 8, !alias.scope !12, !noalias !13, !tbaa !17
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
  %68 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %71 = icmp ult i64 1, %70
  br i1 %71, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %70)
  unreachable

bounds.ok:
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %74 = bitcast i8* %73 to %struct.Box$un2.$Circle.$Square**
  %75 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %74, i64 1
  %76 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %75, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %77 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %76, i32 0, i32 0
  %78 = load %union.tagged*, %union.tagged** %77, align 8, !tbaa !24
  store %union.tagged* %78, %union.tagged** %held.addr, align 8
  %79 = load %union.tagged*, %union.tagged** %held.addr, align 8
  %80 = call i32 @area(%union.tagged* %79)
  store i32 %80, i32* %before.addr, align 4
  %81 = load %union.tagged*, %union.tagged** %held.addr, align 8
  call void @grow(%union.tagged* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %85 = bitcast i8* %84 to %struct.Box$un2.$Circle.$Square**
  %86 = getelementptr inbounds %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %85, i64 1
  %87 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %86, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %88 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %87, i32 0, i32 0
  %89 = load %union.tagged*, %union.tagged** %88, align 8, !tbaa !24
  %90 = call i32 @area(%union.tagged* %89)
  store i32 %90, i32* %after.addr, align 4
  %91 = load i32, i32* %before.addr, align 4
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*))
  %95 = load i32, i32* %after.addr, align 4
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* %94, i8* %96)
  call void @nish_print(i8* %97)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !24
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
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element ptr", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"ptr", !1, i64 0}
!23 = !{!"Box$un2.$Circle.$Square", !22, i64 0}
!24 = !{!23, !22, i64 0}
!25 = !{i32 8, !"cf-protection-branch", i32 1}
!26 = !{i32 8, !"cf-protection-return", i32 1}
!27 = !{i32 8, !"branch-target-enforcement", i32 1}
!28 = !{i32 8, !"sign-return-address", i32 1}
!29 = !{i32 4, !"probe-stack", !"inline-asm"}
