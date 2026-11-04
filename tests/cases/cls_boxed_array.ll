%struct.Window = type { { i64, i8* }, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal void @Window.constructor(%struct.Window* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = sext i32 %n to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %3 = mul i64 %1, 4
  %4 = call i8* @nish_alloc_struct(i64 %3)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 %3, i1 false), !alias.scope !9, !noalias !8
  %5 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 0
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 0
  store i64 %1, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 1
  store i8* %4, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  ret void
}

define internal void @Window.reset(%struct.Window* noundef nonnull align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to i32*
  %2 = getelementptr inbounds i32, i32* %1, i64 0
  store i32 1, i32* %2, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %3 = getelementptr inbounds i32, i32* %1, i64 1
  store i32 3, i32* %3, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %4 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 0
  %5 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 0
  store i64 2, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 1
  store i8* %0, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  ret void
}

define internal void @Window.resize(%struct.Window* noundef nonnull align 8 dereferenceable(24) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = call %struct.nish_array* @ramp(i32 %n)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %5 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 0
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 0
  store i64 %2, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 1
  store i8* %4, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  ret void
}

define internal noundef i32 @Window.sum(%struct.Window* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Window, %struct.Window* %this, i32 0, i32 0
  %1 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = trunc i64 %2 to i32
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %s.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %4 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %s.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @ramp(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !20
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !9, !noalias !8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  store %struct.nish_array* %3, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = bitcast i8* %13 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %18
  store i32 %19, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %24
}

define noundef i32 @nish_main() #0 {
entry:
  %w.addr = alloca %struct.Window*, align 8
  %Window.obj = alloca %struct.Window, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Window, %struct.Window* %Window.obj, i32 0, i32 0
  %1 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  call void @Window.constructor(%struct.Window* %Window.obj, i32 3)
  store %struct.Window* %Window.obj, %struct.Window** %w.addr, align 8
  %3 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %4 = getelementptr inbounds %struct.Window, %struct.Window* %3, i32 0, i32 0
  %5 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = icmp ult i64 2, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 1
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 4, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %12 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %13 = getelementptr inbounds %struct.Window, %struct.Window* %12, i32 0, i32 0
  %14 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %13, i32 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = trunc i64 %15 to i32
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %20 = call i32 @Window.sum(%struct.Window* %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  call void @nish_print(i8* %22)
  %23 = load %struct.Window*, %struct.Window** %w.addr, align 8
  call void @Window.reset(%struct.Window* %23)
  %24 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %25 = getelementptr inbounds %struct.Window, %struct.Window* %24, i32 0, i32 0
  %26 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %25, i32 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = trunc i64 %27 to i32
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %31 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %32 = call i32 @Window.sum(%struct.Window* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %30, i8* %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.Window*, %struct.Window** %w.addr, align 8
  call void @Window.resize(%struct.Window* %35, i32 5)
  %36 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %37 = getelementptr inbounds %struct.Window, %struct.Window* %36, i32 0, i32 0
  %38 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %37, i32 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = icmp ult i64 0, %39
  br i1 %40, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %39)
  unreachable

bounds.ok.1:
  %41 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %37, i32 0, i32 1
  %42 = load i8*, i8** %41, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 0
  %45 = load i32, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %45, i32 10)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %47, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %49 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %50 = getelementptr inbounds %struct.Window, %struct.Window* %49, i32 0, i32 0
  %51 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %50, i32 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = trunc i64 %52 to i32
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %56 = load %struct.Window*, %struct.Window** %w.addr, align 8
  %57 = call i32 @Window.sum(%struct.Window* %56)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  %59 = call i8* @nish_str_concat(i8* %55, i8* %58)
  call void @nish_print(i8* %59)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Window", !2, i64 16}
!4 = !{!3, !2, i64 16}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array slice", !10, i64 0, !11, i64 8}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 8}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!18 = !{!17, !10, i64 0}
!19 = !{!17, !11, i64 16}
!20 = !{!17, !10, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
