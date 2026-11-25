%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
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
  %73 = call i8* @nish_alloc_struct(i64 24)
  %74 = bitcast i8* %73 to %struct.nish_array*
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  store i64 %72, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 1
  store i64 %72, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = mul i64 %72, 4
  %78 = call i8* @nish_alloc_struct(i64 %77)
  call void @llvm.memset.p0i8.i64(i8* align 8 %78, i8 0, i64 %77, i1 false), !alias.scope !4, !noalias !3
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  store i8* %78, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %74, %struct.nish_array** %row.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %81 = load i32, i32* %i.addr.2, align 4
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp ult i64 0, %83
  br i1 %84, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %83)
  unreachable

bounds.ok:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 0
  store i32 %81, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %89 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 1
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %95 = icmp eq i64 %92, %94
  br i1 %95, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %89, i64 8)
  br label %push.store

push.store:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to %struct.nish_array**
  %99 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %98, i64 %92
  store %struct.nish_array* %90, %struct.nish_array** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %100 = add i64 %92, 1
  store i64 %100, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = trunc i64 %100 to i32
  br label %for.inc.2

for.inc.2:
  %102 = load i32, i32* %i.addr.2, align 4
  %103 = add nsw i32 %102, 1
  store i32 %103, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %104 = load i32, i32* %width.addr, align 4
  %105 = sext i32 %104 to i64
  %106 = call i8* @nish_alloc_struct(i64 24)
  %107 = bitcast i8* %106 to %struct.nish_array*
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  store i64 %105, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 1
  store i64 %105, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %110 = mul i64 %105, 4
  %111 = call i8* @nish_alloc_struct(i64 %110)
  call void @llvm.memset.p0i8.i64(i8* align 8 %111, i8 0, i64 %110, i1 false), !alias.scope !4, !noalias !3
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  store i8* %111, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %107, %struct.nish_array** %once.addr, align 8
  %113 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 0
  %115 = load i64, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = icmp ult i64 0, %115
  br i1 %116, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %115)
  unreachable

bounds.ok.1:
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %119 = bitcast i8* %118 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 0
  store i32 7, i32* %120, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %121 = load i32, i32* %total.addr, align 4
  %122 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = trunc i64 %124 to i32
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %121, i32 %125)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %129 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %132 = bitcast i8* %131 to i32*
  %133 = getelementptr inbounds i32, i32* %132, i64 0
  %134 = load i32, i32* %133, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %135 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %127, i32 %134)
  %136 = extractvalue { i32, i1 } %135, 0
  %137 = extractvalue { i32, i1 } %135, 1
  br i1 %137, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %136

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
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
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
