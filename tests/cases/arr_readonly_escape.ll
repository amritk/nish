%struct.Window = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal void @Window.constructor(%struct.Window* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %rows) #0 {
entry:
  %0 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 0
  store %struct.nish_array* %rows, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @first(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #1 {
entry:
  ret %struct.nish_array* %xs
}

define noundef i32 @hold(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %w.addr = alloca %struct.Window*, align 8
  %Window.obj = alloca %struct.Window, align 8
  call void @Window.constructor(%struct.Window* %Window.obj, %struct.nish_array* %xs)
  store %struct.Window* %Window.obj, %struct.Window** %w.addr, align 8
  %0 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %1 = getelementptr inbounds %struct.Window, %struct.Window* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = trunc i64 %4 to i32
  ret i32 %5
}

define noundef i32 @touch(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %rows, i32 noundef %v) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9
  %5 = bitcast i8* %4 to %struct.nish_array**
  %6 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %5, i64 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !alias.scope !9, !noalias !8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9
  %10 = icmp ult i64 0, %9
  br i1 %10, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %9)
  unreachable

bounds.ok.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 %v, i32* %14, align 4, !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9
  %17 = trunc i64 %16 to i32
  ret i32 %17
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Window", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
