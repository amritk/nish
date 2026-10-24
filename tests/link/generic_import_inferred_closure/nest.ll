%struct.Wrap$$Wrap$i32 = type { %struct.Box$$Wrap$i32* }
%struct.Box$$Wrap$i32 = type { %struct.Wrap$i32* }
%struct.Wrap$i32 = type { %struct.Box$i32* }
%struct.Box$i32 = type { i32 }

declare noundef nonnull align 8 dereferenceable(8) %struct.Wrap$$Wrap$i32* @nest$i32(i32 noundef) #0
declare void @Wrap$$Wrap$i32.constructor(%struct.Wrap$$Wrap$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Box$$Wrap$i32* noundef nonnull align 8 dereferenceable(8)) #0
declare void @Box$$Wrap$i32.constructor(%struct.Box$$Wrap$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Wrap$i32* noundef nonnull align 8 dereferenceable(8)) #0
declare noundef nonnull align 8 dereferenceable(8) %struct.Wrap$i32* @Box$$Wrap$i32.get(%struct.Box$$Wrap$i32* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @Wrap$i32.constructor(%struct.Wrap$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Box$i32* noundef nonnull align 8 dereferenceable(4)) #0
declare void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture) #1

define noundef i32 @viaNest$$Wrap$$Wrap$i32(%struct.Wrap$$Wrap$i32* noundef nonnull readonly align 8 dereferenceable(8) nocapture %v) #0 {
entry:
  %n.addr = alloca %struct.Wrap$$Wrap$i32*, align 8
  %0 = call %struct.Wrap$$Wrap$i32* @nest$i32(i32 9)
  store %struct.Wrap$$Wrap$i32* %0, %struct.Wrap$$Wrap$i32** %n.addr, align 8
  %1 = load %struct.Wrap$$Wrap$i32*, %struct.Wrap$$Wrap$i32** %n.addr, align 8
  %2 = getelementptr inbounds %struct.Wrap$$Wrap$i32, %struct.Wrap$$Wrap$i32* %1, i32 0, i32 0
  %3 = load %struct.Box$$Wrap$i32*, %struct.Box$$Wrap$i32** %2, align 8, !tbaa !4
  %4 = call %struct.Wrap$i32* @Box$$Wrap$i32.get(%struct.Box$$Wrap$i32* %3)
  %5 = getelementptr inbounds %struct.Wrap$i32, %struct.Wrap$i32* %4, i32 0, i32 0
  %6 = load %struct.Box$i32*, %struct.Box$i32** %5, align 8, !tbaa !6
  %7 = call i32 @Box$i32.get(%struct.Box$i32* %6)
  ret i32 %7
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Wrap$$Wrap$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Wrap$i32", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
