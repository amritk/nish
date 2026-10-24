%struct.Point = type { i32, i32 }
%struct.Size = type { i32, i32 }
%struct.Counter = type { i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !7
  ret void
}

define internal noundef i32 @Counter.get(%struct.Counter* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !7
  ret i32 %1
}

define noundef i32 @nish_main() #2 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %s.addr = alloca %struct.Size*, align 8
  %Size.obj = alloca %struct.Size, align 8
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 3, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 4, i32* %1, align 4, !tbaa !5
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %2 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj, i32 0, i32 0
  store i32 10, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Size, %struct.Size* %Size.obj, i32 0, i32 1
  store i32 20, i32* %3, align 4
  store %struct.Size* %Size.obj, %struct.Size** %s.addr, align 8
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 5)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %8 = getelementptr inbounds %struct.Point, %struct.Point* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !5
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %13)
  %14 = load %struct.Size*, %struct.Size** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Size, %struct.Size* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4
  %17 = load %struct.Size*, %struct.Size** %s.addr, align 8
  %18 = getelementptr inbounds %struct.Size, %struct.Size* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %23)
  %24 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %25 = call i32 @Counter.get(%struct.Counter* %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Counter", !2, i64 0}
!7 = !{!6, !2, i64 0}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}
