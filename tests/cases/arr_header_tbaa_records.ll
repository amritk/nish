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

define internal void @extend(%struct.Path* noundef nonnull align 8 dereferenceable(16) nocapture %p, i32 noundef %n) #0 {
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
  %25 = add nsw i32 %24, 1
  %26 = getelementptr inbounds %struct.Path, %struct.Path* %p, i32 0, i32 1
  store i32 %25, i32* %26, align 4, !tbaa !5
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
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
  %51 = mul nsw i32 %50, 100000
  %52 = load i32, i32* %n1.addr, align 4
  %53 = mul nsw i32 %52, 10000
  %54 = add nsw i32 %51, %53
  %55 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %56 = getelementptr inbounds %struct.Path, %struct.Path* %55, i32 0, i32 0
  %57 = load %struct.nish_array*, %struct.nish_array** %56, align 8, !tbaa !17
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %60 = bitcast i8* %59 to %struct.Point*
  %61 = getelementptr inbounds %struct.Point, %struct.Point* %60, i64 0
  %62 = getelementptr inbounds %struct.Point, %struct.Point* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4
  %64 = mul nsw i32 %63, 1000
  %65 = add nsw i32 %54, %64
  %66 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %67 = getelementptr inbounds %struct.Path, %struct.Path* %66, i32 0, i32 0
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !17
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %71 = bitcast i8* %70 to %struct.Point*
  %72 = getelementptr inbounds %struct.Point, %struct.Point* %71, i64 0
  %73 = getelementptr inbounds %struct.Point, %struct.Point* %72, i32 0, i32 1
  %74 = load i32, i32* %73, align 4
  %75 = mul nsw i32 %74, 100
  %76 = add nsw i32 %65, %75
  %77 = load %struct.Point*, %struct.Point** %last.addr, align 8
  %78 = getelementptr inbounds %struct.Point, %struct.Point* %77, i32 0, i32 1
  %79 = load i32, i32* %78, align 4
  %80 = mul nsw i32 %79, 10
  %81 = add nsw i32 %76, %80
  %82 = load %struct.Path*, %struct.Path** %p.addr, align 8
  %83 = getelementptr inbounds %struct.Path, %struct.Path* %82, i32 0, i32 1
  %84 = load i32, i32* %83, align 4, !tbaa !5
  %85 = add nsw i32 %81, %84
  %86 = sub nsw i32 %85, 16
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %86
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
