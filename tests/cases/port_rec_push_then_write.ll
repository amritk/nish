%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %moving.addr = alloca %struct.Point*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  %trail.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %4, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %6 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.Point*
  %15 = getelementptr inbounds %struct.Point, %struct.Point* %14, i64 %8
  %16 = bitcast %struct.Point* %15 to i8*
  %17 = bitcast %struct.Point* %6 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %16, i8* align 4 %17, i64 8, i1 false), !alias.scope !4, !noalias !3
  %18 = add i64 %8, 1
  store i64 %18, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %20, i32 0, i32 0
  store i32 9, i32* %21, align 4
  %22 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to %struct.Point*
  %29 = getelementptr inbounds %struct.Point, %struct.Point* %28, i64 0
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 3, i32* %33, align 4
  %34 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 4, i32* %34, align 4
  store %struct.Point* %Point.obj.1, %struct.Point** %q.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %36 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to %struct.Point*
  %40 = getelementptr inbounds %struct.Point, %struct.Point* %39, i64 0
  %41 = bitcast %struct.Point* %40 to i8*
  %42 = bitcast %struct.Point* %36 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %41, i8* align 4 %42, i64 8, i1 false), !alias.scope !4, !noalias !3
  %43 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to %struct.Point*
  %47 = getelementptr inbounds %struct.Point, %struct.Point* %46, i64 0
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %47, i32 0, i32 1
  store i32 7, i32* %48, align 4
  %49 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %50 = getelementptr inbounds %struct.Point, %struct.Point* %49, i32 0, i32 1
  %51 = load i32, i32* %50, align 4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  %53 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 0, i32* %53, align 4
  %54 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 0, i32* %54, align 4
  store %struct.Point* %Point.obj.2, %struct.Point** %moving.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %trail.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %58 = load i32, i32* %i.addr, align 4
  %59 = icmp slt i32 %58, 3
  br i1 %59, label %for.body, label %for.end

for.body:
  %60 = load %struct.Point*, %struct.Point** %moving.addr, align 8
  %61 = load i32, i32* %i.addr, align 4
  %62 = getelementptr inbounds %struct.Point, %struct.Point* %60, i32 0, i32 0
  store i32 %61, i32* %62, align 4
  %63 = load %struct.nish_array*, %struct.nish_array** %trail.addr, align 8
  %64 = load %struct.Point*, %struct.Point** %moving.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %63, i64 8)
  br label %push.store.1

push.store.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to %struct.Point*
  %73 = getelementptr inbounds %struct.Point, %struct.Point* %72, i64 %66
  %74 = bitcast %struct.Point* %73 to i8*
  %75 = bitcast %struct.Point* %64 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %74, i8* align 4 %75, i64 8, i1 false), !alias.scope !4, !noalias !3
  %76 = add i64 %66, 1
  store i64 %76, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = trunc i64 %76 to i32
  br label %for.inc

for.inc:
  %78 = load i32, i32* %i.addr, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %80 = load %struct.nish_array*, %struct.nish_array** %trail.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ult i64 0, %82
  br i1 %83, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %82)
  unreachable

bounds.ok.1:
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = bitcast i8* %85 to %struct.Point*
  %87 = getelementptr inbounds %struct.Point, %struct.Point* %86, i64 0
  %88 = getelementptr inbounds %struct.Point, %struct.Point* %87, i32 0, i32 0
  %89 = load i32, i32* %88, align 4
  %90 = call i8* @nish_str_from_i32(i32 %89)
  call void @nish_print(i8* %90)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
