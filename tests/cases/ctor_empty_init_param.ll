%struct.Counter = type { i32 }
%struct.Probe = type { i32, i32 }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Probe.constructor(%struct.Probe* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %seen) #0 {
entry:
  %0 = getelementptr inbounds %struct.Probe, %struct.Probe* %this, i32 0, i32 0
  store i32 3, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Probe, %struct.Probe* %this, i32 0, i32 1
  store i32 40, i32* %1, align 4, !tbaa !5
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %seen, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !7
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = getelementptr inbounds %struct.Counter, %struct.Counter* %seen, i32 0, i32 0
  store i32 %5, i32* %7, align 4, !tbaa !7
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.Probe*, align 8
  %Probe.obj = alloca %struct.Probe, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !7
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 3
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  call void @Probe.constructor(%struct.Probe* %Probe.obj, %struct.Counter* %3)
  store %struct.Probe* %Probe.obj, %struct.Probe** %p.addr, align 8
  %4 = load i32, i32* %total.addr, align 4
  %5 = load %struct.Probe*, %struct.Probe** %p.addr, align 8
  %6 = getelementptr inbounds %struct.Probe, %struct.Probe* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = load %struct.Probe*, %struct.Probe** %p.addr, align 8
  %12 = getelementptr inbounds %struct.Probe, %struct.Probe* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4, !tbaa !5
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %15, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %20 = getelementptr inbounds %struct.Counter, %struct.Counter* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !7
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = load i32, i32* %total.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
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

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Probe", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Counter", !2, i64 0}
!7 = !{!6, !2, i64 0}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}
