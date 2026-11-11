%struct.Stage = type { i32 }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @double(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @negate(i32 noundef %x) #0 {
entry:
  %0 = sub nsw i32 0, %x
  ret i32 %0
}

define internal void @Stage.constructor(%struct.Stage* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %op) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stage, %struct.Stage* %this, i32 0, i32 0
  store i32 %op, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Stage.run(%struct.Stage* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #2 {
entry:
  %0 = getelementptr inbounds %struct.Stage, %struct.Stage* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call i32 @$ref.0.fr1.i32.i32.0(i32 %1, i32 %x)
  ret i32 %2
}

define void @nish_main() #1 {
entry:
  %s.addr = alloca %struct.Stage*, align 8
  %Stage.obj = alloca %struct.Stage, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Stage.constructor(%struct.Stage* %Stage.obj, i32 1)
  store %struct.Stage* %Stage.obj, %struct.Stage** %s.addr, align 8
  %0 = load %struct.Stage*, %struct.Stage** %s.addr, align 8
  %1 = call i32 @Stage.run(%struct.Stage* %0, i32 5)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load %struct.Stage*, %struct.Stage** %s.addr, align 8
  %4 = getelementptr inbounds %struct.Stage, %struct.Stage* %3, i32 0, i32 0
  store i32 2, i32* %4, align 4, !tbaa !4
  %5 = load %struct.Stage*, %struct.Stage** %s.addr, align 8
  %6 = call i32 @Stage.run(%struct.Stage* %5, i32 5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @double(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @negate(i32 %$a0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Stage", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
