%struct.Gauge = type { i32, i32 }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @Gauge.constructor(%struct.Gauge* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  store i32 10, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 1
  store i32 5, i32* %1, align 4, !tbaa !5
  %2 = call i32 @Gauge.next(%struct.Gauge* %this)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @Gauge.next(%struct.Gauge* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %g.addr = alloca %struct.Gauge*, align 8
  %Gauge.obj = alloca %struct.Gauge, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Gauge.constructor(%struct.Gauge* %Gauge.obj)
  store %struct.Gauge* %Gauge.obj, %struct.Gauge** %g.addr, align 8
  %0 = load %struct.Gauge*, %struct.Gauge** %g.addr, align 8
  %1 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = load %struct.Gauge*, %struct.Gauge** %g.addr, align 8
  %4 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!6, !7, !8, !9, !10}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Gauge", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{i32 8, !"cf-protection-branch", i32 1}
!7 = !{i32 8, !"cf-protection-return", i32 1}
!8 = !{i32 8, !"branch-target-enforcement", i32 1}
!9 = !{i32 8, !"sign-return-address", i32 1}
!10 = !{i32 4, !"probe-stack", !"inline-asm"}
