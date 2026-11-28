%struct.Pair = type { i8*, i8* }
%struct.Stack = type { %struct.Pair*, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare i8* @slot_open()
declare i32 @slot_close(i8*)
declare i32 @slot_read(i8*)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2

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

define internal void @Pair.constructor(%struct.Pair* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @slot_open()
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 0
  store i8* %0, i8** %1, align 8, !tbaa !4
  %2 = call i8* @slot_open()
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 1
  store i8* %2, i8** %3, align 8, !tbaa !5
  ret void
}

define internal noundef i32 @Pair.read(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8, !tbaa !5
  %2 = call i32 @slot_read(i8* %1)
  ret i32 %2
}

define internal void @Stack.constructor(%struct.Stack* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Pair* noundef nonnull align 8 dereferenceable(16) %pair) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stack, %struct.Stack* %this, i32 0, i32 0
  store %struct.Pair* %pair, %struct.Pair** %0, align 8, !tbaa !7
  %1 = call i8* @slot_open()
  %2 = getelementptr inbounds %struct.Stack, %struct.Stack* %this, i32 0, i32 1
  store i8* %1, i8** %2, align 8, !tbaa !8
  ret void
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Pair* @openPair() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Pair*
  call void @Pair.constructor(%struct.Pair* %1)
  ret %struct.Pair* %1
}

define internal noundef i32 @both(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #0 {
entry:
  %0 = call i32 @Pair.read(%struct.Pair* %p)
  ret i32 %0
}

define noundef i32 @pair() #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Pair* @openPair()
  store %struct.Pair* %0, %struct.Pair** %p.addr, align 8
  %1 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %2 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %3 = call i32 @both(%struct.Pair* %2)
  %4 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  %5 = load i8*, i8** %4, align 8, !tbaa !5
  %6 = call i32 @slot_close(i8* %5)
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  %8 = load i8*, i8** %7, align 8, !tbaa !4
  %9 = call i32 @slot_close(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3
}

define noundef i32 @stack(i32 noundef %early) #0 {
entry:
  %s.addr = alloca %struct.Stack*, align 8
  %Stack.obj = alloca %struct.Stack, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Pair*
  call void @Pair.constructor(%struct.Pair* %1)
  call void @Stack.constructor(%struct.Stack* %Stack.obj, %struct.Pair* %1)
  store %struct.Stack* %Stack.obj, %struct.Stack** %s.addr, align 8
  %2 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %3 = icmp sgt i32 %early, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Stack, %struct.Stack* %2, i32 0, i32 1
  %5 = load i8*, i8** %4, align 8, !tbaa !8
  %6 = call i32 @slot_close(i8* %5)
  %7 = getelementptr inbounds %struct.Stack, %struct.Stack* %2, i32 0, i32 0
  %8 = load %struct.Pair*, %struct.Pair** %7, align 8, !tbaa !7
  %9 = getelementptr inbounds %struct.Pair, %struct.Pair* %8, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8, !tbaa !5
  %11 = call i32 @slot_close(i8* %10)
  %12 = getelementptr inbounds %struct.Pair, %struct.Pair* %8, i32 0, i32 0
  %13 = load i8*, i8** %12, align 8, !tbaa !4
  %14 = call i32 @slot_close(i8* %13)
  ret i32 -1

if.end:
  %15 = load %struct.Stack*, %struct.Stack** %s.addr, align 8
  %16 = getelementptr inbounds %struct.Stack, %struct.Stack* %15, i32 0, i32 0
  %17 = load %struct.Pair*, %struct.Pair** %16, align 8, !tbaa !7
  %18 = call i32 @Pair.read(%struct.Pair* %17)
  %19 = getelementptr inbounds %struct.Stack, %struct.Stack* %2, i32 0, i32 1
  %20 = load i8*, i8** %19, align 8, !tbaa !8
  %21 = call i32 @slot_close(i8* %20)
  %22 = getelementptr inbounds %struct.Stack, %struct.Stack* %2, i32 0, i32 0
  %23 = load %struct.Pair*, %struct.Pair** %22, align 8, !tbaa !7
  %24 = getelementptr inbounds %struct.Pair, %struct.Pair* %23, i32 0, i32 1
  %25 = load i8*, i8** %24, align 8, !tbaa !5
  %26 = call i32 @slot_close(i8* %25)
  %27 = getelementptr inbounds %struct.Pair, %struct.Pair* %23, i32 0, i32 0
  %28 = load i8*, i8** %27, align 8, !tbaa !4
  %29 = call i32 @slot_close(i8* %28)
  ret i32 %18
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!9, !10, !11, !12, !13}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Pair", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!"Stack", !2, i64 0, !2, i64 8}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 8}
!9 = !{i32 8, !"cf-protection-branch", i32 1}
!10 = !{i32 8, !"cf-protection-return", i32 1}
!11 = !{i32 8, !"branch-target-enforcement", i32 1}
!12 = !{i32 8, !"sign-return-address", i32 1}
!13 = !{i32 4, !"probe-stack", !"inline-asm"}
