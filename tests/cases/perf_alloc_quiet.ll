%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = mul i64 4, 4
  %5 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fixed.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  store i32 %8, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = load i32, i32* %total.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = add nsw i32 %13, %19
  %21 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
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
  store i32 0, i32* %30, align 4, !tbaa !17
  %31 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 0, i32* %31, align 4, !tbaa !18
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = load i32, i32* %i.addr.1, align 4
  %34 = add nsw i32 %33, 1
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast [2 x i32]* %arr.data.1 to i8*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %37 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  store i32 %32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = getelementptr inbounds i32, i32* %39, i64 1
  store i32 %34, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pair.addr, align 8
  %42 = load i32, i32* %total.addr, align 4
  %43 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %44 = getelementptr inbounds %struct.Point, %struct.Point* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4, !tbaa !17
  %46 = add nsw i32 %42, %45
  %47 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 1
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
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
  store i64 0, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %65 = icmp ule i64 %64, 2147483647
  br i1 %65, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %66 = call i8* @nish_alloc_struct(i64 24)
  %67 = bitcast i8* %66 to %struct.nish_array*
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  store i64 %64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 1
  store i64 %64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = mul i64 %64, 4
  %71 = call i8* @nish_alloc_struct(i64 %70)
  call void @llvm.memset.p0i8.i64(i8* align 8 %71, i8 0, i64 %70, i1 false), !alias.scope !4, !noalias !3
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %67, %struct.nish_array** %row.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %74 = load i32, i32* %i.addr.2, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = icmp ult i64 0, %76
  br i1 %77, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %76)
  unreachable

bounds.ok:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %80 = bitcast i8* %79 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 0
  store i32 %74, i32* %81, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %82 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 1
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %88 = icmp eq i64 %85, %87
  br i1 %88, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %82, i64 8)
  br label %push.store

push.store:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to %struct.nish_array**
  %92 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %91, i64 %85
  store %struct.nish_array* %83, %struct.nish_array** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %93 = add i64 %85, 1
  store i64 %93, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = trunc i64 %93 to i32
  br label %for.inc.2

for.inc.2:
  %95 = load i32, i32* %i.addr.2, align 4
  %96 = add nsw i32 %95, 1
  store i32 %96, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %97 = load i32, i32* %width.addr, align 4
  %98 = sext i32 %97 to i64
  %99 = icmp ule i64 %98, 2147483647
  br i1 %99, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %100 = call i8* @nish_alloc_struct(i64 24)
  %101 = bitcast i8* %100 to %struct.nish_array*
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  store i64 %98, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 1
  store i64 %98, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %104 = mul i64 %98, 4
  %105 = call i8* @nish_alloc_struct(i64 %104)
  call void @llvm.memset.p0i8.i64(i8* align 8 %105, i8 0, i64 %104, i1 false), !alias.scope !4, !noalias !3
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  store i8* %105, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %101, %struct.nish_array** %once.addr, align 8
  %107 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = icmp ult i64 0, %109
  br i1 %110, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %109)
  unreachable

bounds.ok.1:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to i32*
  %114 = getelementptr inbounds i32, i32* %113, i64 0
  store i32 7, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %115 = load i32, i32* %total.addr, align 4
  %116 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 0
  %118 = load i64, i64* %117, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = trunc i64 %118 to i32
  %120 = add nsw i32 %115, %119
  %121 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %124 = bitcast i8* %123 to i32*
  %125 = getelementptr inbounds i32, i32* %124, i64 0
  %126 = load i32, i32* %125, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %127 = add nsw i32 %120, %126
  ret i32 %127
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Point", !15, i64 0, !15, i64 4}
!17 = !{!16, !15, i64 0}
!18 = !{!16, !15, i64 4}
!19 = !{!"element ptr", !6, i64 0}
!20 = !{!19, !19, i64 0}
