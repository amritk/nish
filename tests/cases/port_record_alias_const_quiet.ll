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
  %p.addr = alloca %struct.Rec*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %q.addr = alloca %struct.Rec*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %3 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  store i32 1, i32* %3, align 4
  store %struct.Rec* %Rec.obj, %struct.Rec** %p.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %5 = load %struct.Rec*, %struct.Rec** %p.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %4, i64 4)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.Rec*
  %14 = getelementptr inbounds %struct.Rec, %struct.Rec* %13, i64 %7
  %15 = bitcast %struct.Rec* %14 to i8*
  %16 = bitcast %struct.Rec* %5 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %15, i8* align 4 %16, i64 4, i1 false), !alias.scope !4, !noalias !3
  %17 = add i64 %7, 1
  store i64 %17, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = load %struct.Rec*, %struct.Rec** %p.addr, align 8
  store %struct.Rec* %19, %struct.Rec** %q.addr, align 8
  %20 = load %struct.Rec*, %struct.Rec** %q.addr, align 8
  %21 = getelementptr inbounds %struct.Rec, %struct.Rec* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to %struct.Rec*
  %31 = getelementptr inbounds %struct.Rec, %struct.Rec* %30, i64 0
  %32 = getelementptr inbounds %struct.Rec, %struct.Rec* %31, i32 0, i32 0
  store i32 5, i32* %32, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to %struct.Rec*
  %37 = getelementptr inbounds %struct.Rec, %struct.Rec* %36, i64 0
  %38 = getelementptr inbounds %struct.Rec, %struct.Rec* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  call void @nish_print(i8* %40)
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
