%struct.Box = type { { %struct.nish_array, [6 x i32] } }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i32* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 24, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 6, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  ret void
}

define internal noundef i32 @Box.take(%struct.Box* noundef nonnull align 8 dereferenceable(48) nocapture %this, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0, i32 0
  %3 = sext i32 %i to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0, i32 1, i64 0
  %8 = bitcast i32* %7 to i8*
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %11
}

define noundef i32 @nish_main() #1 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 6, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  call void @Box.constructor(%struct.Box* %Box.obj)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %6 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %7 = getelementptr inbounds %struct.Box, %struct.Box* %6, i32 0, i32 0, i32 0
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %6, i32 0, i32 0, i32 1, i64 0
  %9 = bitcast i32* %8 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 24, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 6, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %12 = call i32 @Box.take(%struct.Box* %11, i32 2)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
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
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 8}
!14 = !{!9, !8, i64 16}
