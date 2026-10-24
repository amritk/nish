%struct.Inner = type { { %struct.nish_array, [6 x i32] } }
%struct.Outer = type { %struct.Inner* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
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

define internal void @Inner.constructor(%struct.Inner* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Inner, %struct.Inner* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  ret void
}

define internal void @Outer.constructor(%struct.Outer* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Inner*
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 6, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @Inner.constructor(%struct.Inner* %1)
  %8 = getelementptr inbounds %struct.Outer, %struct.Outer* %this, i32 0, i32 0
  store %struct.Inner* %1, %struct.Inner** %8, align 8, !tbaa !15
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @refill(%struct.Outer* noundef nonnull align 8 dereferenceable(8) nocapture %o) #0 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Inner*
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 6, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @Inner.constructor(%struct.Inner* %1)
  %8 = getelementptr inbounds %struct.Outer, %struct.Outer* %o, i32 0, i32 0
  store %struct.Inner* %1, %struct.Inner** %8, align 8, !tbaa !15
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 6, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 6, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = mul i64 6, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %10, %struct.nish_array** %arr.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %16
}

define noundef i32 @nish_main() #1 {
entry:
  %o.addr = alloca %struct.Outer*, align 8
  %Outer.obj = alloca %struct.Outer, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Outer.constructor(%struct.Outer* %Outer.obj)
  store %struct.Outer* %Outer.obj, %struct.Outer** %o.addr, align 8
  %0 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %1 = getelementptr inbounds %struct.Outer, %struct.Outer* %0, i32 0, i32 0
  %2 = load %struct.Inner*, %struct.Inner** %1, align 8, !tbaa !15
  %3 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %4 = call %struct.nish_array* @refill(%struct.Outer* %3)
  %5 = getelementptr inbounds %struct.Inner, %struct.Inner* %2, i32 0, i32 0, i32 0
  %6 = getelementptr inbounds %struct.Inner, %struct.Inner* %2, i32 0, i32 0, i32 1, i64 0
  %7 = bitcast i32* %6 to i8*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %7, i8* align 8 %9, i64 24, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 6, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = load %struct.Outer*, %struct.Outer** %o.addr, align 8
  %12 = getelementptr inbounds %struct.Outer, %struct.Outer* %11, i32 0, i32 0
  %13 = load %struct.Inner*, %struct.Inner** %12, align 8, !tbaa !15
  %14 = getelementptr inbounds %struct.Inner, %struct.Inner* %13, i32 0, i32 0, i32 0
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 5, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.Inner, %struct.Inner* %13, i32 0, i32 0, i32 1, i64 0
  %19 = bitcast i32* %18 to i8*
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 5
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
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
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Outer", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
