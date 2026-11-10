%struct.Level = type { i32, i8*, %struct.Level* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"top\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"/\00" }, align 8
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
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @Level.constructor(%struct.Level* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %depth, i8* noundef nonnull noalias readonly align 8 %name, %struct.Level* noundef align 8 %up) #0 {
entry:
  %0 = getelementptr inbounds %struct.Level, %struct.Level* %this, i32 0, i32 0
  store i32 %depth, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Level, %struct.Level* %this, i32 0, i32 1
  store i8* %name, i8** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Level, %struct.Level* %this, i32 0, i32 2
  store %struct.Level* %up, %struct.Level** %2, align 8, !tbaa !7
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.Level* @top$() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Level*
  call void @Level.constructor(%struct.Level* %1, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), %struct.Level* null)
  ret %struct.Level* %1
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.Level* @below$(%struct.Level* noundef nonnull align 8 dereferenceable(24) %up) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Level*
  %2 = getelementptr inbounds %struct.Level, %struct.Level* %up, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = getelementptr inbounds %struct.Level, %struct.Level* %up, i32 0, i32 1
  %8 = load i8*, i8** %7, align 8, !tbaa !6
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %10 = getelementptr inbounds %struct.Level, %struct.Level* %up, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !5
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 1)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %15 = call i8* @nish_str_from_i32(i32 %13)
  %16 = call i8* @nish_str_concat(i8* %9, i8* %15)
  call void @Level.constructor(%struct.Level* %1, i32 %5, i8* %16, %struct.Level* %up)
  ret %struct.Level* %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i64 @descend$(%struct.Level* noundef nonnull align 8 dereferenceable(24) %up) #1 {
entry:
  %0 = call i64 @nish.childWith$$Level$$Level$fn.5.below(%struct.Level* %up)
  ret i64 %0
}

define hidden noundef i32 @walk$(%struct.Level* noundef nonnull align 8 dereferenceable(24) %at) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %level.addr = alloca %struct.Level*, align 8
  store i32 0, i32* %sum.addr, align 4
  store %struct.Level* %at, %struct.Level** %level.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Level*, %struct.Level** %level.addr, align 8
  %1 = icmp ne %struct.Level* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load %struct.Level*, %struct.Level** %level.addr, align 8
  %3 = getelementptr inbounds %struct.Level, %struct.Level* %2, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8, !tbaa !6
  call void @nish_print(i8* %4)
  %5 = load i32, i32* %sum.addr, align 4
  %6 = load %struct.Level*, %struct.Level** %level.addr, align 8
  %7 = getelementptr inbounds %struct.Level, %struct.Level* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !5
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %sum.addr, align 4
  %12 = load %struct.Level*, %struct.Level** %level.addr, align 8
  %13 = getelementptr inbounds %struct.Level, %struct.Level* %12, i32 0, i32 2
  %14 = load %struct.Level*, %struct.Level** %13, align 8, !tbaa !7
  store %struct.Level* %14, %struct.Level** %level.addr, align 8
  br label %while.cond

while.end:
  %15 = load i32, i32* %sum.addr, align 4
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %root.addr = alloca i64, align 8
  %middle.addr = alloca i64, align 8
  %leaf.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish.region$$Level$fn.3.top()
  store i64 %0, i64* %root.addr, align 8
  %1 = load i64, i64* %root.addr, align 8
  %2 = call i64 @nish.enter$$Level$rgn.$Level$fn.7.descend(i64 %1)
  store i64 %2, i64* %middle.addr, align 8
  %3 = load i64, i64* %middle.addr, align 8
  %4 = call i64 @nish.enter$$Level$rgn.$Level$fn.7.descend(i64 %3)
  store i64 %4, i64* %leaf.addr, align 8
  %5 = load i64, i64* %leaf.addr, align 8
  %6 = call i32 @nish.enter$$Level$i32$fn.4.walk(i64 %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load i64, i64* %root.addr, align 8
  call void @nish.free$$Level(i64 %8)
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

define internal noundef i64 @nish.childWith$$Level$$Level$fn.5.below(%struct.Level* noundef nonnull align 8 dereferenceable(24) %arg) #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.childNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Level* @below$(%struct.Level* %arg)
  %4 = call i64 @nish.close$$Level(i64 %2, %struct.Level* %3)
  ret i64 %4
}

define internal noundef i64 @nish.region$$Level$fn.3.top() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Level* @top$()
  %4 = call i64 @nish.close$$Level(i64 %2, %struct.Level* %3)
  ret i64 %4
}

define internal noundef i64 @nish.enter$$Level$rgn.$Level$fn.7.descend(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Level*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Level* @nish.reopen$$Level(i64 %r)
  store %struct.Level* %0, %struct.Level** %root.addr, align 8
  %1 = load %struct.Level*, %struct.Level** %root.addr, align 8
  %2 = call i64 @descend$(%struct.Level* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Level*, %struct.Level** %root.addr, align 8
  call void @nish.leave$$Level(i64 %r, %struct.Level* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Level$i32$fn.4.walk(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Level*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Level* @nish.reopen$$Level(i64 %r)
  store %struct.Level* %0, %struct.Level** %root.addr, align 8
  %1 = load %struct.Level*, %struct.Level** %root.addr, align 8
  %2 = call i32 @walk$(%struct.Level* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Level*, %struct.Level** %root.addr, align 8
  call void @nish.leave$$Level(i64 %r, %struct.Level* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Level(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Level(i64 noundef %h, %struct.Level* noundef nonnull align 8 dereferenceable(24) %root) #1 {
entry:
  %0 = bitcast %struct.Level* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.Level* @nish.reopen$$Level(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Level*
  ret %struct.Level* %1
}

define internal void @nish.leave$$Level(i64 noundef %r, %struct.Level* noundef nonnull align 8 dereferenceable(24) %root) #1 {
entry:
  %0 = bitcast %struct.Level* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Level", !2, i64 0, !3, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!4, !3, i64 16}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}
