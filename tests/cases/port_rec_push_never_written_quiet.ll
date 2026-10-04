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
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  %36 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %36)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %39, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %40 = load i32, i32* %i.addr, align 4
  %41 = icmp slt i32 %40, 3
  br i1 %41, label %for.body, label %for.end

for.body:
  %42 = load i32, i32* %i.addr, align 4
  %43 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 %42, i32* %43, align 4
  %44 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 0, i32* %44, align 4
  store %struct.Point* %Point.obj.1, %struct.Point** %c.addr, align 8
  %45 = load %struct.Point*, %struct.Point** %c.addr, align 8
  %46 = load i32, i32* %i.addr, align 4
  %47 = mul nsw i32 %46, 2
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %45, i32 0, i32 1
  store i32 %47, i32* %48, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %50 = load %struct.Point*, %struct.Point** %c.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %49, i64 8)
  br label %push.store.1

push.store.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %58 = bitcast i8* %57 to %struct.Point*
  %59 = getelementptr inbounds %struct.Point, %struct.Point* %58, i64 %52
  %60 = bitcast %struct.Point* %59 to i8*
  %61 = bitcast %struct.Point* %50 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %60, i8* align 4 %61, i64 8, i1 false), !alias.scope !9, !noalias !8
  %62 = add i64 %52, 1
  store i64 %62, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %63 = trunc i64 %62 to i32
  br label %for.inc

for.inc:
  %64 = load i32, i32* %i.addr, align 4
  %65 = add nsw i32 %64, 1
  store i32 %65, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %66 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %69 = icmp ult i64 2, %68
  br i1 %69, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %68)
  unreachable

bounds.ok.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %72 = bitcast i8* %71 to %struct.Point*
  %73 = getelementptr inbounds %struct.Point, %struct.Point* %72, i64 2
  %74 = getelementptr inbounds %struct.Point, %struct.Point* %73, i32 0, i32 1
  %75 = load i32, i32* %74, align 4
  %76 = call i8* @nish_str_from_i32(i32 %75)
  call void @nish_print(i8* %76)
  %77 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 0, i32* %77, align 4
  %78 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 0, i32* %78, align 4
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %79, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %80, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %81 = bitcast [1 x %struct.Point]* %arr.data to i8*
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %81, i8** %82, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %83 = bitcast i8* %81 to %struct.Point*
  %84 = getelementptr inbounds %struct.Point, %struct.Point* %83, i64 0
  %85 = bitcast %struct.Point* %84 to i8*
  %86 = bitcast %struct.Point* %Point.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %85, i8* align 4 %86, i64 8, i1 false), !alias.scope !9, !noalias !8
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %kept.addr, align 8
  %87 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 0
  store i32 5, i32* %87, align 4
  %88 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 1
  store i32 5, i32* %88, align 4
  store %struct.Point* %Point.obj.3, %struct.Point** %last.addr, align 8
  %89 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %90 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %93 = bitcast i8* %92 to %struct.Point*
  %94 = getelementptr inbounds %struct.Point, %struct.Point* %93, i64 0
  %95 = bitcast %struct.Point* %94 to i8*
  %96 = bitcast %struct.Point* %90 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %95, i8* align 4 %96, i64 8, i1 false), !alias.scope !9, !noalias !8
  %97 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %100 = bitcast i8* %99 to %struct.Point*
  %101 = getelementptr inbounds %struct.Point, %struct.Point* %100, i64 0
  %102 = getelementptr inbounds %struct.Point, %struct.Point* %101, i32 0, i32 0
  %103 = load i32, i32* %102, align 4
  %104 = call i8* @nish_str_from_i32(i32 %103)
  call void @nish_print(i8* %104)
  %105 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %106 = getelementptr inbounds %struct.Point, %struct.Point* %105, i32 0, i32 0
  store i32 6, i32* %106, align 4
  %107 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %108 = getelementptr inbounds %struct.Point, %struct.Point* %107, i32 0, i32 0
  %109 = load i32, i32* %108, align 4
  %110 = call i8* @nish_str_from_i32(i32 %109)
  call void @nish_print(i8* %110)
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %111, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %112, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %113, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %segs.addr, align 8
  %114 = call i8* @nish_alloc_struct(i64 8)
  %115 = bitcast i8* %114 to %struct.Point*
  %116 = getelementptr inbounds %struct.Point, %struct.Point* %115, i32 0, i32 0
  store i32 1, i32* %116, align 4
  %117 = getelementptr inbounds %struct.Point, %struct.Point* %115, i32 0, i32 1
  store i32 1, i32* %117, align 4
  %118 = getelementptr inbounds %struct.Segment, %struct.Segment* %Segment.obj, i32 0, i32 0
  store %struct.Point* %115, %struct.Point** %118, align 8
  %119 = getelementptr inbounds %struct.Segment, %struct.Segment* %Segment.obj, i32 0, i32 1
  store i32 2, i32* %119, align 4
  store %struct.Segment* %Segment.obj, %struct.Segment** %s.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %segs.addr, align 8
  %121 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 1
  %125 = load i64, i64* %124, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %126 = icmp eq i64 %123, %125
  br i1 %126, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %120, i64 16)
  br label %push.store.2

push.store.2:
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %129 = bitcast i8* %128 to %struct.Segment*
  %130 = getelementptr inbounds %struct.Segment, %struct.Segment* %129, i64 %123
  %131 = bitcast %struct.Segment* %130 to i8*
  %132 = bitcast %struct.Segment* %121 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %131, i8* align 8 %132, i64 16, i1 false), !alias.scope !9, !noalias !8
  %133 = add i64 %123, 1
  store i64 %133, i64* %122, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %134 = trunc i64 %133 to i32
  %135 = load %struct.Segment*, %struct.Segment** %s.addr, align 8
  %136 = getelementptr inbounds %struct.Segment, %struct.Segment* %135, i32 0, i32 0
  %137 = load %struct.Point*, %struct.Point** %136, align 8
  %138 = getelementptr inbounds %struct.Point, %struct.Point* %137, i32 0, i32 0
  store i32 7, i32* %138, align 4
  %139 = load %struct.nish_array*, %struct.nish_array** %segs.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %142 = icmp ult i64 0, %141
  br i1 %142, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %141)
  unreachable

bounds.ok.2:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %145 = bitcast i8* %144 to %struct.Segment*
  %146 = getelementptr inbounds %struct.Segment, %struct.Segment* %145, i64 0
  %147 = getelementptr inbounds %struct.Segment, %struct.Segment* %146, i32 0, i32 0
  %148 = load %struct.Point*, %struct.Point** %147, align 8
  %149 = getelementptr inbounds %struct.Point, %struct.Point* %148, i32 0, i32 0
  %150 = load i32, i32* %149, align 4
  %151 = call i8* @nish_str_from_i32(i32 %150)
  call void @nish_print(i8* %151)
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 0, i64* %152, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 0, i64* %153, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* null, i8** %154, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %boxes.addr, align 8
  %155 = call i8* @nish_alloc_struct(i64 4)
  %156 = bitcast i8* %155 to %struct.Box*
  call void @Box.constructor(%struct.Box* %156, i32 1)
  store %struct.Box* %156, %struct.Box** %b.addr, align 8
  %157 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %158 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %160 = load i64, i64* %159, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 1
  %162 = load i64, i64* %161, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %163 = icmp eq i64 %160, %162
  br i1 %163, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %157, i64 8)
  br label %push.store.3

push.store.3:
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %165 = load i8*, i8** %164, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %166 = bitcast i8* %165 to %struct.Box**
  %167 = getelementptr inbounds %struct.Box*, %struct.Box** %166, i64 %160
  store %struct.Box* %158, %struct.Box** %167, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %168 = add i64 %160, 1
  store i64 %168, i64* %159, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %169 = trunc i64 %168 to i32
  %170 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %171 = getelementptr inbounds %struct.Box, %struct.Box* %170, i32 0, i32 0
  store i32 3, i32* %171, align 4, !tbaa !4
  %172 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %175 = icmp ult i64 0, %174
  br i1 %175, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %174)
  unreachable

bounds.ok.3:
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 2
  %177 = load i8*, i8** %176, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %178 = bitcast i8* %177 to %struct.Box**
  %179 = getelementptr inbounds %struct.Box*, %struct.Box** %178, i64 0
  %180 = load %struct.Box*, %struct.Box** %179, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %181 = getelementptr inbounds %struct.Box, %struct.Box* %180, i32 0, i32 0
  %182 = load i32, i32* %181, align 4, !tbaa !4
  %183 = call i8* @nish_str_from_i32(i32 %182)
  call void @nish_print(i8* %183)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
