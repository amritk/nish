%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%struct.Holder = type { %union.tagged* }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"circle\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"polygon\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %shape) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %union.tagged* %shape, %union.tagged** %0, align 8, !tbaa !11
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = bitcast %union.tagged* %s to %struct.Circle*
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !5
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 3)
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

sw.case.2:
  %23 = bitcast %union.tagged* %s to %struct.Tri*
  %24 = getelementptr inbounds %struct.Tri, %struct.Tri* %23, i32 0, i32 1
  %25 = load i32, i32* %24, align 4
  ret i32 %25

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 i8* @named(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #2 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %union.tagged*, %union.tagged** %0, align 8, !tbaa !11
  %2 = getelementptr inbounds %union.tagged, %union.tagged* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  switch i32 %3, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.1
  ]

sw.case:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*)

sw.case.1:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*)

sw.unreachable:
  unreachable
}

define internal noundef i32 @corners(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %shapes, i32 noundef %i) #2 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %shapes, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %3 = bitcast i8* %2 to %union.tagged**
  %4 = getelementptr inbounds %union.tagged*, %union.tagged** %3, i64 %0
  %5 = load %union.tagged*, %union.tagged** %4, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %6 = getelementptr inbounds %union.tagged, %union.tagged* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  switch i32 %7, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret i32 0

sw.case.1:
  ret i32 4

sw.case.2:
  ret i32 3

sw.unreachable:
  unreachable
}

define internal noundef i32 @rest(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  switch i32 %4, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %5 = bitcast %union.tagged* %s to %struct.Circle*
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !5
  ret i32 %7

sw.case.1:
  %8 = bitcast %union.tagged* %s to %struct.Square*
  %9 = getelementptr inbounds %struct.Square, %struct.Square* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !8
  ret i32 %10

sw.unreachable:
  unreachable
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %shapes) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %shapes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !15, !noalias !16, !tbaa !23
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %shapes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %6 = bitcast i8* %5 to %union.tagged**
  %7 = getelementptr inbounds %union.tagged*, %union.tagged** %6, i64 %0
  %8 = load %union.tagged*, %union.tagged** %7, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  store %union.tagged* %8, %union.tagged** %s.addr, align 8
  %9 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %10 = getelementptr inbounds %union.tagged, %union.tagged* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  switch i32 %11, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %12 = load i32, i32* %sum.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 1)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %sum.addr, align 4
  br label %sw.end

sw.case.1:
  %16 = load i32, i32* %sum.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 10)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %18, i32* %sum.addr, align 4
  br label %sw.end

sw.case.2:
  %20 = load i32, i32* %sum.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 100)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %22, i32* %sum.addr, align 4
  br label %sw.end

sw.unreachable:
  unreachable

sw.end:
  br label %forof.inc

forof.inc:
  %24 = load i64, i64* %forof.idx, align 8
  %25 = add i64 %24, 1
  store i64 %25, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %26 = load i32, i32* %sum.addr, align 4
  ret i32 %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %t.addr = alloca %struct.Tri*, align 8
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %union.tagged*], align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Tri*
  %2 = getelementptr inbounds %struct.Tri, %struct.Tri* %1, i32 0, i32 0
  store i32 2, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Tri, %struct.Tri* %1, i32 0, i32 1
  store i32 5, i32* %3, align 4
  store %struct.Tri* %1, %struct.Tri** %t.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %5, i32 2)
  %6 = bitcast %struct.Circle* %5 to %union.tagged*
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Square*
  call void @Square.constructor(%struct.Square* %8, i32 3)
  %9 = bitcast %struct.Square* %8 to %union.tagged*
  %10 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %11 = bitcast %struct.Tri* %10 to %union.tagged*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !15, !noalias !16, !tbaa !23
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %14 = bitcast [3 x %union.tagged*]* %arr.data to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %16 = bitcast i8* %14 to %union.tagged**
  %17 = getelementptr inbounds %union.tagged*, %union.tagged** %16, i64 0
  store %union.tagged* %6, %union.tagged** %17, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %18 = getelementptr inbounds %union.tagged*, %union.tagged** %16, i64 1
  store %union.tagged* %9, %union.tagged** %18, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %19 = getelementptr inbounds %union.tagged*, %union.tagged** %16, i64 2
  store %union.tagged* %11, %union.tagged** %19, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %23 = bitcast i8* %22 to %union.tagged**
  %24 = getelementptr inbounds %union.tagged*, %union.tagged** %23, i64 0
  %25 = load %union.tagged*, %union.tagged** %24, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %26 = call i32 @area(%union.tagged* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %29 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %32 = bitcast i8* %31 to %union.tagged**
  %33 = getelementptr inbounds %union.tagged*, %union.tagged** %32, i64 1
  %34 = load %union.tagged*, %union.tagged** %33, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %35 = call i32 @area(%union.tagged* %34)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %28, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %42 = bitcast i8* %41 to %union.tagged**
  %43 = getelementptr inbounds %union.tagged*, %union.tagged** %42, i64 2
  %44 = load %union.tagged*, %union.tagged** %43, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %45 = call i32 @area(%union.tagged* %44)
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %38, i8* %46)
  call void @nish_print(i8* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %51 = bitcast i8* %50 to %union.tagged**
  %52 = getelementptr inbounds %union.tagged*, %union.tagged** %51, i64 0
  %53 = load %union.tagged*, %union.tagged** %52, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %union.tagged* %53)
  %54 = call i8* @named(%struct.Holder* %Holder.obj)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %56 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %57 = bitcast %struct.Tri* %56 to %union.tagged*
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1, %union.tagged* %57)
  %58 = call i8* @named(%struct.Holder* %Holder.obj.1)
  %59 = call i8* @nish_str_concat(i8* %55, i8* %58)
  call void @nish_print(i8* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %61 = call i32 @corners(%struct.nish_array* %60, i32 0)
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %65 = call i32 @corners(%struct.nish_array* %64, i32 1)
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %63, i8* %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %69 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %70 = call i32 @corners(%struct.nish_array* %69, i32 2)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %68, i8* %71)
  call void @nish_print(i8* %72)
  %73 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %76 = bitcast i8* %75 to %union.tagged**
  %77 = getelementptr inbounds %union.tagged*, %union.tagged** %76, i64 0
  %78 = load %union.tagged*, %union.tagged** %77, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %79 = call i32 @rest(%union.tagged* %78)
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %80, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %82 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %85 = bitcast i8* %84 to %union.tagged**
  %86 = getelementptr inbounds %union.tagged*, %union.tagged** %85, i64 1
  %87 = load %union.tagged*, %union.tagged** %86, align 8, !alias.scope !16, !noalias !15, !tbaa !22
  %88 = call i32 @rest(%union.tagged* %87)
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* %81, i8* %89)
  %91 = call i8* @nish_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %92 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %93 = bitcast %struct.Tri* %92 to %union.tagged*
  %94 = call i32 @rest(%union.tagged* %93)
  %95 = call i8* @nish_str_from_i32(i32 %94)
  %96 = call i8* @nish_str_concat(i8* %91, i8* %95)
  call void @nish_print(i8* %96)
  %97 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %98 = call i32 @total(%struct.nish_array* %97)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  call void @nish_print(i8* %99)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!"Holder", !9, i64 0}
!11 = !{!10, !9, i64 0}
!12 = !{!"nish array"}
!13 = !{!"header", !12}
!14 = !{!"elements", !12}
!15 = !{!13}
!16 = !{!14}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !18, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!19, !17, i64 0}
!24 = !{!19, !17, i64 8}
