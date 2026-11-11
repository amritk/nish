%struct.Item = type { i8* }
%struct.Box = type { %struct.Item*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"root\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"kid\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"item\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_region_new() #0
declare noundef i64 @nish_region_child_new() #0
declare i8* @nish_region_enter(i64 noundef) #0
declare void @nish_region_leave(i64 noundef, i8*) #0
declare void @nish_region_free(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Item* noundef nonnull align 8 dereferenceable(8) %first) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.Item* %first, %struct.Item** %0, align 8, !tbaa !6
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %7 = bitcast i8* %5 to %struct.Item**
  %8 = getelementptr inbounds %struct.Item*, %struct.Item** %7, i64 0
  store %struct.Item* %first, %struct.Item** %8, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  %9 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %9, align 8, !tbaa !20
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(16) %struct.Box* @make$() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Box*
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Item*
  call void @Item.constructor(%struct.Item* %3, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  call void @Box.constructor(%struct.Box* %1, %struct.Item* %3)
  ret %struct.Box* %1
}

define hidden noundef nonnull align 8 dereferenceable(16) %struct.Box* @makeKid$() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Box*
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Item*
  call void @Item.constructor(%struct.Item* %3, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  call void @Box.constructor(%struct.Box* %1, %struct.Item* %3)
  ret %struct.Box* %1
}

define hidden noundef i64 @spawnChild$(%struct.Box* noundef nonnull readonly align 8 dereferenceable(16) nocapture %root) #1 {
entry:
  %0 = call i64 @nish.child$$Box$fn.7.makeKid()
  ret i64 %0
}

define hidden noundef i32 @grow$(%struct.Box* noundef nonnull align 8 dereferenceable(16) nocapture %root) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Item*
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !20
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = trunc i64 %7 to i32
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %9)
  call void @Item.constructor(%struct.Item* %3, i8* %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %18 = bitcast i8* %17 to %struct.Item**
  %19 = getelementptr inbounds %struct.Item*, %struct.Item** %18, i64 %12
  store %struct.Item* %3, %struct.Item** %19, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %21 = trunc i64 %20 to i32
  %22 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !20
  %24 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !20
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = trunc i64 %27 to i32
  %29 = sub nsw i32 %28, 1
  %30 = sext i32 %29 to i64
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %33 = icmp ult i64 %30, %32
  br i1 %33, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %30, i64 %32)
  unreachable

bounds.ok:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %36 = bitcast i8* %35 to %struct.Item**
  %37 = getelementptr inbounds %struct.Item*, %struct.Item** %36, i64 %30
  %38 = load %struct.Item*, %struct.Item** %37, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  %39 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 0
  store %struct.Item* %38, %struct.Item** %39, align 8, !tbaa !6
  %40 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !tbaa !20
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %44 = trunc i64 %43 to i32
  ret i32 %44
}

define hidden noundef i32 @show$(%struct.Box* noundef nonnull readonly align 8 dereferenceable(16) nocapture %root) #0 {
entry:
  %item.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %8 = bitcast i8* %7 to %struct.Item**
  %9 = getelementptr inbounds %struct.Item*, %struct.Item** %8, i64 %2
  %10 = load %struct.Item*, %struct.Item** %9, align 8, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.Item* %10, %struct.Item** %item.addr, align 8
  %11 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %12 = getelementptr inbounds %struct.Item, %struct.Item* %11, i32 0, i32 0
  %13 = load i8*, i8** %12, align 8, !tbaa !4
  call void @nish_print(i8* %13)
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 0
  %17 = load %struct.Item*, %struct.Item** %16, align 8, !tbaa !6
  %18 = getelementptr inbounds %struct.Item, %struct.Item* %17, i32 0, i32 0
  %19 = load i8*, i8** %18, align 8, !tbaa !4
  call void @nish_print(i8* %19)
  %20 = getelementptr inbounds %struct.Box, %struct.Box* %root, i32 0, i32 1
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !20
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define noundef i32 @nish_main() #1 {
entry:
  %p.addr = alloca i64, align 8
  %kid.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish.region$$Box$fn.4.make()
  store i64 %0, i64* %p.addr, align 8
  %1 = load i64, i64* %p.addr, align 8
  %2 = call i64 @nish.enter$$Box$rgn.$Box$fn.10.spawnChild(i64 %1)
  store i64 %2, i64* %kid.addr, align 8
  %3 = load i64, i64* %p.addr, align 8
  %4 = call i32 @nish.enter$$Box$i32$fn.4.grow(i64 %3)
  %5 = load i64, i64* %p.addr, align 8
  %6 = call i32 @nish.enter$$Box$i32$fn.4.grow(i64 %5)
  %7 = load i64, i64* %p.addr, align 8
  %8 = call i32 @nish.enter$$Box$i32$fn.4.show(i64 %7)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = load i64, i64* %kid.addr, align 8
  %11 = call i32 @nish.enter$$Box$i32$fn.4.show(i64 %10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load i64, i64* %p.addr, align 8
  call void @nish.free$$Box(i64 %13)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #1 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #1 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i64 @nish.childNew() #1 {
entry:
  %0 = call i64 @nish_region_child_new()
  ret i64 %0
}

define internal noundef i64 @nish.child$$Box$fn.7.makeKid() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.childNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Box* @makeKid$()
  %4 = call i64 @nish.close$$Box(i64 %2, %struct.Box* %3)
  ret i64 %4
}

define internal noundef i64 @nish.region$$Box$fn.4.make() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Box* @make$()
  %4 = call i64 @nish.close$$Box(i64 %2, %struct.Box* %3)
  ret i64 %4
}

define internal noundef i64 @nish.enter$$Box$rgn.$Box$fn.10.spawnChild(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Box*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Box* @nish.reopen$$Box(i64 %r)
  store %struct.Box* %0, %struct.Box** %root.addr, align 8
  %1 = load %struct.Box*, %struct.Box** %root.addr, align 8
  %2 = call i64 @spawnChild$(%struct.Box* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Box*, %struct.Box** %root.addr, align 8
  call void @nish.leave$$Box(i64 %r, %struct.Box* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Box$i32$fn.4.grow(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Box*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Box* @nish.reopen$$Box(i64 %r)
  store %struct.Box* %0, %struct.Box** %root.addr, align 8
  %1 = load %struct.Box*, %struct.Box** %root.addr, align 8
  %2 = call i32 @grow$(%struct.Box* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Box*, %struct.Box** %root.addr, align 8
  call void @nish.leave$$Box(i64 %r, %struct.Box* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal noundef i32 @nish.enter$$Box$i32$fn.4.show(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Box*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Box* @nish.reopen$$Box(i64 %r)
  store %struct.Box* %0, %struct.Box** %root.addr, align 8
  %1 = load %struct.Box*, %struct.Box** %root.addr, align 8
  %2 = call i32 @show$(%struct.Box* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Box*, %struct.Box** %root.addr, align 8
  call void @nish.leave$$Box(i64 %r, %struct.Box* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Box(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Box(i64 noundef %h, %struct.Box* noundef nonnull align 8 dereferenceable(16) %root) #1 {
entry:
  %0 = bitcast %struct.Box* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Box* @nish.reopen$$Box(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Box*
  ret %struct.Box* %1
}

define internal void @nish.leave$$Box(i64 noundef %r, %struct.Box* noundef nonnull align 8 dereferenceable(16) %root) #1 {
entry:
  %0 = bitcast %struct.Box* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Item", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Box", !2, i64 0, !2, i64 8}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!5, !2, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
