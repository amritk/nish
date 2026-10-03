%struct.Point = type { i32, i32 }
%struct.Segment = type { %struct.Point*, i32 }
%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Point], align 8
  %last.addr = alloca %struct.Point*, align 8
  %Point.obj.3 = alloca %struct.Point, align 8
  %segs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %s.addr = alloca %struct.Segment*, align 8
  %Segment.obj = alloca %struct.Segment, align 8
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %b.addr = alloca %struct.Box*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %4, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %6 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %14 = bitcast i8* %13 to %struct.Point*
  %15 = getelementptr inbounds %struct.Point, %struct.Point* %14, i64 %8
  %16 = bitcast %struct.Point* %15 to i8*
  %17 = bitcast %struct.Point* %6 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %16, i8* align 4 %17, i64 8, i1 false), !alias.scope !9, !noalias !8
  %18 = add i64 %8, 1
  store i64 %18, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = trunc i64 %18 to i32
  %20 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = icmp ult i64 0, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %26 = bitcast i8* %25 to %struct.Point*
  %27 = getelementptr inbounds %struct.Point, %struct.Point* %26, i64 0
  %28 = getelementptr inbounds %struct.Point, %struct.Point* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4
  %30 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %31 = getelementptr inbounds %struct.Point, %struct.Point* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4
  %33 = add nsw i32 %29, %32
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %38 = load i32, i32* %i.addr, align 4
  %39 = icmp slt i32 %38, 3
  br i1 %39, label %for.body, label %for.end

for.body:
  %40 = load i32, i32* %i.addr, align 4
  %41 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 %40, i32* %41, align 4
  %42 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 0, i32* %42, align 4
  store %struct.Point* %Point.obj.1, %struct.Point** %c.addr, align 8
  %43 = load %struct.Point*, %struct.Point** %c.addr, align 8
  %44 = load i32, i32* %i.addr, align 4
  %45 = mul nsw i32 %44, 2
  %46 = getelementptr inbounds %struct.Point, %struct.Point* %43, i32 0, i32 1
  store i32 %45, i32* %46, align 4
  %47 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %48 = load %struct.Point*, %struct.Point** %c.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %47, i64 8)
  br label %push.store.1

push.store.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %56 = bitcast i8* %55 to %struct.Point*
  %57 = getelementptr inbounds %struct.Point, %struct.Point* %56, i64 %50
  %58 = bitcast %struct.Point* %57 to i8*
  %59 = bitcast %struct.Point* %48 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %58, i8* align 4 %59, i64 8, i1 false), !alias.scope !9, !noalias !8
  %60 = add i64 %50, 1
  store i64 %60, i64* %49, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = trunc i64 %60 to i32
  br label %for.inc

for.inc:
  %62 = load i32, i32* %i.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %64 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %67 = icmp ult i64 2, %66
  br i1 %67, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %66)
  unreachable

bounds.ok.1:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %70 = bitcast i8* %69 to %struct.Point*
  %71 = getelementptr inbounds %struct.Point, %struct.Point* %70, i64 2
  %72 = getelementptr inbounds %struct.Point, %struct.Point* %71, i32 0, i32 1
  %73 = load i32, i32* %72, align 4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  call void @nish_print(i8* %74)
  %75 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 0, i32* %75, align 4
  %76 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 0, i32* %76, align 4
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %77, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %78, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %79 = bitcast [1 x %struct.Point]* %arr.data to i8*
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %79, i8** %80, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %81 = bitcast i8* %79 to %struct.Point*
  %82 = getelementptr inbounds %struct.Point, %struct.Point* %81, i64 0
  %83 = bitcast %struct.Point* %82 to i8*
  %84 = bitcast %struct.Point* %Point.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %83, i8* align 4 %84, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %kept.addr, align 8
  %85 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 0
  store i32 5, i32* %85, align 4
  %86 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 1
  store i32 5, i32* %86, align 4
  store %struct.Point* %Point.obj.3, %struct.Point** %last.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %88 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %91 = bitcast i8* %90 to %struct.Point*
  %92 = getelementptr inbounds %struct.Point, %struct.Point* %91, i64 0
  %93 = bitcast %struct.Point* %92 to i8*
  %94 = bitcast %struct.Point* %88 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %93, i8* align 4 %94, i64 8, i1 false), !alias.scope !9, !noalias !8
  %95 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %98 = bitcast i8* %97 to %struct.Point*
  %99 = getelementptr inbounds %struct.Point, %struct.Point* %98, i64 0
  %100 = getelementptr inbounds %struct.Point, %struct.Point* %99, i32 0, i32 0
  %101 = load i32, i32* %100, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  call void @nish_print(i8* %102)
  %103 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %104 = getelementptr inbounds %struct.Point, %struct.Point* %103, i32 0, i32 0
  store i32 6, i32* %104, align 4
  %105 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %106 = getelementptr inbounds %struct.Point, %struct.Point* %105, i32 0, i32 0
  %107 = load i32, i32* %106, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  call void @nish_print(i8* %108)
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %109, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %110, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %111, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %segs.addr, align 8
  %112 = call i8* @nish_alloc_struct(i64 8)
  %113 = bitcast i8* %112 to %struct.Point*
  %114 = getelementptr inbounds %struct.Point, %struct.Point* %113, i32 0, i32 0
  store i32 1, i32* %114, align 4
  %115 = getelementptr inbounds %struct.Point, %struct.Point* %113, i32 0, i32 1
  store i32 1, i32* %115, align 4
  %116 = getelementptr inbounds %struct.Segment, %struct.Segment* %Segment.obj, i32 0, i32 0
  store %struct.Point* %113, %struct.Point** %116, align 8
  %117 = getelementptr inbounds %struct.Segment, %struct.Segment* %Segment.obj, i32 0, i32 1
  store i32 2, i32* %117, align 4
  store %struct.Segment* %Segment.obj, %struct.Segment** %s.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %segs.addr, align 8
  %119 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 1
  %123 = load i64, i64* %122, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %124 = icmp eq i64 %121, %123
  br i1 %124, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %118, i64 16)
  br label %push.store.2

push.store.2:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %127 = bitcast i8* %126 to %struct.Segment*
  %128 = getelementptr inbounds %struct.Segment, %struct.Segment* %127, i64 %121
  %129 = bitcast %struct.Segment* %128 to i8*
  %130 = bitcast %struct.Segment* %119 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %129, i8* align 8 %130, i64 16, i1 false), !alias.scope !9, !noalias !8
  %131 = add i64 %121, 1
  store i64 %131, i64* %120, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %132 = trunc i64 %131 to i32
  %133 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %134 = getelementptr inbounds %struct.Segment, %struct.Segment* %133, i32 0, i32 0
  %135 = load %struct.Point*, %struct.Point** %134, align 8
  %136 = getelementptr inbounds %struct.Point, %struct.Point* %135, i32 0, i32 0
  store i32 7, i32* %136, align 4
  %137 = load %struct.nish_array*, %struct.nish_array** %segs.addr, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %140 = icmp ult i64 0, %139
  br i1 %140, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %139)
  unreachable

bounds.ok.2:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %143 = bitcast i8* %142 to %struct.Segment*
  %144 = getelementptr inbounds %struct.Segment, %struct.Segment* %143, i64 0
  %145 = getelementptr inbounds %struct.Segment, %struct.Segment* %144, i32 0, i32 0
  %146 = load %struct.Point*, %struct.Point** %145, align 8
  %147 = getelementptr inbounds %struct.Point, %struct.Point* %146, i32 0, i32 0
  %148 = load i32, i32* %147, align 4
  %149 = call i8* @nish_str_from_i32(i32 %148)
  call void @nish_print(i8* %149)
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 0, i64* %150, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 0, i64* %151, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* null, i8** %152, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %boxes.addr, align 8
  %153 = call i8* @nish_alloc_struct(i64 4)
  %154 = bitcast i8* %153 to %struct.Box*
  call void @Box.constructor(%struct.Box* %154, i32 1)
  store %struct.Box* %154, %struct.Box** %b.addr, align 8
  %155 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %156 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %158 = load i64, i64* %157, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 1
  %160 = load i64, i64* %159, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %161 = icmp eq i64 %158, %160
  br i1 %161, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %155, i64 8)
  br label %push.store.3

push.store.3:
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %163 = load i8*, i8** %162, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %164 = bitcast i8* %163 to %struct.Box**
  %165 = getelementptr inbounds %struct.Box*, %struct.Box** %164, i64 %158
  store %struct.Box* %156, %struct.Box** %165, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %166 = add i64 %158, 1
  store i64 %166, i64* %157, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %167 = trunc i64 %166 to i32
  %168 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %169 = getelementptr inbounds %struct.Box, %struct.Box* %168, i32 0, i32 0
  store i32 3, i32* %169, align 4, !tbaa !4
  %170 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 0
  %172 = load i64, i64* %171, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %173 = icmp ult i64 0, %172
  br i1 %173, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %172)
  unreachable

bounds.ok.3:
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 2
  %175 = load i8*, i8** %174, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %176 = bitcast i8* %175 to %struct.Box**
  %177 = getelementptr inbounds %struct.Box*, %struct.Box** %176, i64 0
  %178 = load %struct.Box*, %struct.Box** %177, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %179 = getelementptr inbounds %struct.Box, %struct.Box* %178, i32 0, i32 0
  %180 = load i32, i32* %179, align 4, !tbaa !4
  %181 = call i8* @nish_str_from_i32(i32 %180)
  call void @nish_print(i8* %181)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
