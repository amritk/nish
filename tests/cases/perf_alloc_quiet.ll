%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
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
  %arena.mark = call i64 @nish_arena_mark()
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
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %28, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = icmp slt i32 %32, 3
  br i1 %33, label %for.body.1, label %for.end.1

for.body.1:
  %34 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 0, i32* %34, align 4, !tbaa !17
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 0, i32* %35, align 4, !tbaa !18
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %36 = load i32, i32* %i.addr.1, align 4
  %37 = load i32, i32* %i.addr.1, align 4
  %38 = add nsw i32 %37, 1
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast [2 x i32]* %arr.data.1 to i8*
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %41 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 0
  store i32 %36, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = getelementptr inbounds i32, i32* %43, i64 1
  store i32 %38, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pair.addr, align 8
  %46 = load i32, i32* %total.addr, align 4
  %47 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %47, i32 0, i32 0
  %49 = load i32, i32* %48, align 4, !tbaa !17
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %53 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 1
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %60, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %62 = load i32, i32* %i.addr.1, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %kept.addr, align 8
  store i32 2, i32* %width.addr, align 4
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %67 = load i32, i32* %i.addr.2, align 4
  %68 = icmp slt i32 %67, 3
  br i1 %68, label %for.body.2, label %for.end.2

for.body.2:
  %69 = load i32, i32* %width.addr, align 4
  %70 = load i32, i32* %i.addr.2, align 4
  %71 = add nsw i32 %69, %70
  %72 = sext i32 %71 to i64
  %73 = icmp ule i64 %72, 2147483647
  br i1 %73, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %74 = call i8* @nish_alloc_struct(i64 24)
  %75 = bitcast i8* %74 to %struct.nish_array*
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  store i64 %72, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  store i64 %72, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = mul i64 %72, 4
  %79 = call i8* @nish_alloc_struct(i64 %78)
  call void @llvm.memset.p0i8.i64(i8* align 8 %79, i8 0, i64 %78, i1 false), !alias.scope !4, !noalias !3
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  store i8* %79, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %75, %struct.nish_array** %row.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %82 = load i32, i32* %i.addr.2, align 4
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = icmp ult i64 0, %84
  br i1 %85, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %84)
  unreachable

bounds.ok:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 0
  store i32 %82, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 1
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = icmp eq i64 %93, %95
  br i1 %96, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %90, i64 8)
  br label %push.store

push.store:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to %struct.nish_array**
  %100 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %99, i64 %93
  store %struct.nish_array* %91, %struct.nish_array** %100, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %101 = add i64 %93, 1
  store i64 %101, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = trunc i64 %101 to i32
  br label %for.inc.2

for.inc.2:
  %103 = load i32, i32* %i.addr.2, align 4
  %104 = add nsw i32 %103, 1
  store i32 %104, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %105 = load i32, i32* %width.addr, align 4
  %106 = sext i32 %105 to i64
  %107 = icmp ule i64 %106, 2147483647
  br i1 %107, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %108 = call i8* @nish_alloc_struct(i64 24)
  %109 = bitcast i8* %108 to %struct.nish_array*
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 0
  store i64 %106, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 1
  store i64 %106, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %112 = mul i64 %106, 4
  %113 = call i8* @nish_alloc_struct(i64 %112)
  call void @llvm.memset.p0i8.i64(i8* align 8 %113, i8 0, i64 %112, i1 false), !alias.scope !4, !noalias !3
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 2
  store i8* %113, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %109, %struct.nish_array** %once.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = icmp ult i64 0, %117
  br i1 %118, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %117)
  unreachable

bounds.ok.1:
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 0
  store i32 7, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = load i32, i32* %total.addr, align 4
  %124 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = trunc i64 %126 to i32
  %128 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %123, i32 %127)
  %129 = extractvalue { i32, i1 } %128, 0
  %130 = extractvalue { i32, i1 } %128, 1
  br i1 %130, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %131 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %134 = bitcast i8* %133 to i32*
  %135 = getelementptr inbounds i32, i32* %134, i64 0
  %136 = load i32, i32* %135, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %137 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %129, i32 %136)
  %138 = extractvalue { i32, i1 } %137, 0
  %139 = extractvalue { i32, i1 } %137, 1
  br i1 %139, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %138

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
