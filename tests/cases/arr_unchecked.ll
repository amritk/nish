%struct.amrit_array = type { i64, i64, i8* }

define internal noundef i32 @get(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3
  ret i32 %5
}

define internal void @set(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, i32 noundef %v) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  store i32 %v, i32* %4, align 4, !alias.scope !4, !noalias !3
  ret void
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
