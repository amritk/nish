%struct.Rec = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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
  %rs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Rec], align 8
  %short.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %r.addr = alloca %struct.Rec*, align 8
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %10, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast [1 x %struct.Rec]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to %struct.Rec*
  %16 = getelementptr inbounds %struct.Rec, %struct.Rec* %15, i64 0
  %17 = bitcast %struct.Rec* %16 to i8*
  %18 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %17, i8* align 8 %18, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 1, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 1, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = call i8* @nish_alloc_struct(i64 4)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 7, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %20, %struct.nish_array** %27, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to %struct.Rec*
  %32 = getelementptr inbounds %struct.Rec, %struct.Rec* %31, i64 0
  store %struct.Rec* %32, %struct.Rec** %r.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %38 = load i32, i32* %i.addr, align 4
  %39 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %40 = getelementptr inbounds %struct.Rec, %struct.Rec* %39, i32 0, i32 0
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = icmp slt i32 %38, %44
  br i1 %45, label %while.body, label %while.end

while.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp eq i32 %46, 1
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %49 = icmp ult i64 0, %35
  br i1 %49, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %50 = bitcast i8* %37 to %struct.Rec*
  %51 = getelementptr inbounds %struct.Rec, %struct.Rec* %50, i64 0
  %52 = bitcast %struct.Rec* %51 to i8*
  %53 = bitcast %struct.Rec* %48 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %52, i8* align 8 %53, i64 8, i1 false), !alias.scope !4, !noalias !3
  br label %if.end

if.end:
  %54 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %55 = getelementptr inbounds %struct.Rec, %struct.Rec* %54, i32 0, i32 0
  %56 = load %struct.nish_array*, %struct.nish_array** %55, align 8
  %57 = load i32, i32* %i.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = icmp ult i64 %58, %60
  br i1 %61, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %58, i64 %60)
  unreachable

bounds.ok.1:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %58
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %66, i32* %x.addr, align 4
  %67 = load i32, i32* %x.addr, align 4
  %68 = call i8* @nish_str_from_i32(i32 %67)
  call void @nish_print(i8* %68)
  %69 = load i32, i32* %i.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %i.addr, align 4
  br label %while.cond

while.end:
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
