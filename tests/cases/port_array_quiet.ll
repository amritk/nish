%struct.Point = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [0 x double], align 8
  %hex.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [0 x double], align 8
  %separated.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [0 x i1], align 8
  %named.addr = alloca %struct.nish_array*, align 8
  %negative.addr = alloca %struct.nish_array*, align 8
  %grown.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %floats.addr = alloca %struct.nish_array*, align 8
  %points.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 0, 8
  %3 = bitcast [0 x double]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %none.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = mul i64 0, 8
  %8 = bitcast [0 x double]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %hex.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast [0 x i1]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 0, i1 false), !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %separated.addr, align 8
  %14 = sext i32 0 to i64
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 %14, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 %14, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = mul i64 %14, 4
  %20 = call i8* @nish_alloc_struct(i64 %19)
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 %19, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %16, %struct.nish_array** %named.addr, align 8
  %22 = sub nsw i32 0, 0
  %23 = sext i32 %22 to i64
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 %23, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 %23, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = mul i64 %23, 4
  %29 = call i8* @nish_alloc_struct(i64 %28)
  call void @llvm.memset.p0i8.i64(i8* align 8 %29, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %25, %struct.nish_array** %negative.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %grown.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %34 = load i32, i32* %i.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br i1 %36, label %for.body, label %for.end

for.body:
  %37 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %38 = load i32, i32* %i.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = icmp eq i64 %40, %42
  br i1 %43, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %37, i64 4)
  br label %push.store

push.store:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %40
  store i32 %38, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = add i64 %40, 1
  store i64 %48, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = trunc i64 %48 to i32
  br label %for.inc

for.inc:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %52 = load i32, i32* %n.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = call i8* @nish_alloc_struct(i64 24)
  %55 = bitcast i8* %54 to %struct.nish_array*
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  store i64 %53, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  store i64 %53, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = mul i64 %53, 8
  %59 = call i8* @nish_alloc_struct(i64 %58)
  call void @llvm.memset.p0i8.i64(i8* align 8 %59, i8 0, i64 %58, i1 false), !alias.scope !4, !noalias !3
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %55, %struct.nish_array** %floats.addr, align 8
  %61 = load i32, i32* %n.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = call i8* @nish_alloc_struct(i64 24)
  %64 = bitcast i8* %63 to %struct.nish_array*
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  store i64 %62, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 1
  store i64 %62, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = mul i64 %62, 8
  %68 = call i8* @nish_alloc_struct(i64 %67)
  call void @llvm.memset.p0i8.i64(i8* align 8 %68, i8 0, i64 %67, i1 false), !alias.scope !4, !noalias !3
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  store i8* %68, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %64, %struct.nish_array** %points.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = trunc i64 %72 to i32
  %74 = load %struct.nish_array*, %struct.nish_array** %hex.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = trunc i64 %76 to i32
  %78 = add nsw i32 %73, %77
  %79 = load %struct.nish_array*, %struct.nish_array** %separated.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = trunc i64 %81 to i32
  %83 = add nsw i32 %78, %82
  %84 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = trunc i64 %86 to i32
  %88 = add nsw i32 %83, %87
  %89 = load %struct.nish_array*, %struct.nish_array** %negative.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = trunc i64 %91 to i32
  %93 = add nsw i32 %88, %92
  %94 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %97 = icmp ult i64 2, %96
  br i1 %97, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %96)
  unreachable

bounds.ok:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i32*
  %101 = getelementptr inbounds i32, i32* %100, i64 2
  %102 = load i32, i32* %101, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %103 = add nsw i32 %93, %102
  %104 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = trunc i64 %106 to i32
  %108 = add nsw i32 %103, %107
  %109 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = trunc i64 %111 to i32
  %113 = add nsw i32 %108, %112
  %114 = call i8* @nish_str_from_i32(i32 %113)
  call void @nish_print(i8* %114)
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
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
