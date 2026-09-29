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
  %22 = sext i32 0 to i64
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 %22, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 %22, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = mul i64 %22, 4
  %28 = call i8* @nish_alloc_struct(i64 %27)
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %24, %struct.nish_array** %negative.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %grown.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %33 = load i32, i32* %i.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br i1 %35, label %for.body, label %for.end

for.body:
  %36 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %37 = load i32, i32* %i.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = icmp eq i64 %39, %41
  br i1 %42, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store

push.store:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %39
  store i32 %37, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = add i64 %39, 1
  store i64 %47, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = trunc i64 %47 to i32
  br label %for.inc

for.inc:
  %49 = load i32, i32* %i.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %51 = load i32, i32* %n.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = call i8* @nish_alloc_struct(i64 24)
  %54 = bitcast i8* %53 to %struct.nish_array*
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  store i64 %52, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 1
  store i64 %52, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = mul i64 %52, 8
  %58 = call i8* @nish_alloc_struct(i64 %57)
  call void @llvm.memset.p0i8.i64(i8* align 8 %58, i8 0, i64 %57, i1 false), !alias.scope !4, !noalias !3
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  store i8* %58, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %54, %struct.nish_array** %floats.addr, align 8
  %60 = load i32, i32* %n.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = call i8* @nish_alloc_struct(i64 24)
  %63 = bitcast i8* %62 to %struct.nish_array*
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  store i64 %61, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  store i64 %61, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = mul i64 %61, 8
  %67 = call i8* @nish_alloc_struct(i64 %66)
  call void @llvm.memset.p0i8.i64(i8* align 8 %67, i8 0, i64 %66, i1 false), !alias.scope !4, !noalias !3
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  store i8* %67, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %63, %struct.nish_array** %points.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = trunc i64 %71 to i32
  %73 = load %struct.nish_array*, %struct.nish_array** %hex.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = add nsw i32 %72, %76
  %78 = load %struct.nish_array*, %struct.nish_array** %separated.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = trunc i64 %80 to i32
  %82 = add nsw i32 %77, %81
  %83 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = trunc i64 %85 to i32
  %87 = add nsw i32 %82, %86
  %88 = load %struct.nish_array*, %struct.nish_array** %negative.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = trunc i64 %90 to i32
  %92 = add nsw i32 %87, %91
  %93 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 2, %95
  br i1 %96, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %95)
  unreachable

bounds.ok:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 2
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = add nsw i32 %92, %101
  %103 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %105 = load i64, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %106 = trunc i64 %105 to i32
  %107 = add nsw i32 %102, %106
  %108 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = trunc i64 %110 to i32
  %112 = add nsw i32 %107, %111
  %113 = call i8* @nish_str_from_i32(i32 %112)
  call void @nish_print(i8* %113)
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
