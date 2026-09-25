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
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %10, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast [1 x %struct.Rec]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast i8* %13 to %struct.Rec*
  %16 = getelementptr inbounds %struct.Rec, %struct.Rec* %15, i64 0
  %17 = bitcast %struct.Rec* %16 to i8*
  %18 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %17, i8* align 8 %18, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 1, i64* %21, align 8, !alias.scope !3, !noalias !4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 1, i64* %22, align 8, !alias.scope !3, !noalias !4
  %23 = call i8* @nish_alloc_struct(i64 4)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 7, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %27 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store %struct.nish_array* %20, %struct.nish_array** %27, align 8
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %short.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %30 to %struct.Rec*
  %32 = getelementptr inbounds %struct.Rec, %struct.Rec* %31, i64 0
  store %struct.Rec* %32, %struct.Rec** %r.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %while.cond

while.cond:
  %36 = load i32, i32* %i.addr, align 4
  %37 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %38 = getelementptr inbounds %struct.Rec, %struct.Rec* %37, i32 0, i32 0
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4
  %42 = trunc i64 %41 to i32
  %43 = icmp slt i32 %36, %42
  br i1 %43, label %while.body, label %while.end

while.body:
  %44 = load i32, i32* %i.addr, align 4
  %45 = icmp eq i32 %44, 1
  br i1 %45, label %if.then, label %if.end

if.then:
  %46 = load %struct.Rec*, %struct.Rec** %short.addr, align 8
  %47 = bitcast i8* %35 to %struct.Rec*
  %48 = getelementptr inbounds %struct.Rec, %struct.Rec* %47, i64 0
  %49 = bitcast %struct.Rec* %48 to i8*
  %50 = bitcast %struct.Rec* %46 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %49, i8* align 8 %50, i64 8, i1 false), !alias.scope !4, !noalias !3
  br label %if.end

if.end:
  %51 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %52 = getelementptr inbounds %struct.Rec, %struct.Rec* %51, i32 0, i32 0
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8
  %54 = load i32, i32* %i.addr, align 4
  %55 = sext i32 %54 to i64
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4
  %58 = icmp ult i64 %55, %57
  br i1 %58, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %55, i64 %57)
  unreachable

bounds.ok:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %55
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %63, i32* %x.addr, align 4
  %64 = load i32, i32* %x.addr, align 4
  %65 = call i8* @nish_str_from_i32(i32 %64)
  call void @nish_print(i8* %65)
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
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
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
