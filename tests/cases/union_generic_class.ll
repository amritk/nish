%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box$un2.$Circle.$Square = type { %union.tagged* }
%struct.Box$$Box$un2.$Circle.$Square = type { %struct.Box$un2.$Circle.$Square* }
%struct.Stack$un2.$Circle.$Square = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
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

define internal noundef %union.tagged* @pick(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %2, i32 %n)
  %3 = bitcast %struct.Circle* %2 to %union.tagged*
  br label %cond.end

cond.false:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Square*
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Square.constructor(%struct.Square* %5, i32 %7)
  %9 = bitcast %struct.Square* %5 to %union.tagged*
  br label %cond.end

cond.end:
  %10 = phi %union.tagged* [ %3, %cond.true ], [ %9, %ovf.ok ]
  ret %union.tagged* %10

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define void @nish_main() #1 {
entry:
  %b.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %Box$un2.$Circle.$Square.obj = alloca %struct.Box$un2.$Circle.$Square, align 8
  %bb.addr = alloca %struct.Box$$Box$un2.$Circle.$Square*, align 8
  %Box$$Box$un2.$Circle.$Square.obj = alloca %struct.Box$$Box$un2.$Circle.$Square, align 8
  %st.addr = alloca %struct.Stack$un2.$Circle.$Square*, align 8
  %Stack$un2.$Circle.$Square.obj = alloca %struct.Stack$un2.$Circle.$Square, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %missing.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %fallback.addr = alloca %union.tagged*, align 8
  %Circle.obj = alloca %struct.Circle, align 8
  %either.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %Box$un2.$Circle.$Square.obj.1 = alloca %struct.Box$un2.$Circle.$Square, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %1, i32 2)
  %2 = bitcast %struct.Circle* %1 to %union.tagged*
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %union.tagged* %2)
  store %struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %3 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %4 = call %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* %3)
  %5 = call i32 @area(%union.tagged* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Square*
  call void @Square.constructor(%struct.Square* %9, i32 3)
  %10 = bitcast %struct.Square* %9 to %union.tagged*
  call void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* %7, %union.tagged* %10)
  %11 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  %12 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %11, i32 0, i32 0
  %13 = load %union.tagged*, %union.tagged** %12, align 8, !tbaa !11
  %14 = call i32 @area(%union.tagged* %13)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Box$un2.$Circle.$Square*
  %18 = call i8* @nish_alloc_struct(i64 8)
  %19 = bitcast i8* %18 to %struct.Square*
  call void @Square.constructor(%struct.Square* %19, i32 4)
  %20 = bitcast %struct.Square* %19 to %union.tagged*
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %17, %union.tagged* %20)
  call void @Box$$Box$un2.$Circle.$Square.constructor(%struct.Box$$Box$un2.$Circle.$Square* %Box$$Box$un2.$Circle.$Square.obj, %struct.Box$un2.$Circle.$Square* %17)
  store %struct.Box$$Box$un2.$Circle.$Square* %Box$$Box$un2.$Circle.$Square.obj, %struct.Box$$Box$un2.$Circle.$Square** %bb.addr, align 8
  %21 = load %struct.Box$$Box$un2.$Circle.$Square*, %struct.Box$$Box$un2.$Circle.$Square** %bb.addr, align 8
  %22 = getelementptr inbounds %struct.Box$$Box$un2.$Circle.$Square, %struct.Box$$Box$un2.$Circle.$Square* %21, i32 0, i32 0
  %23 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %22, align 8, !tbaa !13
  %24 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %23, i32 0, i32 0
  %25 = load %union.tagged*, %union.tagged** %24, align 8, !tbaa !11
  %26 = call i32 @area(%union.tagged* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  call void @Stack$un2.$Circle.$Square.constructor(%struct.Stack$un2.$Circle.$Square* %Stack$un2.$Circle.$Square.obj)
  store %struct.Stack$un2.$Circle.$Square* %Stack$un2.$Circle.$Square.obj, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %28 = load %struct.Stack$un2.$Circle.$Square*, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %29 = call i8* @nish_alloc_struct(i64 8)
  %30 = bitcast i8* %29 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %30, i32 1)
  %31 = bitcast %struct.Circle* %30 to %union.tagged*
  call void @Stack$un2.$Circle.$Square.push(%struct.Stack$un2.$Circle.$Square* %28, %union.tagged* %31)
  %32 = load %struct.Stack$un2.$Circle.$Square*, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %33 = call i8* @nish_alloc_struct(i64 8)
  %34 = bitcast i8* %33 to %struct.Square*
  call void @Square.constructor(%struct.Square* %34, i32 5)
  %35 = bitcast %struct.Square* %34 to %union.tagged*
  call void @Stack$un2.$Circle.$Square.push(%struct.Stack$un2.$Circle.$Square* %32, %union.tagged* %35)
  %36 = load %struct.Stack$un2.$Circle.$Square*, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %37 = call %union.tagged* @pick(i32 -2)
  call void @Stack$un2.$Circle.$Square.push(%struct.Stack$un2.$Circle.$Square* %36, %union.tagged* %37)
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %38 = load i32, i32* %i.addr, align 4
  %39 = load %struct.Stack$un2.$Circle.$Square*, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %40 = call i32 @Stack$un2.$Circle.$Square.size(%struct.Stack$un2.$Circle.$Square* %39)
  %41 = icmp slt i32 %38, %40
  br i1 %41, label %for.body, label %for.end

for.body:
  %42 = load i32, i32* %total.addr, align 4
  %43 = load %struct.Stack$un2.$Circle.$Square*, %struct.Stack$un2.$Circle.$Square** %st.addr, align 8
  %44 = load i32, i32* %i.addr, align 4
  %45 = call %union.tagged* @Stack$un2.$Circle.$Square.at(%struct.Stack$un2.$Circle.$Square* %43, i32 %44)
  %46 = call i32 @area(%union.tagged* %45)
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %48, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %52 = load i32, i32* %total.addr, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
  %54 = load i32, i32* %total.addr, align 4
  %55 = icmp sgt i32 %54, 100
  br i1 %55, label %cond.true, label %cond.false

cond.true:
  %56 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %57 = phi %struct.Box$un2.$Circle.$Square* [ %56, %cond.true ], [ null, %cond.false ]
  store %struct.Box$un2.$Circle.$Square* %57, %struct.Box$un2.$Circle.$Square** %missing.addr, align 8
  %58 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %missing.addr, align 8
  %59 = icmp eq %struct.Box$un2.$Circle.$Square* %58, null
  br i1 %59, label %nullish.default, label %chain.next

chain.next:
  %60 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %58, i32 0, i32 0
  %61 = load %union.tagged*, %union.tagged** %60, align 8, !tbaa !11
  br label %nullish.end

nullish.default:
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 9)
  %62 = bitcast %struct.Circle* %Circle.obj to %union.tagged*
  br label %nullish.end

nullish.end:
  %63 = phi %union.tagged* [ %61, %chain.next ], [ %62, %nullish.default ]
  store %union.tagged* %63, %union.tagged** %fallback.addr, align 8
  %64 = load %union.tagged*, %union.tagged** %fallback.addr, align 8
  %65 = call i32 @area(%union.tagged* %64)
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  %67 = load i32, i32* %total.addr, align 4
  %68 = icmp sgt i32 %67, 0
  br i1 %68, label %cond.true.1, label %cond.false.1

cond.true.1:
  %69 = call i8* @nish_alloc_struct(i64 8)
  %70 = bitcast i8* %69 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %70, i32 1)
  %71 = bitcast %struct.Circle* %70 to %union.tagged*
  br label %cond.end.1

cond.false.1:
  %72 = call i8* @nish_alloc_struct(i64 8)
  %73 = bitcast i8* %72 to %struct.Square*
  call void @Square.constructor(%struct.Square* %73, i32 1)
  %74 = bitcast %struct.Square* %73 to %union.tagged*
  br label %cond.end.1

cond.end.1:
  %75 = phi %union.tagged* [ %71, %cond.true.1 ], [ %74, %cond.false.1 ]
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj.1, %union.tagged* %75)
  store %struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj.1, %struct.Box$un2.$Circle.$Square** %either.addr, align 8
  %76 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %either.addr, align 8
  %77 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %76, i32 0, i32 0
  %78 = load %union.tagged*, %union.tagged** %77, align 8, !tbaa !11
  %79 = call i32 @area(%union.tagged* %78)
  %80 = call i8* @nish_str_from_i32(i32 %79)
  call void @nish_print(i8* %80)
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

define internal noundef %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %union.tagged*, %union.tagged** %0, align 8, !tbaa !11
  ret %union.tagged* %1
}

define internal void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !11
  ret void
}

define internal void @Box$$Box$un2.$Circle.$Square.constructor(%struct.Box$$Box$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Box$un2.$Circle.$Square, %struct.Box$$Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %struct.Box$un2.$Circle.$Square* %value, %struct.Box$un2.$Circle.$Square** %0, align 8, !tbaa !13
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Box$un2.$Circle.$Square* @Box$$Box$un2.$Circle.$Square.get(%struct.Box$$Box$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Box$un2.$Circle.$Square, %struct.Box$$Box$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %0, align 8, !tbaa !13
  ret %struct.Box$un2.$Circle.$Square* %1
}

define internal void @Box$$Box$un2.$Circle.$Square.put(%struct.Box$$Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) nocapture %this, %struct.Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Box$un2.$Circle.$Square, %struct.Box$$Box$un2.$Circle.$Square* %this, i32 0, i32 0
  store %struct.Box$un2.$Circle.$Square* %value, %struct.Box$un2.$Circle.$Square** %0, align 8, !tbaa !13
  ret void
}

define internal void @Stack$un2.$Circle.$Square.constructor(%struct.Stack$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %5 = getelementptr inbounds %struct.Stack$un2.$Circle.$Square, %struct.Stack$un2.$Circle.$Square* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !26
  ret void
}

define internal void @Stack$un2.$Circle.$Square.push(%struct.Stack$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %item) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stack$un2.$Circle.$Square, %struct.Stack$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !17, !noalias !18, !tbaa !23
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %9 = bitcast i8* %8 to %union.tagged**
  %10 = getelementptr inbounds %union.tagged*, %union.tagged** %9, i64 %3
  store %union.tagged* %item, %union.tagged** %10, align 8, !alias.scope !18, !noalias !17, !tbaa !28
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %12 = trunc i64 %11 to i32
  ret void
}

define internal noundef %union.tagged* @Stack$un2.$Circle.$Square.at(%struct.Stack$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stack$un2.$Circle.$Square, %struct.Stack$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !17, !noalias !18, !tbaa !24
  %8 = bitcast i8* %7 to %union.tagged**
  %9 = getelementptr inbounds %union.tagged*, %union.tagged** %8, i64 %2
  %10 = load %union.tagged*, %union.tagged** %9, align 8, !alias.scope !18, !noalias !17, !tbaa !28
  ret %union.tagged* %10
}

define internal noundef i32 @Stack$un2.$Circle.$Square.size(%struct.Stack$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Stack$un2.$Circle.$Square, %struct.Stack$un2.$Circle.$Square* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !17, !noalias !18, !tbaa !22
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!29, !30, !31, !32, !33}
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
!12 = !{!"Box$$Box$un2.$Circle.$Square", !9, i64 0}
!13 = !{!12, !9, i64 0}
!14 = !{!"nish array"}
!15 = !{!"header", !14}
!16 = !{!"elements", !14}
!17 = !{!15}
!18 = !{!16}
!19 = !{!"header i64", !1, i64 0}
!20 = !{!"header ptr", !1, i64 0}
!21 = !{!"array header", !19, i64 0, !19, i64 8, !20, i64 16}
!22 = !{!21, !19, i64 0}
!23 = !{!21, !19, i64 8}
!24 = !{!21, !20, i64 16}
!25 = !{!"Stack$un2.$Circle.$Square", !9, i64 0}
!26 = !{!25, !9, i64 0}
!27 = !{!"element ptr", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{i32 8, !"cf-protection-branch", i32 1}
!30 = !{i32 8, !"cf-protection-return", i32 1}
!31 = !{i32 8, !"branch-target-enforcement", i32 1}
!32 = !{i32 8, !"sign-return-address", i32 1}
!33 = !{i32 4, !"probe-stack", !"inline-asm"}
