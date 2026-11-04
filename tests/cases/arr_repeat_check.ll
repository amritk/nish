%struct.Perm = type { { i64, i8* } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
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

define internal void @Perm.constructor(%struct.Perm* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = mul i64 %0, 4
  %3 = call i8* @nish_alloc_struct(i64 %2)
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %5 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 0
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 1
  store i8* %3, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret void
}

define internal void @Perm.swap(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %j) #1 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %3 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 %1
  %6 = load i32, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %6, i32* %tmp.addr, align 4
  %7 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %8 = sext i32 %i to i64
  %9 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %10 = sext i32 %j to i64
  %11 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %9, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %7, i32 0, i32 1
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %8
  store i32 %15, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %21 = sext i32 %j to i64
  %22 = load i32, i32* %tmp.addr, align 4
  %23 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %20, i32 0, i32 1
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %21
  store i32 %22, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define internal noundef i32 @Perm.double(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %3 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 %1
  %6 = load i32, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %8 = sext i32 %i to i64
  %9 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %7, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %8
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %18 = sext i32 %i to i64
  %19 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %17, i32 0, i32 1
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %p.addr = alloca %struct.Perm*, align 8
  %Perm.obj = alloca %struct.Perm, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %Perm.obj, i32 0, i32 0
  %1 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %0, i32 0, i32 1
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @Perm.constructor(%struct.Perm* %Perm.obj, i32 4)
  store %struct.Perm* %Perm.obj, %struct.Perm** %p.addr, align 8
  %3 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %4 = getelementptr inbounds %struct.Perm, %struct.Perm* %3, i32 0, i32 0
  %5 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %4, i32 0, i32 1
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 1, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %13 = getelementptr inbounds %struct.Perm, %struct.Perm* %12, i32 0, i32 0
  %14 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %13, i32 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 3, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %13, i32 0, i32 1
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 3
  store i32 20, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  call void @Perm.swap(%struct.Perm* %21, i32 0, i32 3)
  %22 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %23 = call i32 @Perm.double(%struct.Perm* %22, i32 3)
  %24 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %25 = getelementptr inbounds %struct.Perm, %struct.Perm* %24, i32 0, i32 0
  %26 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %25, i32 0, i32 1
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %32

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array slice", !7, i64 0, !8, i64 8}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 8}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}
