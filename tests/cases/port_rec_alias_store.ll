%struct.Rec = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %r.addr = alloca %struct.Rec*, align 8
  %qs.addr = alloca %struct.nish_array*, align 8
  %Rec.obj.2 = alloca %struct.Rec, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %4 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store i32 1, i32* %4, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to %struct.Rec*
  %13 = getelementptr inbounds %struct.Rec, %struct.Rec* %12, i64 %6
  %14 = bitcast %struct.Rec* %13 to i8*
  %15 = bitcast %struct.Rec* %Rec.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %14, i8* align 4 %15, i64 4, i1 false), !alias.scope !4, !noalias !3
  %16 = add i64 %6, 1
  store i64 %16, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %19 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  store i32 2, i32* %19, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to %struct.Rec*
  %28 = getelementptr inbounds %struct.Rec, %struct.Rec* %27, i64 %21
  %29 = bitcast %struct.Rec* %28 to i8*
  %30 = bitcast %struct.Rec* %Rec.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %29, i8* align 4 %30, i64 4, i1 false), !alias.scope !4, !noalias !3
  %31 = add i64 %21, 1
  store i64 %31, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to %struct.Rec*
  %40 = getelementptr inbounds %struct.Rec, %struct.Rec* %39, i64 0
  store %struct.Rec* %40, %struct.Rec** %r.addr, align 8
  %41 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  store %struct.nish_array* %41, %struct.nish_array** %qs.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %qs.addr, align 8
  %43 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.2, i32 0, i32 0
  store i32 99, i32* %43, align 4
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 0, %45
  br i1 %46, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %45)
  unreachable

bounds.ok.1:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to %struct.Rec*
  %50 = getelementptr inbounds %struct.Rec, %struct.Rec* %49, i64 0
  %51 = bitcast %struct.Rec* %50 to i8*
  %52 = bitcast %struct.Rec* %Rec.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %51, i8* align 4 %52, i64 4, i1 false), !alias.scope !4, !noalias !3
  %53 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %54 = getelementptr inbounds %struct.Rec, %struct.Rec* %53, i32 0, i32 0
  %55 = load i32, i32* %54, align 4
  %56 = call i8* @nish_str_from_i32(i32 %55)
  call void @nish_print(i8* %56)
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
