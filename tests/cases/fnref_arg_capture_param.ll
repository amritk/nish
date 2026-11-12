%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
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

define internal noundef i32 @outer(i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = call i32 @apply$fn.12.outer$arrow0(i32 %x, i32 %f)
  ret i32 %0
}

define internal noundef i32 @narrowed(i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = icmp ne i32 %f, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @apply$fn.15.narrowed$arrow0(i32 %x, i32 %f)
  ret i32 %1

if.end:
  ret i32 -1
}

define internal noundef i32 @elements(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %fs, i32 noundef %x) #0 {
entry:
  %0 = call i32 @apply$fn.15.elements$arrow0(i32 %x, %struct.nish_array* %fs)
  ret i32 %0
}

define void @nish_main() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @outer(i32 1, i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call i32 @outer(i32 2, i32 3)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @narrowed(i32 1, i32 3)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = call i32 @narrowed(i32 2, i32 3)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %8, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = call i32 @narrowed(i32 0, i32 3)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %12, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast [2 x i32]* %arr.data to i8*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %19 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 1, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = getelementptr inbounds i32, i32* %21, i64 1
  store i32 2, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %24 = call i32 @elements(%struct.nish_array* %arr.hdr, i32 5)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %16, i8* %25)
  call void @nish_print(i8* %26)
  %27 = call i32 @via$fn.3.inc(i32 2, i32 3)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = call i32 @via$fn.3.dbl(i32 1, i32 3)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %29, i8* %31)
  call void @nish_print(i8* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @outer$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @narrowed$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @elements$arrow0(i32 noundef %y, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %fs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %fs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 1, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %fs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 1
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = call i32 @$ref.0.fr1.i32.i32.0(i32 %7, i32 %y)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %fs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 0, %10
  br i1 %11, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok.1:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %fs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = call i32 @$ref.0.fr1.i32.i32.0(i32 %16, i32 %y)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @apply$fn.12.outer$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @outer$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.15.narrowed$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @narrowed$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.15.elements$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @elements$arrow0(i32 %x, %struct.nish_array* %cap.0)
  ret i32 %0
}

define internal noundef i32 @via$fn.3.inc(i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = call i32 @inc(i32 %x)
  %1 = call i32 @apply$fn.19.via$fn.3.inc$arrow0(i32 %x, i32 %f)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @via$fn.3.inc$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.1(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @via$fn.3.dbl(i32 noundef %f, i32 noundef %x) #0 {
entry:
  %0 = call i32 @dbl(i32 %x)
  %1 = call i32 @apply$fn.19.via$fn.3.dbl$arrow0(i32 %x, i32 %f)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @via$fn.3.dbl$arrow0(i32 noundef %y, i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.2(i32 %f, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @apply$fn.19.via$fn.3.inc$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @via$fn.3.inc$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.19.via$fn.3.dbl$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @via$fn.3.dbl$arrow0(i32 %x, i32 %cap.0)
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

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @dbl(i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.2(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @inc(i32 %$a0)
  ret i32 %0
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

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
