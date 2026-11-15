%struct.Dot = type { i32, i32 }
%struct.Box = type { i32, i32, i32 }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"dot\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"box\00" }, align 8
@.enumstr.Kind = private unnamed_addr constant [2 x i8*] [i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*)], align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
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

define internal void @Dot.constructor(%struct.Dot* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dot, %struct.Dot* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Dot, %struct.Dot* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !5
  %2 = getelementptr inbounds %struct.Dot, %struct.Dot* %this, i32 0, i32 1
  store i32 %r, i32* %2, align 4, !tbaa !5
  ret void
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this, i32 noundef %w, i32 noundef %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !8
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !9
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 1
  store i32 %w, i32* %3, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 2
  store i32 %h, i32* %4, align 4, !tbaa !9
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Dot*
  %3 = getelementptr inbounds %struct.Dot, %struct.Dot* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast %union.tagged* %s to %struct.Dot*
  %9 = getelementptr inbounds %struct.Dot, %struct.Dot* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Box*
  %15 = getelementptr inbounds %struct.Box, %struct.Box* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = bitcast %union.tagged* %s to %struct.Box*
  %18 = getelementptr inbounds %struct.Box, %struct.Box* %17, i32 0, i32 2
  %19 = load i32, i32* %18, align 4, !tbaa !9
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %21

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %union.tagged*], align 8
  %total.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Dot*
  call void @Dot.constructor(%struct.Dot* %1, i32 2)
  %2 = bitcast %struct.Dot* %1 to %union.tagged*
  %3 = call i8* @nish_alloc_struct(i64 12)
  %4 = bitcast i8* %3 to %struct.Box*
  call void @Box.constructor(%struct.Box* %4, i32 3, i32 4)
  %5 = bitcast %struct.Box* %4 to %union.tagged*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %8 = bitcast [2 x %union.tagged*]* %arr.data to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %10 = bitcast i8* %8 to %union.tagged**
  %11 = getelementptr inbounds %union.tagged*, %union.tagged** %10, i64 0
  store %union.tagged* %2, %union.tagged** %11, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %12 = getelementptr inbounds %union.tagged*, %union.tagged** %10, i64 1
  store %union.tagged* %5, %union.tagged** %12, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %13 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %forof.body, label %forof.end

forof.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %20 = bitcast i8* %19 to %union.tagged**
  %21 = getelementptr inbounds %union.tagged*, %union.tagged** %20, i64 %14
  %22 = load %union.tagged*, %union.tagged** %21, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  store %union.tagged* %22, %union.tagged** %s.addr, align 8
  %23 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %24 = getelementptr inbounds %union.tagged, %union.tagged* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds [2 x i8*], [2 x i8*]* @.enumstr.Kind, i64 0, i64 %26
  %28 = load i8*, i8** %27, align 8
  call void @nish_print(i8* %28)
  %29 = load i32, i32* %total.addr, align 4
  %30 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %31 = call i32 @area(%union.tagged* %30)
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %33, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %37 = load i32, i32* %total.addr, align 4
  ret i32 %37

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!23, !24, !25, !26, !27}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Dot", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Box", !2, i64 0, !2, i64 4, !2, i64 8}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!6, !2, i64 8}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
