%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

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

define internal noundef i32 @Box.run(%struct.Box* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %x) #0 {
entry:
  %op.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %op.addr, align 4
  %2 = load i32, i32* %op.addr, align 4
  %3 = call i32 @twice$fn.14.Box.run$arrow0(i32 %x, i32 %2)
  ret i32 %3
}

define void @nish_main() #0 {
entry:
  %c.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %b.addr = alloca %struct.Box*, align 8
  %ops.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %field.addr = alloca i32, align 4
  %first.addr = alloca i32, align 4
  %second.addr = alloca i32, align 4
  store i32 1, i32* %c.addr, align 4
  store i32 1, i32* %r.addr, align 4
  %0 = call i32 @apply$fn.5.plus1(i32 0)
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  store i32 2, i32* %r.addr, align 4
  br label %if.end

if.end:
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Box*
  call void @Box.constructor(%struct.Box* %3, i32 3)
  store %struct.Box* %3, %struct.Box** %b.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast [2 x i32]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 1, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 2, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ops.addr, align 8
  %11 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %12 = getelementptr inbounds %struct.Box, %struct.Box* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !4
  store i32 %13, i32* %field.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %ops.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  %19 = load i32, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %19, i32* %first.addr, align 4
  %20 = load %struct.nish_array*, %struct.nish_array** %ops.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 1
  %25 = load i32, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %25, i32* %second.addr, align 4
  %26 = load i32, i32* %c.addr, align 4
  %27 = call i32 @apply$fn.16.nish_main$arrow0(i32 3, i32 %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = load i32, i32* %r.addr, align 4
  %31 = call i32 @apply$fn.16.nish_main$arrow1(i32 3, i32 %30)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %29, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %35 = load i32, i32* %field.addr, align 4
  %36 = call i32 @apply$fn.16.nish_main$arrow2(i32 3, i32 %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %34, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = load i32, i32* %first.addr, align 4
  %41 = call i32 @apply$fn.16.nish_main$arrow3(i32 5, i32 %40)
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %39, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load i32, i32* %second.addr, align 4
  %46 = call i32 @apply$fn.16.nish_main$arrow4(i32 5, i32 %45)
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %44, i8* %47)
  call void @nish_print(i8* %48)
  %49 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %50 = call i32 @Box.run(%struct.Box* %49, i32 4)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %53 = load i32, i32* %second.addr, align 4
  %54 = call i32 @twice$fn.16.nish_main$arrow5(i32 1, i32 %53)
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %52, i8* %55)
  call void @nish_print(i8* %56)
  ret void
}

define internal noundef i32 @Box.run$arrow0(i32 noundef %$a0, i32 noundef %op) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %op, i32 %$a0)
  ret i32 %0
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

define internal noundef i32 @nish_main$arrow2(i32 noundef %$a0, i32 noundef %field) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %field, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow3(i32 noundef %$a0, i32 noundef %first) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.2(i32 %first, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow4(i32 noundef %$a0, i32 noundef %second) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.2(i32 %second, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow5(i32 noundef %$a0, i32 noundef %second) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.2(i32 %second, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @twice$fn.14.Box.run$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @Box.run$arrow0(i32 %x, i32 %cap.0)
  %1 = call i32 @Box.run$arrow0(i32 %0, i32 %cap.0)
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

define internal noundef i32 @apply$fn.16.nish_main$arrow2(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow2(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow3(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow3(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow4(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow4(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @twice$fn.16.nish_main$arrow5(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow5(i32 %x, i32 %cap.0)
  %1 = call i32 @nish_main$arrow5(i32 %0, i32 %cap.0)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
