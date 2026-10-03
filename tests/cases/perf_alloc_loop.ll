%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %10 = icmp ule i64 %9, 2147483647
  br i1 %10, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 %9, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 %9, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = mul i64 %9, 4
  %16 = call i8* @nish_alloc_struct(i64 %15)
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %15, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %12, %struct.nish_array** %row.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 0, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 %19, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %28 = load i32, i32* %i.addr, align 4
  %29 = mul nsw i32 %28, 2
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 1, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 1
  store i32 %29, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = load i32, i32* %total.addr, align 4
  %38 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 0
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = add nsw i32 %37, %43
  %45 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 1
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = add nsw i32 %44, %50
  %52 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = add nsw i32 %51, %55
  store i32 %56, i32* %total.addr, align 4
  %57 = load i32, i32* %i.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %i.addr, align 4
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %60 = load i8*, i8** %59, align 8
  %61 = icmp eq i8* %60, %3
  br i1 %61, label %pass.rewind, label %pass.free

pass.rewind:
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %62, align 8
  br label %pass.done

pass.free:
  %63 = ptrtoint i8* %3 to i64
  %64 = add i64 %63, %5
  call void @nish_arena_release(i64 %64)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %65 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %65
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
