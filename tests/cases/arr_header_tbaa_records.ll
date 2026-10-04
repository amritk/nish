%struct.Point = type { i32, i32 }
%struct.Path = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal void @Path.constructor(%struct.Path* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %Point.obj = alloca %struct.Point, align 8
  %0 = getelementptr inbounds %struct.Path, %struct.Path* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %2, align 4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 1, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 1, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = bitcast i8* %7 to %struct.Point*
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %9, i64 0
  %11 = bitcast %struct.Point* %10 to i8*
  %12 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %11, i8* align 4 %12, i64 8, i1 false), !alias.scope !10, !noalias !9
  %13 = getelementptr inbounds %struct.Path, %struct.Path* %this, i32 0, i32 0
  store %struct.nish_array* %4, %struct.nish_array** %13, align 8, !tbaa !17
  ret void
}

define internal void @extend(%struct.Path* noundef nonnull align 8 dereferenceable(16) nocapture %p, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 %2, i32* %3, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = mul nsw i32 %4, 2
  %6 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 %5, i32* %6, align 4
  store %struct.Point* %Point.obj, %struct.Point** %q.addr, align 8
  %7 = getelementptr inbounds %struct.Path, %struct.Path* %p, i32 0, i32 0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !17
  %9 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to %struct.Point*
  %18 = getelementptr inbounds %struct.Point, %struct.Point* %17, i64 %11
  %19 = bitcast %struct.Point* %18 to i8*
  %20 = bitcast %struct.Point* %9 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %19, i8* align 4 %20, i64 8, i1 false), !alias.scope !10, !noalias !9
  %21 = add i64 %11, 1
  store i64 %21, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = trunc i64 %21 to i32
  %23 = getelementptr inbounds %struct.Path, %struct.Path* %p, i32 0, i32 1
  %24 = load i32, i32* %23, align 4, !tbaa !5
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  %28 = getelementptr inbounds %struct.Path, %struct.Path* %p, i32 0, i32 1
  store i32 %26, i32* %28, align 4, !tbaa !5
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %p.addr = alloca %struct.Path*, align 8
  %Path.obj = alloca %struct.Path, align 8
  %n0.addr = alloca i32, align 4
  %n1.addr = alloca i32, align 4
  %last.addr = alloca %struct.Point*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Path.constructor(%struct.Path* %Path.obj)
  store %struct.Path* %Path.obj, %struct.Path** %p.addr, align 8
  %0 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Path, %struct.Path* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %n0.addr, align 4
  %6 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Path, %struct.Path* %6, i32 0, i32 0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !17
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = icmp ult i64 0, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %14 = bitcast i8* %13 to %struct.Point*
  %15 = getelementptr inbounds %struct.Point, %struct.Point* %14, i64 0
  %16 = getelementptr inbounds %struct.Point, %struct.Point* %15, i32 0, i32 0
  store i32 5, i32* %16, align 4
  %17 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %18 = getelementptr inbounds %struct.Path, %struct.Path* %17, i32 0, i32 1
  store i32 10, i32* %18, align 4, !tbaa !5
  %19 = load %struct.Path*, %struct.Path** %p.addr, align 8
  call void @extend(%struct.Path* %19, i32 6)
  %20 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %21 = getelementptr inbounds %struct.Path, %struct.Path* %20, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !17
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %28 = bitcast i8* %27 to %struct.Point*
  %29 = getelementptr inbounds %struct.Point, %struct.Point* %28, i64 0
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %29, i32 0, i32 1
  store i32 3, i32* %30, align 4
  %31 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %32 = getelementptr inbounds %struct.Path, %struct.Path* %31, i32 0, i32 0
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !17
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %36 = trunc i64 %35 to i32
  store i32 %36, i32* %n1.addr, align 4
  %37 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %38 = getelementptr inbounds %struct.Path, %struct.Path* %37, i32 0, i32 0
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !17
  %40 = load i32, i32* %n1.addr, align 4
  %41 = sub nsw i32 %40, 1
  %42 = sext i32 %41 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok.2:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %48 = bitcast i8* %47 to %struct.Point*
  %49 = getelementptr inbounds %struct.Point, %struct.Point* %48, i64 %42
  store %struct.Point* %49, %struct.Point** %last.addr, align 8
  %50 = load i32, i32* %n0.addr, align 4
  %51 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %50, i32 100000)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok

ovf.ok:
  %54 = load i32, i32* %n1.addr, align 4
  %55 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %54, i32 10000)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %58 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %56)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %61 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %62 = getelementptr inbounds %struct.Path, %struct.Path* %61, i32 0, i32 0
  %63 = load %struct.nish_array*, %struct.nish_array** %62, align 8, !tbaa !17
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %66 = bitcast i8* %65 to %struct.Point*
  %67 = getelementptr inbounds %struct.Point, %struct.Point* %66, i64 0
  %68 = getelementptr inbounds %struct.Point, %struct.Point* %67, i32 0, i32 0
  %69 = load i32, i32* %68, align 4
  %70 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %69, i32 1000)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %59, i32 %71)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %76 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %77 = getelementptr inbounds %struct.Path, %struct.Path* %76, i32 0, i32 0
  %78 = load %struct.nish_array*, %struct.nish_array** %77, align 8, !tbaa !17
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %81 = bitcast i8* %80 to %struct.Point*
  %82 = getelementptr inbounds %struct.Point, %struct.Point* %81, i64 0
  %83 = getelementptr inbounds %struct.Point, %struct.Point* %82, i32 0, i32 1
  %84 = load i32, i32* %83, align 4
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 100)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 %86)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %91 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %92 = getelementptr inbounds %struct.Point, %struct.Point* %91, i32 0, i32 1
  %93 = load i32, i32* %92, align 4
  %94 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %93, i32 10)
  %95 = extractvalue { i32, i1 } %94, 0
  %96 = extractvalue { i32, i1 } %94, 1
  br i1 %96, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %97 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 %95)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %100 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %101 = getelementptr inbounds %struct.Path, %struct.Path* %100, i32 0, i32 1
  %102 = load i32, i32* %101, align 4, !tbaa !5
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %98, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %106 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %104, i32 16)
  %107 = extractvalue { i32, i1 } %106, 0
  %108 = extractvalue { i32, i1 } %106, 1
  br i1 %108, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %107

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.2 ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 2, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 2, %ovf.ok.6 ], [ 0, %ovf.ok.7 ], [ 0, %ovf.ok.8 ], [ 1, %ovf.ok.9 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Path", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!4, !2, i64 0}
