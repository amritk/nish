%struct.nish_array = type { i64, i64, i8* }

declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0

define noundef nonnull align 8 i8* @cut(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %0 = sext i32 %start to i64
  %1 = sext i32 %end to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = sub i64 %1, %0
  %6 = call i8* @nish_str_new(i8* %4, i64 %5)
  ret i8* %6
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!11, !12, !13, !14, !15}
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
!10 = !{!9, !8, i64 16}
!11 = !{i32 8, !"cf-protection-branch", i32 1}
!12 = !{i32 8, !"cf-protection-return", i32 1}
!13 = !{i32 8, !"branch-target-enforcement", i32 1}
!14 = !{i32 8, !"sign-return-address", i32 1}
!15 = !{i32 4, !"probe-stack", !"inline-asm"}
