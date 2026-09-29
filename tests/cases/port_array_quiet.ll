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
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %grown.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %17 = load i32, i32* %i.addr, align 4
  %18 = load i32, i32* %n.addr, align 4
  %19 = icmp slt i32 %17, %18
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  store i32 %21, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = load i32, i32* %n.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 %36, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 %36, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = mul i64 %36, 8
  %42 = call i8* @nish_alloc_struct(i64 %41)
  call void @llvm.memset.p0i8.i64(i8* align 8 %42, i8 0, i64 %41, i1 false), !alias.scope !4, !noalias !3
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %38, %struct.nish_array** %floats.addr, align 8
  %44 = load i32, i32* %n.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = call i8* @nish_alloc_struct(i64 24)
  %47 = bitcast i8* %46 to %struct.nish_array*
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  store i64 %45, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  store i64 %45, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = mul i64 %45, 8
  %51 = call i8* @nish_alloc_struct(i64 %50)
  call void @llvm.memset.p0i8.i64(i8* align 8 %51, i8 0, i64 %50, i1 false), !alias.scope !4, !noalias !3
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  store i8* %51, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %47, %struct.nish_array** %points.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = trunc i64 %55 to i32
  %57 = load %struct.nish_array*, %struct.nish_array** %hex.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  %61 = add nsw i32 %56, %60
  %62 = load %struct.nish_array*, %struct.nish_array** %separated.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = trunc i64 %64 to i32
  %66 = add nsw i32 %61, %65
  %67 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = icmp ult i64 2, %69
  br i1 %70, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %69)
  unreachable

bounds.ok:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %73 = bitcast i8* %72 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 2
  %75 = load i32, i32* %74, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %76 = add nsw i32 %66, %75
  %77 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = trunc i64 %79 to i32
  %81 = add nsw i32 %76, %80
  %82 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = trunc i64 %84 to i32
  %86 = add nsw i32 %81, %85
  %87 = call i8* @nish_str_from_i32(i32 %86)
  call void @nish_print(i8* %87)
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
