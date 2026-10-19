%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%struct.Holder = type { %union.tagged* }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"circle\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"square\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"tri\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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

define internal noundef %union.tagged* @pick(i32 noundef %n) #0 {
entry:
  %t.addr = alloca %struct.Tri*, align 8
  %0 = srem i32 %n, 3
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %3, i32 %n)
  %4 = bitcast %struct.Circle* %3 to %union.tagged*
  ret %union.tagged* %4

if.end:
  %5 = srem i32 %n, 3
  %6 = icmp eq i32 %5, 1
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Square*
  call void @Square.constructor(%struct.Square* %8, i32 %n)
  %9 = bitcast %struct.Square* %8 to %union.tagged*
  ret %union.tagged* %9

if.end.1:
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Tri*
  %12 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 0
  store i32 2, i32* %12, align 4
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 1
  store i32 %n, i32* %13, align 4
  store %struct.Tri* %11, %struct.Tri** %t.addr, align 8
  %14 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %15 = bitcast %struct.Tri* %14 to %union.tagged*
  ret %union.tagged* %15
}

define internal noundef nonnull align 8 i8* @label(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*)

if.end:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*)

if.end.1:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*)
}

define internal noundef i32 @weight(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 1

sw.case.1:
  ret i32 10

sw.default:
  ret i32 100
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %shape) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %union.tagged* %shape, %union.tagged** %0, align 8, !tbaa !11
  ret void
}

define internal noundef %union.tagged* @Holder.swap(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %next) #0 {
entry:
  %old.addr = alloca %union.tagged*, align 8
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %union.tagged*, %union.tagged** %0, align 8, !tbaa !11
  store %union.tagged* %1, %union.tagged** %old.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %union.tagged* %next, %union.tagged** %2, align 8, !tbaa !11
  %3 = load %union.tagged*, %union.tagged** %old.addr, align 8
  ret %union.tagged* %3
}

define internal noundef %union.tagged* @first(%union.tagged* noundef align 8 %m, i32 noundef %n) #0 {
entry:
  %0 = icmp ne %union.tagged* %m, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  %1 = call %union.tagged* @pick(i32 %n)
  br label %nullish.end

nullish.end:
  %2 = phi %union.tagged* [ %m, %entry ], [ %1, %nullish.default ]
  ret %union.tagged* %2
}

define void @nish_main() #2 {
entry:
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %union.tagged*], align 8
  %total.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %forof.idx = alloca i64, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %old.addr = alloca %union.tagged*, align 8
  %s.addr.1 = alloca %union.tagged*, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %1, i32 3)
  %2 = bitcast %struct.Circle* %1 to %union.tagged*
  %3 = call i8* @nish_alloc_struct(i64 8)
  %4 = bitcast i8* %3 to %struct.Square*
  call void @Square.constructor(%struct.Square* %4, i32 4)
  %5 = bitcast %struct.Square* %4 to %union.tagged*
  %6 = call %union.tagged* @pick(i32 2)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %7, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %8, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %9 = bitcast [3 x %union.tagged*]* %arr.data to i8*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %11 = bitcast i8* %9 to %union.tagged**
  %12 = getelementptr inbounds %union.tagged*, %union.tagged** %11, i64 0
  store %union.tagged* %2, %union.tagged** %12, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %13 = getelementptr inbounds %union.tagged*, %union.tagged** %11, i64 1
  store %union.tagged* %5, %union.tagged** %13, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %14 = getelementptr inbounds %union.tagged*, %union.tagged** %11, i64 2
  store %union.tagged* %6, %union.tagged** %14, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %16 = call %union.tagged* @pick(i32 6)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %24 = bitcast i8* %23 to %union.tagged**
  %25 = getelementptr inbounds %union.tagged*, %union.tagged** %24, i64 %18
  store %union.tagged* %16, %union.tagged** %25, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %27 = trunc i64 %26 to i32
  store i32 0, i32* %total.addr, align 4
  %28 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %forof.body, label %forof.end

forof.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %35 = bitcast i8* %34 to %union.tagged**
  %36 = getelementptr inbounds %union.tagged*, %union.tagged** %35, i64 %29
  %37 = load %union.tagged*, %union.tagged** %36, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  store %union.tagged* %37, %union.tagged** %s.addr, align 8
  %38 = load i32, i32* %total.addr, align 4
  %39 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %40 = call i32 @weight(%union.tagged* %39)
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %42, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %44 = load i64, i64* %forof.idx, align 8
  %45 = add i64 %44, 1
  store i64 %45, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %46 = load i32, i32* %total.addr, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %51 = icmp ult i64 1, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %54 = bitcast i8* %53 to %union.tagged**
  %55 = getelementptr inbounds %union.tagged*, %union.tagged** %54, i64 1
  %56 = load %union.tagged*, %union.tagged** %55, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %union.tagged* %56)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %57 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %58 = load i32, i32* %total.addr, align 4
  %59 = icmp sgt i32 %58, 100
  br i1 %59, label %cond.true, label %cond.false

cond.true:
  %60 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %63 = icmp ult i64 2, %62
  br i1 %63, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %62)
  unreachable

bounds.ok.1:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %66 = bitcast i8* %65 to %union.tagged**
  %67 = getelementptr inbounds %union.tagged*, %union.tagged** %66, i64 2
  %68 = load %union.tagged*, %union.tagged** %67, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  br label %cond.end

cond.false:
  %69 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %72 = bitcast i8* %71 to %union.tagged**
  %73 = getelementptr inbounds %union.tagged*, %union.tagged** %72, i64 0
  %74 = load %union.tagged*, %union.tagged** %73, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  br label %cond.end

cond.end:
  %75 = phi %union.tagged* [ %68, %bounds.ok.1 ], [ %74, %cond.false ]
  %76 = call %union.tagged* @Holder.swap(%struct.Holder* %57, %union.tagged* %75)
  store %union.tagged* %76, %union.tagged** %old.addr, align 8
  %77 = load %union.tagged*, %union.tagged** %old.addr, align 8
  %78 = call i8* @label(%union.tagged* %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %80 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %81 = getelementptr inbounds %struct.Holder, %struct.Holder* %80, i32 0, i32 0
  %82 = load %union.tagged*, %union.tagged** %81, align 8, !tbaa !11
  %83 = call i8* @label(%union.tagged* %82)
  %84 = call i8* @nish_str_concat(i8* %79, i8* %83)
  call void @nish_print(i8* %84)
  %85 = call %union.tagged* @pick(i32 4)
  store %union.tagged* %85, %union.tagged** %s.addr.1, align 8
  %86 = call %union.tagged* @first(%union.tagged* null, i32 5)
  store %union.tagged* %86, %union.tagged** %s.addr.1, align 8
  %87 = load %union.tagged*, %union.tagged** %s.addr.1, align 8
  %88 = call i8* @label(%union.tagged* %87)
  call void @nish_print(i8* %88)
  %89 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %92 = bitcast i8* %91 to %union.tagged**
  %93 = getelementptr inbounds %union.tagged*, %union.tagged** %92, i64 0
  %94 = load %union.tagged*, %union.tagged** %93, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %95 = call %union.tagged* @first(%union.tagged* %94, i32 0)
  %96 = call i8* @label(%union.tagged* %95)
  call void @nish_print(i8* %96)
  %97 = load %union.tagged*, %union.tagged** %s.addr.1, align 8
  %98 = getelementptr inbounds %union.tagged, %union.tagged* %97, i32 0, i32 0
  %99 = load i32, i32* %98, align 4
  %100 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 0
  %102 = load i64, i64* %101, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %103 = icmp ult i64 2, %102
  br i1 %103, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %102)
  unreachable

bounds.ok.2:
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %106 = bitcast i8* %105 to %union.tagged**
  %107 = getelementptr inbounds %union.tagged*, %union.tagged** %106, i64 2
  %108 = load %union.tagged*, %union.tagged** %107, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %109 = getelementptr inbounds %union.tagged, %union.tagged* %108, i32 0, i32 0
  %110 = load i32, i32* %109, align 4
  %111 = icmp eq i32 %99, %110
  %112 = select i1 %111, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %112)
  %113 = load %union.tagged*, %union.tagged** %s.addr.1, align 8
  %114 = getelementptr inbounds %union.tagged, %union.tagged* %113, i32 0, i32 0
  %115 = load i32, i32* %114, align 4
  store i32 %115, i32* %k.addr, align 4
  %116 = load i32, i32* %k.addr, align 4
  %117 = icmp eq i32 %116, 2
  %118 = select i1 %117, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %118)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
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
!20 = !{!19, !17, i64 0}
!21 = !{!19, !17, i64 8}
!22 = !{!19, !18, i64 16}
!23 = !{!"element ptr", !1, i64 0}
!24 = !{!23, !23, i64 0}
