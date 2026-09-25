%struct.Bag = type { %struct.nish_array*, i32, %struct.Bag* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Bag.constructor(%struct.Bag* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Bag, %struct.Bag* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Bag, %struct.Bag* %this, i32 0, i32 2
  store %struct.Bag* null, %struct.Bag** %1, align 8, !tbaa !6
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 7, i32* %9, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %10 = getelementptr inbounds %struct.Bag, %struct.Bag* %this, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %10, align 8, !tbaa !20
  ret void
}

define internal void @fill(%struct.Bag* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.Bag, %struct.Bag* %b, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !20
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  store i32 %5, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = trunc i64 %15 to i32
  %17 = getelementptr inbounds %struct.Bag, %struct.Bag* %b, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !5
  %19 = add nsw i32 %18, 1
  %20 = getelementptr inbounds %struct.Bag, %struct.Bag* %b, i32 0, i32 1
  store i32 %19, i32* %20, align 4, !tbaa !5
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @test() #1 {
entry:
  %b.addr = alloca %struct.Bag*, align 8
  %before.addr = alloca i32, align 4
  %first.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Bag*
  call void @Bag.constructor(%struct.Bag* %1)
  store %struct.Bag* %1, %struct.Bag** %b.addr, align 8
  %2 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %3 = getelementptr inbounds %struct.Bag, %struct.Bag* %2, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %before.addr, align 4
  %8 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %9 = getelementptr inbounds %struct.Bag, %struct.Bag* %8, i32 0, i32 0
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !20
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %13 = icmp ult i64 0, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  %18 = load i32, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  store i32 %18, i32* %first.addr, align 4
  %19 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %20 = getelementptr inbounds %struct.Bag, %struct.Bag* %19, i32 0, i32 1
  store i32 100, i32* %20, align 4, !tbaa !5
  %21 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %22 = getelementptr inbounds %struct.Bag, %struct.Bag* %21, i32 0, i32 2
  store %struct.Bag* null, %struct.Bag** %22, align 8, !tbaa !6
  %23 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  call void @fill(%struct.Bag* %23, i32 20)
  %24 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %25 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %26 = getelementptr inbounds %struct.Bag, %struct.Bag* %24, i32 0, i32 2
  store %struct.Bag* %25, %struct.Bag** %26, align 8, !tbaa !6
  %27 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %28 = getelementptr inbounds %struct.Bag, %struct.Bag* %27, i32 0, i32 0
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !20
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %32 = trunc i64 %31 to i32
  store i32 %32, i32* %after.addr, align 4
  %33 = load i32, i32* %before.addr, align 4
  %34 = mul nsw i32 %33, 1000000
  %35 = load i32, i32* %after.addr, align 4
  %36 = mul nsw i32 %35, 10000
  %37 = add nsw i32 %34, %36
  %38 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %39 = getelementptr inbounds %struct.Bag, %struct.Bag* %38, i32 0, i32 0
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !20
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %49 = mul nsw i32 %48, 1000
  %50 = add nsw i32 %37, %49
  %51 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %52 = getelementptr inbounds %struct.Bag, %struct.Bag* %51, i32 0, i32 0
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !20
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %56 = icmp ult i64 20, %55
  br i1 %56, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 20, i64 %55)
  unreachable

bounds.ok.2:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 20
  %61 = load i32, i32* %60, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %62 = mul nsw i32 %61, 10
  %63 = add nsw i32 %50, %62
  %64 = load i32, i32* %first.addr, align 4
  %65 = add nsw i32 %63, %64
  %66 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %67 = getelementptr inbounds %struct.Bag, %struct.Bag* %66, i32 0, i32 1
  %68 = load i32, i32* %67, align 4, !tbaa !5
  %69 = sub nsw i32 %65, %68
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %69
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Bag", !2, i64 0, !3, i64 8, !2, i64 16}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 16}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!4, !2, i64 0}
