%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
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

define noundef i32 @test() #0 {
entry:
  %width.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %width.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %width.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %6, %7
  %9 = sext i32 %8 to i64
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 %9, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 %9, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = mul i64 %9, 4
  %15 = call i8* @nish_alloc_struct(i64 %14)
  call void @llvm.memset.p0i8.i64(i8* align 8 %15, i8 0, i64 %14, i1 false), !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %11, %struct.nish_array** %row.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  store i32 %18, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %26 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %27 = load i32, i32* %i.addr, align 4
  %28 = mul nsw i32 %27, 2
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ult i64 1, %30
  br i1 %31, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %30)
  unreachable

bounds.ok.1:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 1
  store i32 %28, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = load i32, i32* %total.addr, align 4
  %37 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 0
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add nsw i32 %36, %42
  %44 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 1
  %49 = load i32, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = add nsw i32 %43, %49
  %51 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = trunc i64 %53 to i32
  %55 = add nsw i32 %50, %54
  store i32 %55, i32* %total.addr, align 4
  %56 = load i32, i32* %i.addr, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr, align 4
  %58 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %59 = load i8*, i8** %58, align 8
  %60 = icmp eq i8* %59, %3
  br i1 %60, label %pass.rewind, label %pass.free

pass.rewind:
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %61, align 8
  br label %pass.done

pass.free:
  %62 = ptrtoint i8* %3 to i64
  %63 = add i64 %62, %5
  call void @nish_arena_release(i64 %63)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %64 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %64
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
