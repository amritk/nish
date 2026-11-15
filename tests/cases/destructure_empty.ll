%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @make(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %calls) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %calls, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %2, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = trunc i64 %15 to i32
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %19 = trunc i64 %18 to i32
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 2, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 2, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = call i8* @nish_alloc_struct(i64 8)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 %16, i32* %27, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %28 = getelementptr inbounds i32, i32* %26, i64 1
  store i32 %19, i32* %28, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  ret %struct.nish_array* %21
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Point* @at(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %calls) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %calls, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %2, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = trunc i64 %12 to i32
  %14 = call i8* @nish_alloc_struct(i64 8)
  %15 = bitcast i8* %14 to %struct.Point*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %calls, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %18 = trunc i64 %17 to i32
  call void @Point.constructor(%struct.Point* %15, i32 %18, i32 0)
  ret %struct.Point* %15
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %pattern.697.addr = alloca %struct.Point*, align 8
  %pattern.712.addr = alloca %struct.nish_array*, align 8
  %pattern.728.addr = alloca %struct.nish_array*, align 8
  %calls.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %pattern.774.addr = alloca %struct.nish_array*, align 8
  %pattern.802.addr = alloca %struct.Point*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Point.constructor(%struct.Point* %Point.obj, i32 1, i32 2)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 4, i32* %6, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  store %struct.Point* %7, %struct.Point** %pattern.697.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store %struct.nish_array* %8, %struct.nish_array** %pattern.712.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store %struct.nish_array* %9, %struct.nish_array** %pattern.728.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %calls.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %calls.addr, align 8
  %14 = call %struct.nish_array* @make(%struct.nish_array* %13)
  store %struct.nish_array* %14, %struct.nish_array** %pattern.774.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %calls.addr, align 8
  %16 = call %struct.Point* @at(%struct.nish_array* %15)
  store %struct.Point* %16, %struct.Point** %pattern.802.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %calls.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %23 = getelementptr inbounds %struct.Point, %struct.Point* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !4
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = icmp ult i64 0, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %27)
  unreachable

bounds.ok:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  %33 = load i32, i32* %32, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  %37 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
