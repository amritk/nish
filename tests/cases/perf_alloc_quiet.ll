%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
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

define noundef i32 @test() #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %fixed.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %i.addr.1 = alloca i32, align 4
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %width.addr = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %once.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = mul i64 4, 4
  %5 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fixed.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  store i32 %8, i32* %12, align 4, !alias.scope !4, !noalias !3
  %13 = load i32, i32* %total.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3
  %20 = add nsw i32 %13, %19
  %21 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4
  %24 = trunc i64 %23 to i32
  %25 = add nsw i32 %20, %24
  store i32 %25, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %28 = load i32, i32* %i.addr.1, align 4
  %29 = icmp slt i32 %28, 3
  br i1 %29, label %for.body.1, label %for.end.1

for.body.1:
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 0, i32* %30, align 4, !tbaa !9
  %31 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 0, i32* %31, align 4, !tbaa !10
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = load i32, i32* %i.addr.1, align 4
  %34 = add nsw i32 %33, 1
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %35, align 8, !alias.scope !3, !noalias !4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %36, align 8, !alias.scope !3, !noalias !4
  %37 = bitcast [2 x i32]* %arr.data.1 to i8*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast i8* %37 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  store i32 %32, i32* %40, align 4, !alias.scope !4, !noalias !3
  %41 = getelementptr inbounds i32, i32* %39, i64 1
  store i32 %34, i32* %41, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pair.addr, align 8
  %42 = load i32, i32* %total.addr, align 4
  %43 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %44 = getelementptr inbounds %struct.Point, %struct.Point* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4, !tbaa !9
  %46 = add nsw i32 %42, %45
  %47 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 1
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3
  %53 = add nsw i32 %46, %52
  store i32 %53, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %54 = load i32, i32* %i.addr.1, align 4
  %55 = add nsw i32 %54, 1
  store i32 %55, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %56, align 8, !alias.scope !3, !noalias !4
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %57, align 8, !alias.scope !3, !noalias !4
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %58, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %kept.addr, align 8
  store i32 2, i32* %width.addr, align 4
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %59 = load i32, i32* %i.addr.2, align 4
  %60 = icmp slt i32 %59, 3
  br i1 %60, label %for.body.2, label %for.end.2

for.body.2:
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %i.addr.2, align 4
  %63 = add nsw i32 %61, %62
  %64 = sext i32 %63 to i64
  %65 = call i8* @nish_alloc_struct(i64 24)
  %66 = bitcast i8* %65 to %struct.nish_array*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  store i64 %64, i64* %67, align 8, !alias.scope !3, !noalias !4
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 1
  store i64 %64, i64* %68, align 8, !alias.scope !3, !noalias !4
  %69 = mul i64 %64, 4
  %70 = call i8* @nish_alloc_struct(i64 %69)
  call void @llvm.memset.p0i8.i64(i8* align 8 %70, i8 0, i64 %69, i1 false), !alias.scope !4, !noalias !3
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %66, %struct.nish_array** %row.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %73 = load i32, i32* %i.addr.2, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4
  %76 = icmp ult i64 0, %75
  br i1 %76, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %75)
  unreachable

bounds.ok:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 0
  store i32 %73, i32* %80, align 4, !alias.scope !4, !noalias !3
  %81 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %82 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 1
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4
  %87 = icmp eq i64 %84, %86
  br i1 %87, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %81, i64 8)
  br label %push.store

push.store:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4
  %90 = bitcast i8* %89 to %struct.nish_array**
  %91 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %90, i64 %84
  store %struct.nish_array* %82, %struct.nish_array** %91, align 8, !alias.scope !4, !noalias !3
  %92 = add i64 %84, 1
  store i64 %92, i64* %83, align 8, !alias.scope !3, !noalias !4
  %93 = trunc i64 %92 to i32
  br label %for.inc.2

for.inc.2:
  %94 = load i32, i32* %i.addr.2, align 4
  %95 = add nsw i32 %94, 1
  store i32 %95, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %96 = load i32, i32* %width.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = call i8* @nish_alloc_struct(i64 24)
  %99 = bitcast i8* %98 to %struct.nish_array*
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  store i64 %97, i64* %100, align 8, !alias.scope !3, !noalias !4
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 1
  store i64 %97, i64* %101, align 8, !alias.scope !3, !noalias !4
  %102 = mul i64 %97, 4
  %103 = call i8* @nish_alloc_struct(i64 %102)
  call void @llvm.memset.p0i8.i64(i8* align 8 %103, i8 0, i64 %102, i1 false), !alias.scope !4, !noalias !3
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  store i8* %103, i8** %104, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %99, %struct.nish_array** %once.addr, align 8
  %105 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4
  %108 = icmp ult i64 0, %107
  br i1 %108, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %107)
  unreachable

bounds.ok.1:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4
  %111 = bitcast i8* %110 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 0
  store i32 7, i32* %112, align 4, !alias.scope !4, !noalias !3
  %113 = load i32, i32* %total.addr, align 4
  %114 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4
  %117 = trunc i64 %116 to i32
  %118 = add nsw i32 %113, %117
  %119 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4
  %122 = bitcast i8* %121 to i32*
  %123 = getelementptr inbounds i32, i32* %122, i64 0
  %124 = load i32, i32* %123, align 4, !alias.scope !4, !noalias !3
  %125 = add nsw i32 %118, %124
  ret i32 %125
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"i32", !6, i64 0}
!8 = !{!"Point", !7, i64 0, !7, i64 4}
!9 = !{!8, !7, i64 0}
!10 = !{!8, !7, i64 4}
