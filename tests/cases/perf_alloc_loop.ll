%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare noundef i64 @amrit_arena_mark() #2
declare void @amrit_arena_release(i64 noundef) #2
declare void @amrit_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @test() #0 {
entry:
  %width.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.amrit_array*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i32 3, i32* %width.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %width.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %2, %3
  %5 = sext i32 %4 to i64
  %6 = call i8* @amrit_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.amrit_array*
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %7, i64 0, i32 0
  store i64 %5, i64* %8, align 8, !alias.scope !3, !noalias !4
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %7, i64 0, i32 1
  store i64 %5, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = mul i64 %5, 4
  %11 = call i8* @amrit_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %7, %struct.amrit_array** %row.addr, align 8
  %13 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  store i32 %14, i32* %21, align 4, !alias.scope !4, !noalias !3
  %22 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %23 = load i32, i32* %i.addr, align 4
  %24 = mul nsw i32 %23, 2
  %25 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %22, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4
  %27 = icmp ult i64 1, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 1, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %22, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 1
  store i32 %24, i32* %31, align 4, !alias.scope !4, !noalias !3
  %32 = load i32, i32* %total.addr, align 4
  %33 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %34 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok.2:
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3
  %42 = add nsw i32 %32, %41
  %43 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %44 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4
  %46 = icmp ult i64 1, %45
  br i1 %46, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 1, i64 %45)
  unreachable

bounds.ok.3:
  %47 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %43, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 1
  %51 = load i32, i32* %50, align 4, !alias.scope !4, !noalias !3
  %52 = add nsw i32 %42, %51
  %53 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %54 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4
  %56 = trunc i64 %55 to i32
  %57 = add nsw i32 %52, %56
  store i32 %57, i32* %total.addr, align 4
  %58 = load i32, i32* %i.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %60 = load i32, i32* %total.addr, align 4
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %60
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
