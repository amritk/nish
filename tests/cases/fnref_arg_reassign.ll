%struct.Box = type { i32 }

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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %op) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %op, i32* %0, align 4, !tbaa !4
  ret void
}

define void @nish_main() #0 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %op.addr = alloca i32, align 4
  %first.addr = alloca i32, align 4
  %now.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj, i32 1)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %0 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  store i32 %2, i32* %op.addr, align 4
  %3 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %4 = load i32, i32* %op.addr, align 4
  %5 = call i32 @swapThen$fn.16.nish_main$arrow0(%struct.Box* %3, i32 3, i32 %4)
  store i32 %5, i32* %first.addr, align 4
  %6 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %7 = getelementptr inbounds %struct.Box, %struct.Box* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  store i32 %8, i32* %now.addr, align 4
  %9 = load i32, i32* %first.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %12 = load i32, i32* %now.addr, align 4
  %13 = call i32 @$ref.0.fr1.i32.i32.0(i32 %12, i32 3)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %11, i8* %14)
  call void @nish_print(i8* %15)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %$a0, i32 noundef %op) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %op, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @swapThen$fn.16.nish_main$arrow0(%struct.Box* noundef nonnull align 8 dereferenceable(4) nocapture %b, i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i32 2, i32* %0, align 4, !tbaa !4
  %1 = call i32 @nish_main$arrow0(i32 %x, i32 %cap.0)
  ret i32 %1
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

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
