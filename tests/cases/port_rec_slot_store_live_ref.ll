%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point], align 8
  %r.addr = alloca %struct.Point*, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  %e.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %Point.obj.3 = alloca %struct.Point, align 8
  %first.addr = alloca %struct.Point*, align 8
  %i.addr = alloca i32, align 4
  %Point.obj.4 = alloca %struct.Point, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 1, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 2, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [2 x %struct.Point]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to %struct.Point*
  %9 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 0
  %10 = bitcast %struct.Point* %9 to i8*
  %11 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %10, i8* align 4 %11, i64 8, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 1
  %13 = bitcast %struct.Point* %12 to i8*
  %14 = bitcast %struct.Point* %Point.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %13, i8* align 4 %14, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.Point*
  %19 = getelementptr inbounds %struct.Point, %struct.Point* %18, i64 0
  store %struct.Point* %19, %struct.Point** %r.addr, align 8
  %20 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 9, i32* %20, align 4
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 9, i32* %21, align 4
  store %struct.Point* %Point.obj.2, %struct.Point** %q.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %23 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to %struct.Point*
  %27 = getelementptr inbounds %struct.Point, %struct.Point* %26, i64 0
  %28 = bitcast %struct.Point* %27 to i8*
  %29 = bitcast %struct.Point* %23 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %28, i8* align 4 %29, i64 8, i1 false), !alias.scope !4, !noalias !3
  %30 = load %struct.Point*, %struct.Point** %r.addr, align 8
  %31 = getelementptr inbounds %struct.Point, %struct.Point* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %forof.body, label %forof.end

forof.body:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to %struct.Point*
  %42 = getelementptr inbounds %struct.Point, %struct.Point* %41, i64 %35
  store %struct.Point* %42, %struct.Point** %e.addr, align 8
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %44 = load i8*, i8** %43, align 8
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %46 = load i64, i64* %45, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %48 = load %struct.Point*, %struct.Point** %e.addr, align 8
  %49 = getelementptr inbounds %struct.Point, %struct.Point* %48, i32 0, i32 0
  %50 = load i32, i32* %49, align 4
  %51 = add nsw i32 %50, 5
  %52 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 0
  store i32 %51, i32* %52, align 4
  %53 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 1
  store i32 0, i32* %53, align 4
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to %struct.Point*
  %57 = getelementptr inbounds %struct.Point, %struct.Point* %56, i64 1
  %58 = bitcast %struct.Point* %57 to i8*
  %59 = bitcast %struct.Point* %Point.obj.3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %58, i8* align 4 %59, i64 8, i1 false), !alias.scope !4, !noalias !3
  %60 = load %struct.Point*, %struct.Point** %e.addr, align 8
  %61 = getelementptr inbounds %struct.Point, %struct.Point* %60, i32 0, i32 0
  %62 = load i32, i32* %61, align 4
  %63 = call i8* @nish_str_from_i32(i32 %62)
  call void @nish_print(i8* %63)
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %65 = load i8*, i8** %64, align 8
  %66 = icmp eq i8* %65, %44
  br i1 %66, label %pass.rewind, label %pass.free

pass.rewind:
  %67 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %46, i64* %67, align 8
  br label %pass.done

pass.free:
  %68 = ptrtoint i8* %44 to i64
  %69 = add i64 %68, %46
  call void @nish_arena_release(i64 %69)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %70 = load i64, i64* %forof.idx, align 8
  %71 = add i64 %70, 1
  store i64 %71, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %72 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to %struct.Point*
  %76 = getelementptr inbounds %struct.Point, %struct.Point* %75, i64 0
  store %struct.Point* %76, %struct.Point** %first.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %77 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %80 = load i32, i32* %i.addr, align 4
  %81 = icmp slt i32 %80, 2
  br i1 %81, label %for.body, label %for.end

for.body:
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %83 = load i8*, i8** %82, align 8
  %84 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %85 = load i64, i64* %84, align 8
  %86 = load %struct.Point*, %struct.Point** %first.addr, align 8
  %87 = getelementptr inbounds %struct.Point, %struct.Point* %86, i32 0, i32 1
  %88 = load i32, i32* %87, align 4
  %89 = call i8* @nish_str_from_i32(i32 %88)
  call void @nish_print(i8* %89)
  %90 = load i32, i32* %i.addr, align 4
  %91 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.4, i32 0, i32 0
  store i32 %90, i32* %91, align 4
  %92 = load i32, i32* %i.addr, align 4
  %93 = add nsw i32 %92, 10
  %94 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.4, i32 0, i32 1
  store i32 %93, i32* %94, align 4
  %95 = bitcast i8* %79 to %struct.Point*
  %96 = getelementptr inbounds %struct.Point, %struct.Point* %95, i64 0
  %97 = bitcast %struct.Point* %96 to i8*
  %98 = bitcast %struct.Point* %Point.obj.4 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %97, i8* align 4 %98, i64 8, i1 false), !alias.scope !4, !noalias !3
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %100 = load i8*, i8** %99, align 8
  %101 = icmp eq i8* %100, %83
  br i1 %101, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %102 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %85, i64* %102, align 8
  br label %pass.done.1

pass.free.1:
  %103 = ptrtoint i8* %83 to i64
  %104 = add i64 %103, %85
  call void @nish_arena_release(i64 %104)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %105 = load i32, i32* %i.addr, align 4
  %106 = add nsw i32 %105, 1
  store i32 %106, i32* %i.addr, align 4
  br label %for.cond

for.end:
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
