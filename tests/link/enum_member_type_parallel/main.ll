%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$em.p0.en$Kind$fn.16.nish_main$arrow1(i32 noundef) #1
declare noundef i32 @nish.parallelReduce$em.p0.en$Kind$fn.4.pick(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
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

define hidden noundef i32 @pick$(i32 noundef %acc, i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define noundef i32 @nish_main() #1 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i32, align 4
  %scalar.addr = alloca i1, align 1
  %arena.mark = call i64 @nish_arena_mark()
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
  %10 = call %struct.nish_array* @nish.parallelMap$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* %1)
  store %struct.nish_array* %10, %struct.nish_array** %a.addr, align 8
  %11 = call %struct.nish_array* @nish.parallelFrom$em.p0.en$Kind$fn.16.nish_main$arrow1(i32 4)
  store %struct.nish_array* %11, %struct.nish_array** %b.addr, align 8
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 2, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 2, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 0, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 0, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %13, %struct.nish_array** %src.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %22 = call i32 @nish.parallelReduce$em.p0.en$Kind$fn.4.pick(%struct.nish_array* %21, i32 0)
  store i32 %22, i32* %c.addr, align 4
  %23 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ult i64 0, %25
  br i1 %26, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %25)
  unreachable

bounds.ok:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 0
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = icmp eq i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 3, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 3
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = icmp eq i32 %41, 0
  br label %land.end.1

land.end.1:
  %43 = phi i1 [ false, %bounds.ok ], [ %42, %bounds.ok.1 ]
  br i1 %43, label %land.rhs, label %land.end

land.rhs:
  %44 = load i32, i32* %c.addr, align 4
  %45 = icmp eq i32 %44, 0
  br label %land.end

land.end:
  %46 = phi i1 [ false, %land.end.1 ], [ %45, %land.rhs ]
  store i1 %46, i1* %scalar.addr, align 1
  %47 = load i1, i1* %scalar.addr, align 1
  %48 = select i1 %47, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %50 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = trunc i64 %52 to i32
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %49, i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %56, i8* %61)
  call void @nish_print(i8* %62)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %x) #0 {
entry:
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %i) #0 {
entry:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
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
