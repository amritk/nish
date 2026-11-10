%struct.Item = type { i8* }
%struct.Holder = type { %struct.Item*, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"root\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"-item\00" }, align 8
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

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Item* noundef nonnull align 8 dereferenceable(8) %item) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Item* %item, %struct.Item** %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Item, %struct.Item* %item, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store i8* %2, i8** %3, align 8, !tbaa !7
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(8) %struct.Item* @build$() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Item*
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  call void @Item.constructor(%struct.Item* %1, i8* %2)
  ret %struct.Item* %1
}

define hidden noundef nonnull align 8 dereferenceable(16) %struct.Holder* @hold$(%struct.Item* noundef nonnull align 8 dereferenceable(8) %item) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %1, %struct.Item* %item)
  ret %struct.Holder* %1
}

define hidden noundef i64 @keep$(%struct.Item* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = call i64 @nish.childWith$$Item$$Holder$fn.4.hold(%struct.Item* %root)
  ret i64 %0
}

define hidden noundef i32 @read$(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8, !tbaa !7
  call void @nish_print(i8* %1)
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %3 = load %struct.Item*, %struct.Item** %2, align 8, !tbaa !6
  %4 = getelementptr inbounds %struct.Item, %struct.Item* %3, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !4
  call void @nish_print(i8* %5)
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %7 = load i8*, i8** %6, align 8, !tbaa !7
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define noundef i32 @nish_main() #1 {
entry:
  %parent.addr = alloca i64, align 8
  %kept.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish.region$$Item$fn.5.build()
  store i64 %0, i64* %parent.addr, align 8
  %1 = load i64, i64* %parent.addr, align 8
  %2 = call i64 @nish.enter$$Item$rgn.$Holder$fn.4.keep(i64 %1)
  store i64 %2, i64* %kept.addr, align 8
  %3 = load i64, i64* %kept.addr, align 8
  %4 = call i32 @nish.enter$$Holder$i32$fn.4.read(i64 %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i64, i64* %parent.addr, align 8
  call void @nish.free$$Item(i64 %6)
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

define internal noundef i64 @nish.childWith$$Item$$Holder$fn.4.hold(%struct.Item* noundef nonnull align 8 dereferenceable(8) %arg) #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.childNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Holder* @hold$(%struct.Item* %arg)
  %4 = call i64 @nish.close$$Holder(i64 %2, %struct.Holder* %3)
  ret i64 %4
}

define internal noundef i64 @nish.region$$Item$fn.5.build() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Item* @build$()
  %4 = call i64 @nish.close$$Item(i64 %2, %struct.Item* %3)
  ret i64 %4
}

define internal noundef i64 @nish.enter$$Item$rgn.$Holder$fn.4.keep(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Item*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Item* @nish.reopen$$Item(i64 %r)
  store %struct.Item* %0, %struct.Item** %root.addr, align 8
  %1 = load %struct.Item*, %struct.Item** %root.addr, align 8
  %2 = call i64 @keep$(%struct.Item* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Item*, %struct.Item** %root.addr, align 8
  call void @nish.leave$$Item(i64 %r, %struct.Item* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Holder$i32$fn.4.read(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Holder*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Holder* @nish.reopen$$Holder(i64 %r)
  store %struct.Holder* %0, %struct.Holder** %root.addr, align 8
  %1 = load %struct.Holder*, %struct.Holder** %root.addr, align 8
  %2 = call i32 @read$(%struct.Holder* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Holder*, %struct.Holder** %root.addr, align 8
  call void @nish.leave$$Holder(i64 %r, %struct.Holder* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Item(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Holder(i64 noundef %h, %struct.Holder* noundef nonnull align 8 dereferenceable(16) %root) #1 {
entry:
  %0 = bitcast %struct.Holder* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef i64 @nish.close$$Item(i64 noundef %h, %struct.Item* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Item* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Item* @nish.reopen$$Item(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Item*
  ret %struct.Item* %1
}

define internal void @nish.leave$$Item(i64 noundef %r, %struct.Item* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Item* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Holder* @nish.reopen$$Holder(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Holder*
  ret %struct.Holder* %1
}

define internal void @nish.leave$$Holder(i64 noundef %r, %struct.Holder* noundef nonnull align 8 dereferenceable(16) %root) #1 {
entry:
  %0 = bitcast %struct.Holder* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Item", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Holder", !2, i64 0, !2, i64 8}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !2, i64 8}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}
