%struct.Point = type { i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define noundef i32 @sum(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %pattern.284.addr = alloca %struct.Point*, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  call void @Point.constructor(%struct.Point* %Point.obj, i32 %a, i32 %b)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  store %struct.Point* %0, %struct.Point** %pattern.284.addr, align 8
  %1 = load %struct.Point*, %struct.Point** %pattern.284.addr, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  store i32 %3, i32* %x.addr, align 4
  %4 = load %struct.Point*, %struct.Point** %pattern.284.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  store i32 %6, i32* %y.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  %8 = load i32, i32* %y.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @sum(i32 3, i32 4)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!6, !7, !8, !9, !10}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{i32 8, !"cf-protection-branch", i32 1}
!7 = !{i32 8, !"cf-protection-return", i32 1}
!8 = !{i32 8, !"branch-target-enforcement", i32 1}
!9 = !{i32 8, !"sign-return-address", i32 1}
!10 = !{i32 4, !"probe-stack", !"inline-asm"}
