%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @dropLast(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %3
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define internal void @dropIfAny(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = sub i64 %5, 1
  store i64 %6, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  store i32 4, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  store i32 5, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %27, i64 4)
  br label %push.store.2

push.store.2:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  store i32 6, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @dropLast(%struct.nish_array* %39)
  %40 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @dropIfAny(%struct.nish_array* %40)
  %41 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = icmp ult i64 0, %48
  br i1 %49, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %48)
  unreachable

bounds.ok:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = bitcast i8* %51 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 0
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %55 = call i8* @nish_str_from_i32(i32 %54)
  call void @nish_print(i8* %55)
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
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
