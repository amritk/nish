%struct.Point = type { i32, i32 }
%struct.Size = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point], align 8
  %r.addr = alloca %struct.Point*, align 8
  %Point.obj.2 = alloca %struct.Point, align 8
  %inner.addr = alloca %struct.Point*, align 8
  %Point.obj.3 = alloca %struct.Point, align 8
  %i.addr = alloca i32, align 4
  %each.addr = alloca %struct.Point*, align 8
  %Point.obj.4 = alloca %struct.Point, align 8
  %sizes.addr = alloca %struct.nish_array*, align 8
  %Size.obj = alloca %struct.Size, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x %struct.Size], align 8
  %at.addr = alloca %struct.Point*, align 8
  %Size.obj.1 = alloca %struct.Size, align 8
  %held.addr = alloca %struct.Point*, align 8
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
  %20 = load %struct.Point*, %struct.Point** %r.addr, align 8
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 0
  store i32 3, i32* %25, align 4
  %26 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.2, i32 0, i32 1
  store i32 3, i32* %26, align 4
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to %struct.Point*
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %29, i64 0
  %31 = bitcast %struct.Point* %30 to i8*
  %32 = bitcast %struct.Point* %Point.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %31, i8* align 4 %32, i64 8, i1 false), !alias.scope !4, !noalias !3
  %33 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  %37 = icmp sgt i32 %36, 1
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to %struct.Point*
  %42 = getelementptr inbounds %struct.Point, %struct.Point* %41, i64 1
  store %struct.Point* %42, %struct.Point** %inner.addr, align 8
  %43 = load %struct.Point*, %struct.Point** %inner.addr, align 8
  %44 = getelementptr inbounds %struct.Point, %struct.Point* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  call void @nish_print(i8* %46)
  br label %if.end

if.end:
  %47 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 0
  store i32 4, i32* %48, align 4
  %49 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.3, i32 0, i32 1
  store i32 4, i32* %49, align 4
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to %struct.Point*
  %53 = getelementptr inbounds %struct.Point, %struct.Point* %52, i64 1
  %54 = bitcast %struct.Point* %53 to i8*
  %55 = bitcast %struct.Point* %Point.obj.3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %54, i8* align 4 %55, i64 8, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %i.addr, align 4
  %56 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %59 = load i32, i32* %i.addr, align 4
  %60 = icmp slt i32 %59, 2
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %62 = load i8*, i8** %61, align 8
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %64 = load i64, i64* %63, align 8
  %65 = load i32, i32* %i.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %58 to %struct.Point*
  %68 = getelementptr inbounds %struct.Point, %struct.Point* %67, i64 %66
  store %struct.Point* %68, %struct.Point** %each.addr, align 8
  %69 = load %struct.Point*, %struct.Point** %each.addr, align 8
  %70 = getelementptr inbounds %struct.Point, %struct.Point* %69, i32 0, i32 1
  %71 = load i32, i32* %70, align 4
  %72 = call i8* @nish_str_from_i32(i32 %71)
  call void @nish_print(i8* %72)
  %73 = load i32, i32* %i.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = load i32, i32* %i.addr, align 4
  %76 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.4, i32 0, i32 0
  store i32 %75, i32* %76, align 4
  %77 = load i32, i32* %i.addr, align 4
  %78 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.4, i32 0, i32 1
  store i32 %77, i32* %78, align 4
  %79 = bitcast i8* %58 to %struct.Point*
  %80 = getelementptr inbounds %struct.Point, %struct.Point* %79, i64 %74
  %81 = bitcast %struct.Point* %80 to i8*
  %82 = bitcast %struct.Point* %Point.obj.4 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %81, i8* align 4 %82, i64 8, i1 false), !alias.scope !4, !noalias !3
  %83 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %84 = load i8*, i8** %83, align 8
  %85 = icmp eq i8* %84, %62
  br i1 %85, label %pass.rewind, label %pass.free

pass.rewind:
  %86 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %64, i64* %86, align 8
  br label %pass.done

pass.free:
  %87 = ptrtoint i8* %62 to i64
  %88 = add i64 %87, %64
  call void @nish_arena_release(i64 %88)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %89 = load i32, i32* %i.addr, align 4
  %90 = add nsw i32 %89, 1
  store i32 %90, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %91 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj, i32 0, i32 0
  store i32 1, i32* %91, align 4
  %92 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj, i32 0, i32 1
  store i32 1, i32* %92, align 4
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %95 = bitcast [1 x %struct.Size]* %arr.data.1 to i8*
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %95, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %95 to %struct.Size*
  %98 = getelementptr inbounds %struct.Size, %struct.Size* %97, i64 0
  %99 = bitcast %struct.Size* %98 to i8*
  %100 = bitcast %struct.Size* %Size.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %99, i8* align 4 %100, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %sizes.addr, align 8
  %101 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %104 = bitcast i8* %103 to %struct.Point*
  %105 = getelementptr inbounds %struct.Point, %struct.Point* %104, i64 0
  store %struct.Point* %105, %struct.Point** %at.addr, align 8
  %106 = load %struct.nish_array*, %struct.nish_array** %sizes.addr, align 8
  %107 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj.1, i32 0, i32 0
  store i32 5, i32* %107, align 4
  %108 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj.1, i32 0, i32 1
  store i32 5, i32* %108, align 4
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to %struct.Size*
  %112 = getelementptr inbounds %struct.Size, %struct.Size* %111, i64 0
  %113 = bitcast %struct.Size* %112 to i8*
  %114 = bitcast %struct.Size* %Size.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %113, i8* align 4 %114, i64 8, i1 false), !alias.scope !4, !noalias !3
  %115 = load %struct.Point*, %struct.Point** %at.addr, align 8
  %116 = getelementptr inbounds %struct.Point, %struct.Point* %115, i32 0, i32 0
  %117 = load i32, i32* %116, align 4
  %118 = load %struct.nish_array*, %struct.nish_array** %sizes.addr, align 8
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to %struct.Size*
  %122 = getelementptr inbounds %struct.Size, %struct.Size* %121, i64 0
  %123 = getelementptr inbounds %struct.Size, %struct.Size* %122, i32 0, i32 0
  %124 = load i32, i32* %123, align 4
  %125 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %117, i32 %124)
  %126 = extractvalue { i32, i1 } %125, 0
  %127 = extractvalue { i32, i1 } %125, 1
  br i1 %127, label %ovf.fail, label %ovf.ok

ovf.ok:
  %128 = call i8* @nish_str_from_i32(i32 %126)
  call void @nish_print(i8* %128)
  %129 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %132 = bitcast i8* %131 to %struct.Point*
  %133 = getelementptr inbounds %struct.Point, %struct.Point* %132, i64 1
  store %struct.Point* %133, %struct.Point** %held.addr, align 8
  %134 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = bitcast i8* %136 to %struct.Point*
  %138 = getelementptr inbounds %struct.Point, %struct.Point* %137, i64 1
  %139 = getelementptr inbounds %struct.Point, %struct.Point* %138, i32 0, i32 0
  store i32 8, i32* %139, align 4
  %140 = load %struct.Point*, %struct.Point** %held.addr, align 8
  %141 = getelementptr inbounds %struct.Point, %struct.Point* %140, i32 0, i32 0
  %142 = load i32, i32* %141, align 4
  %143 = call i8* @nish_str_from_i32(i32 %142)
  call void @nish_print(i8* %143)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #3 = { nounwind willreturn readnone }

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
