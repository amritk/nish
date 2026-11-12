%struct.Runner = type { i32 }
%struct.Made = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @inc(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @dbl(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @Runner.constructor(%struct.Runner* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Runner, %struct.Runner* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Runner, %struct.Runner* %this, i32 0, i32 0
  store i32 %b, i32* %1, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Runner.run(%struct.Runner* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = call i32 @apply$fn.17.Runner.run$arrow0(i32 %x, i32 %f)
  ret i32 %0
}

define internal void @Made.constructor(%struct.Made* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Made, %struct.Made* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !6
  %1 = call i32 @apply$fn.23.Made.constructor$arrow0(i32 %x, i32 %f)
  %2 = getelementptr inbounds %struct.Made, %struct.Made* %this, i32 0, i32 0
  store i32 %1, i32* %2, align 4, !tbaa !6
  ret void
}

define void @nish_main() #0 {
entry:
  %r.addr = alloca %struct.Runner*, align 8
  %Runner.obj = alloca %struct.Runner, align 8
  %Made.obj = alloca %struct.Made, align 8
  %Made.obj.1 = alloca %struct.Made, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Runner.constructor(%struct.Runner* %Runner.obj, i32 100)
  store %struct.Runner* %Runner.obj, %struct.Runner** %r.addr, align 8
  %0 = load %struct.Runner*, %struct.Runner** %r.addr, align 8
  %1 = call i32 @Runner.run(%struct.Runner* %0, i32 1, i32 3)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = load %struct.Runner*, %struct.Runner** %r.addr, align 8
  %5 = call i32 @Runner.run(%struct.Runner* %4, i32 2, i32 3)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  call void @Made.constructor(%struct.Made* %Made.obj, i32 1, i32 1)
  %9 = getelementptr inbounds %struct.Made, %struct.Made* %Made.obj, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !6
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  call void @Made.constructor(%struct.Made* %Made.obj.1, i32 2, i32 1)
  %14 = getelementptr inbounds %struct.Made, %struct.Made* %Made.obj.1, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !6
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  call void @nish_print(i8* %17)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @Runner.run$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 100)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @Made.constructor$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 10)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @apply$fn.17.Runner.run$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @Runner.run$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.23.Made.constructor$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @Made.constructor$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @inc(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @dbl(i32 %$a0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Runner", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Made", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
