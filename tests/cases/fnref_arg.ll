%struct.Box = type { i32 }
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
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @plus1(i32 noundef %x) #0 {
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

define internal noundef i32 @neg(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %op) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %op, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Box.run(%struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = call i32 @twice$fn.14.Box.run$arrow0(i32 %x, %struct.Box* %this)
  ret i32 %0
}

define void @nish_main() #0 {
entry:
  %c.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %ops.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 1, i32* %c.addr, align 4
  store i32 1, i32* %r.addr, align 4
  %0 = call i32 @apply$fn.5.plus1(i32 0)
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  store i32 2, i32* %r.addr, align 4
  br label %if.end

if.end:
  call void @Box.constructor(%struct.Box* %Box.obj, i32 3)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = bitcast [2 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ops.addr, align 8
  %9 = load i32, i32* %c.addr, align 4
  %10 = call i32 @apply$fn.16.nish_main$arrow0(i32 3, i32 %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load i32, i32* %r.addr, align 4
  %14 = call i32 @apply$fn.16.nish_main$arrow1(i32 3, i32 %13)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %12, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %19 = call i32 @apply$fn.16.nish_main$arrow2(i32 3, %struct.Box* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = load %struct.nish_array*, %struct.nish_array** %ops.addr, align 8
  %24 = call i32 @apply$fn.16.nish_main$arrow3(i32 5, %struct.nish_array* %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load %struct.nish_array*, %struct.nish_array** %ops.addr, align 8
  %29 = call i32 @apply$fn.16.nish_main$arrow4(i32 5, %struct.nish_array* %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  call void @nish_print(i8* %31)
  %32 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %33 = call i32 @Box.run(%struct.Box* %32, i32 4)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = load %struct.nish_array*, %struct.nish_array** %ops.addr, align 8
  %37 = call i32 @twice$fn.16.nish_main$arrow5(i32 1, %struct.nish_array* %36)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %35, i8* %38)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @Box.run$arrow0(i32 noundef %$a0, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call i32 @$ref.0.fr1.i32.i32.0(i32 %1, i32 %$a0)
  ret i32 %2
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %$a0, i32 noundef %c) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.1(i32 %c, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow1(i32 noundef %$a0, i32 noundef %r) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.2(i32 %r, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow2(i32 noundef %$a0, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call i32 @$ref.0.fr1.i32.i32.0(i32 %1, i32 %$a0)
  ret i32 %2
}

define internal noundef i32 @nish_main$arrow3(i32 noundef %$a0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ops) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = call i32 @$ref.0.fr1.i32.i32.2(i32 %7, i32 %$a0)
  ret i32 %8
}

define internal noundef i32 @nish_main$arrow4(i32 noundef %$a0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ops) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp ult i64 1, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 1
  %7 = load i32, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = call i32 @$ref.0.fr1.i32.i32.2(i32 %7, i32 %$a0)
  ret i32 %8
}

define internal noundef i32 @nish_main$arrow5(i32 noundef %$a0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ops) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp ult i64 1, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ops, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 1
  %7 = load i32, i32* %6, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = call i32 @$ref.0.fr1.i32.i32.2(i32 %7, i32 %$a0)
  ret i32 %8
}

define internal noundef i32 @twice$fn.14.Box.run$arrow0(i32 noundef %x, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @Box.run$arrow0(i32 %x, %struct.Box* %cap.0)
  %1 = call i32 @Box.run$arrow0(i32 %0, %struct.Box* %cap.0)
  ret i32 %1
}

define internal noundef i32 @apply$fn.5.plus1(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @plus1(i32 %x)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow1(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow1(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow2(i32 noundef %x, %struct.Box* noundef nonnull readonly align 8 dereferenceable(4) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow2(i32 %x, %struct.Box* %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow3(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow3(i32 %x, %struct.nish_array* %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow4(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow4(i32 %x, %struct.nish_array* %cap.0)
  ret i32 %0
}

define internal noundef i32 @twice$fn.16.nish_main$arrow5(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow5(i32 %x, %struct.nish_array* %cap.0)
  %1 = call i32 @nish_main$arrow5(i32 %0, %struct.nish_array* %cap.0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @neg(i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @square(i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.2(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @square(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @plus1(i32 %$a0)
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

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
