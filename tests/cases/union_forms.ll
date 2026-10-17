%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%struct.Slot = type { %union.tagged* }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

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

define internal noundef i32 @tagOf(%union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  ret i32 %3
}

define internal noundef %union.tagged* @widen(%union.tagged* noundef %r) #1 {
entry:
  ret %union.tagged* %r
}

define internal noundef i32 @weight(%union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 10

if.end.1:
  ret i32 100
}

define internal noundef i32 @maybe(%union.tagged* noundef align 8 %m) #0 {
entry:
  %0 = icmp eq %union.tagged* %m, null
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = call i32 @weight(%union.tagged* %m)
  ret i32 %1
}

define void @nish_main() #2 {
entry:
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %union.tagged*], align 8
  %r.addr = alloca %union.tagged*, align 8
  %wide.addr = alloca %union.tagged*, align 8
  %shapes.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca %struct.Tri*, align 8
  %total.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %forof.idx = alloca i64, align 8
  %slot.addr = alloca %struct.Slot*, align 8
  %Slot.obj = alloca %struct.Slot, align 8
  %held.addr = alloca %union.tagged*, align 8
  %none.addr = alloca %union.tagged*, align 8
  %holes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %union.tagged*], align 8
  %seen.addr = alloca i32, align 4
  %h.addr = alloca %union.tagged*, align 8
  %forof.idx.1 = alloca i64, align 8
  %grid.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x %struct.nish_array*], align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Square*
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %1, i32 0, i32 0
  store i32 1, i32* %2, align 4, !tbaa !4
  %3 = getelementptr inbounds %struct.Square, %struct.Square* %1, i32 0, i32 1
  store i32 2, i32* %3, align 4, !tbaa !5
  %4 = bitcast %struct.Square* %1 to %union.tagged*
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Circle*
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %6, i32 0, i32 0
  store i32 0, i32* %7, align 4, !tbaa !7
  %8 = getelementptr inbounds %struct.Circle, %struct.Circle* %6, i32 0, i32 1
  store i32 1, i32* %8, align 4, !tbaa !8
  %9 = bitcast %struct.Circle* %6 to %union.tagged*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %10, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %11, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %12 = bitcast [2 x %union.tagged*]* %arr.data to i8*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %14 = bitcast i8* %12 to %union.tagged**
  %15 = getelementptr inbounds %union.tagged*, %union.tagged** %14, i64 0
  store %union.tagged* %4, %union.tagged** %15, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %16 = getelementptr inbounds %union.tagged*, %union.tagged** %14, i64 1
  store %union.tagged* %9, %union.tagged** %16, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pair.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %20 = bitcast i8* %19 to %union.tagged**
  %21 = getelementptr inbounds %union.tagged*, %union.tagged** %20, i64 0
  %22 = load %union.tagged*, %union.tagged** %21, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %23 = call i32 @tagOf(%union.tagged* %22)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %26 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %29 = bitcast i8* %28 to %union.tagged**
  %30 = getelementptr inbounds %union.tagged*, %union.tagged** %29, i64 1
  %31 = load %union.tagged*, %union.tagged** %30, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %32 = call i32 @tagOf(%union.tagged* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %25, i8* %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %38 = bitcast i8* %37 to %union.tagged**
  %39 = getelementptr inbounds %union.tagged*, %union.tagged** %38, i64 0
  %40 = load %union.tagged*, %union.tagged** %39, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %union.tagged* %40, %union.tagged** %r.addr, align 8
  %41 = load %union.tagged*, %union.tagged** %r.addr, align 8
  %42 = call %union.tagged* @widen(%union.tagged* %41)
  store %union.tagged* %42, %union.tagged** %wide.addr, align 8
  %43 = load %union.tagged*, %union.tagged** %wide.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %47 = bitcast i8* %46 to %union.tagged**
  %48 = getelementptr inbounds %union.tagged*, %union.tagged** %47, i64 1
  %49 = load %union.tagged*, %union.tagged** %48, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %50 = call i8* @nish_alloc_struct(i64 24)
  %51 = bitcast i8* %50 to %struct.nish_array*
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  store i64 2, i64* %52, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  store i64 2, i64* %53, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %54 = call i8* @nish_alloc_struct(i64 16)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  store i8* %54, i8** %55, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %56 = bitcast i8* %54 to %union.tagged**
  %57 = getelementptr inbounds %union.tagged*, %union.tagged** %56, i64 0
  store %union.tagged* %43, %union.tagged** %57, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %58 = getelementptr inbounds %union.tagged*, %union.tagged** %56, i64 1
  store %union.tagged* %49, %union.tagged** %58, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %51, %struct.nish_array** %shapes.addr, align 8
  %59 = call i8* @nish_alloc_struct(i64 8)
  %60 = bitcast i8* %59 to %struct.Tri*
  %61 = getelementptr inbounds %struct.Tri, %struct.Tri* %60, i32 0, i32 0
  store i32 2, i32* %61, align 4
  %62 = getelementptr inbounds %struct.Tri, %struct.Tri* %60, i32 0, i32 1
  store i32 5, i32* %62, align 4
  store %struct.Tri* %60, %struct.Tri** %t.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %64 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %65 = bitcast %struct.Tri* %64 to %union.tagged*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  %69 = load i64, i64* %68, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %70 = icmp eq i64 %67, %69
  br i1 %70, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %63, i64 8)
  br label %push.store

push.store:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %73 = bitcast i8* %72 to %union.tagged**
  %74 = getelementptr inbounds %union.tagged*, %union.tagged** %73, i64 %67
  store %union.tagged* %65, %union.tagged** %74, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %75 = add i64 %67, 1
  store i64 %75, i64* %66, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %76 = trunc i64 %75 to i32
  store i32 0, i32* %total.addr, align 4
  %77 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %78 = load i64, i64* %forof.idx, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %81 = icmp ult i64 %78, %80
  br i1 %81, label %forof.body, label %forof.end

forof.body:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %84 = bitcast i8* %83 to %union.tagged**
  %85 = getelementptr inbounds %union.tagged*, %union.tagged** %84, i64 %78
  %86 = load %union.tagged*, %union.tagged** %85, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %union.tagged* %86, %union.tagged** %s.addr, align 8
  %87 = load i32, i32* %total.addr, align 4
  %88 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %89 = call i32 @weight(%union.tagged* %88)
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %87, i32 %89)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %91, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %93 = load i64, i64* %forof.idx, align 8
  %94 = add i64 %93, 1
  store i64 %94, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %95 = load i32, i32* %total.addr, align 4
  %96 = call i8* @nish_str_from_i32(i32 %95)
  call void @nish_print(i8* %96)
  %97 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 0
  store %union.tagged* null, %union.tagged** %97, align 8, !tbaa !24
  store %struct.Slot* %Slot.obj, %struct.Slot** %slot.addr, align 8
  %98 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %99 = getelementptr inbounds %struct.Slot, %struct.Slot* %98, i32 0, i32 0
  %100 = load %union.tagged*, %union.tagged** %99, align 8, !tbaa !24
  %101 = call i32 @maybe(%union.tagged* %100)
  %102 = call i8* @nish_str_from_i32(i32 %101)
  call void @nish_print(i8* %102)
  %103 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %104 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %107 = icmp ult i64 2, %106
  br i1 %107, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %106)
  unreachable

bounds.ok:
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %110 = bitcast i8* %109 to %union.tagged**
  %111 = getelementptr inbounds %union.tagged*, %union.tagged** %110, i64 2
  %112 = load %union.tagged*, %union.tagged** %111, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %113 = getelementptr inbounds %struct.Slot, %struct.Slot* %103, i32 0, i32 0
  store %union.tagged* %112, %union.tagged** %113, align 8, !tbaa !24
  %114 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %115 = getelementptr inbounds %struct.Slot, %struct.Slot* %114, i32 0, i32 0
  %116 = load %union.tagged*, %union.tagged** %115, align 8, !tbaa !24
  store %union.tagged* %116, %union.tagged** %held.addr, align 8
  %117 = load %union.tagged*, %union.tagged** %held.addr, align 8
  %118 = icmp ne %union.tagged* %117, null
  br i1 %118, label %if.then, label %if.end

if.then:
  %119 = load %union.tagged*, %union.tagged** %held.addr, align 8
  %120 = getelementptr inbounds %union.tagged, %union.tagged* %119, i32 0, i32 0
  %121 = load i32, i32* %120, align 4
  %122 = icmp eq i32 %121, 2
  %123 = select i1 %122, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %123)
  br label %if.end

if.end:
  store %union.tagged* null, %union.tagged** %none.addr, align 8
  %124 = load %union.tagged*, %union.tagged** %none.addr, align 8
  %125 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %126 = getelementptr inbounds %struct.Slot, %struct.Slot* %125, i32 0, i32 0
  %127 = load %union.tagged*, %union.tagged** %126, align 8, !tbaa !24
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %128, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %129, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %130 = bitcast [2 x %union.tagged*]* %arr.data.1 to i8*
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %130, i8** %131, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %132 = bitcast i8* %130 to %union.tagged**
  %133 = getelementptr inbounds %union.tagged*, %union.tagged** %132, i64 0
  store %union.tagged* %124, %union.tagged** %133, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %134 = getelementptr inbounds %union.tagged*, %union.tagged** %132, i64 1
  store %union.tagged* %127, %union.tagged** %134, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %holes.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  %135 = load %struct.nish_array*, %struct.nish_array** %holes.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %136 = load i64, i64* %forof.idx.1, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %139 = icmp ult i64 %136, %138
  br i1 %139, label %forof.body.1, label %forof.end.1

forof.body.1:
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %142 = bitcast i8* %141 to %union.tagged**
  %143 = getelementptr inbounds %union.tagged*, %union.tagged** %142, i64 %136
  %144 = load %union.tagged*, %union.tagged** %143, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %union.tagged* %144, %union.tagged** %h.addr, align 8
  %145 = load %union.tagged*, %union.tagged** %h.addr, align 8
  %146 = icmp ne %union.tagged* %145, null
  br i1 %146, label %if.then.1, label %if.end.1

if.then.1:
  %147 = load i32, i32* %seen.addr, align 4
  %148 = load %union.tagged*, %union.tagged** %h.addr, align 8
  %149 = call i32 @weight(%union.tagged* %148)
  %150 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %147, i32 %149)
  %151 = extractvalue { i32, i1 } %150, 0
  %152 = extractvalue { i32, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %151, i32* %seen.addr, align 4
  br label %if.end.1

if.end.1:
  br label %forof.inc.1

forof.inc.1:
  %153 = load i64, i64* %forof.idx.1, align 8
  %154 = add i64 %153, 1
  store i64 %154, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %155 = load i32, i32* %seen.addr, align 4
  %156 = call i8* @nish_str_from_i32(i32 %155)
  call void @nish_print(i8* %156)
  %157 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %158 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %159 = bitcast %struct.Tri* %158 to %union.tagged*
  %160 = load %union.tagged*, %union.tagged** %wide.addr, align 8
  %161 = call i8* @nish_alloc_struct(i64 24)
  %162 = bitcast i8* %161 to %struct.nish_array*
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 0
  store i64 2, i64* %163, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 1
  store i64 2, i64* %164, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %165 = call i8* @nish_alloc_struct(i64 16)
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 2
  store i8* %165, i8** %166, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %167 = bitcast i8* %165 to %union.tagged**
  %168 = getelementptr inbounds %union.tagged*, %union.tagged** %167, i64 0
  store %union.tagged* %159, %union.tagged** %168, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %169 = getelementptr inbounds %union.tagged*, %union.tagged** %167, i64 1
  store %union.tagged* %160, %union.tagged** %169, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %170, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %171, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %172 = bitcast [2 x %struct.nish_array*]* %arr.data.2 to i8*
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %172, i8** %173, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %174 = bitcast i8* %172 to %struct.nish_array**
  %175 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %174, i64 0
  store %struct.nish_array* %157, %struct.nish_array** %175, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %176 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %174, i64 1
  store %struct.nish_array* %162, %struct.nish_array** %176, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %grid.addr, align 8
  %177 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %177, i64 0, i32 0
  %179 = load i64, i64* %178, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %180 = trunc i64 %179 to i32
  %181 = call i8* @nish_str_from_i32(i32 %180)
  %182 = call i8* @nish_str_concat(i8* %181, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %183 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %185 = load i8*, i8** %184, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %186 = bitcast i8* %185 to %struct.nish_array**
  %187 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %186, i64 1
  %188 = load %struct.nish_array*, %struct.nish_array** %187, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %189 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %188, i64 0, i32 0
  %190 = load i64, i64* %189, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %191 = trunc i64 %190 to i32
  %192 = call i8* @nish_str_from_i32(i32 %191)
  %193 = call i8* @nish_str_concat(i8* %182, i8* %192)
  %194 = call i8* @nish_str_concat(i8* %193, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %195 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %195, i64 0, i32 2
  %197 = load i8*, i8** %196, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %198 = bitcast i8* %197 to %struct.nish_array**
  %199 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %198, i64 1
  %200 = load %struct.nish_array*, %struct.nish_array** %199, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %200, i64 0, i32 0
  %202 = load i64, i64* %201, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %203 = icmp ult i64 0, %202
  br i1 %203, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %202)
  unreachable

bounds.ok.1:
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %200, i64 0, i32 2
  %205 = load i8*, i8** %204, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %206 = bitcast i8* %205 to %union.tagged**
  %207 = getelementptr inbounds %union.tagged*, %union.tagged** %206, i64 0
  %208 = load %union.tagged*, %union.tagged** %207, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %209 = call i32 @weight(%union.tagged* %208)
  %210 = call i8* @nish_str_from_i32(i32 %209)
  %211 = call i8* @nish_str_concat(i8* %194, i8* %210)
  %212 = call i8* @nish_str_concat(i8* %211, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %213 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %216 = bitcast i8* %215 to %struct.nish_array**
  %217 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %216, i64 0
  %218 = load %struct.nish_array*, %struct.nish_array** %217, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %218, i64 0, i32 0
  %220 = load i64, i64* %219, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %221 = icmp ult i64 2, %220
  br i1 %221, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %220)
  unreachable

bounds.ok.2:
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %218, i64 0, i32 2
  %223 = load i8*, i8** %222, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %224 = bitcast i8* %223 to %union.tagged**
  %225 = getelementptr inbounds %union.tagged*, %union.tagged** %224, i64 2
  %226 = load %union.tagged*, %union.tagged** %225, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %227 = getelementptr inbounds %union.tagged, %union.tagged* %226, i32 0, i32 0
  %228 = load i32, i32* %227, align 4
  %229 = icmp eq i32 %228, 2
  %230 = select i1 %229, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %231 = call i8* @nish_str_concat(i8* %212, i8* %230)
  call void @nish_print(i8* %231)
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

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Square", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Circle", !2, i64 0, !2, i64 4}
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
!23 = !{!"Slot", !22, i64 0}
!24 = !{!23, !22, i64 0}
