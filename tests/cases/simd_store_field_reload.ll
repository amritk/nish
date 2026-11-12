%struct.Sink = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
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

define void @Sink.constructor(%struct.Sink* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = sext i32 %n to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 %1, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 %1, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = call i8* @nish_alloc_struct(i64 %1)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %1, i1 false), !alias.scope !10, !noalias !9
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 1
  store %struct.nish_array* %4, %struct.nish_array** %9, align 8, !tbaa !17
  ret void
}

define void @Sink.fill(%struct.Sink* noundef nonnull align 8 dereferenceable(16) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src) #0 {
entry:
  %i.addr = alloca i32, align 4
  %v.addr = alloca <16 x i8>, align 8
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %4 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 1
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %1 to i32
  %14 = sub nsw i32 %13, 16
  %15 = icmp sle i32 %12, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %7 to i32
  %19 = sub nsw i32 %18, 16
  %20 = icmp sle i32 %17, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %while.body, label %while.end

while.body:
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = add i64 %23, 16
  %25 = icmp ult i64 %23, %1
  %26 = icmp ule i64 %24, %1
  %27 = and i1 %25, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  %28 = add i64 %23, 15
  %29 = select i1 %25, i64 %28, i64 %23
  call void @nish_panic_index(i64 %29, i64 %1)
  unreachable

bounds.ok:
  %30 = bitcast i8* %3 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %23
  %32 = bitcast i8* %31 to <16 x i8>*
  %33 = load <16 x i8>, <16 x i8>* %32, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  store <16 x i8> %33, <16 x i8>* %v.addr, align 8
  %34 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = add i64 %36, 16
  %38 = icmp ult i64 %36, %7
  %39 = icmp ule i64 %37, %7
  %40 = and i1 %38, %39
  br i1 %40, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  %41 = add i64 %36, 15
  %42 = select i1 %38, i64 %41, i64 %36
  call void @nish_panic_index(i64 %42, i64 %7)
  unreachable

bounds.ok.1:
  %43 = bitcast i8* %9 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %36
  %45 = bitcast i8* %44 to <16 x i8>*
  store <16 x i8> %34, <16 x i8>* %45, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  %46 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 0
  %47 = load i32, i32* %46, align 4, !tbaa !5
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  %51 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 0
  store i32 %49, i32* %51, align 4, !tbaa !5
  %52 = load i32, i32* %i.addr, align 4
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 16)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %54, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %k.addr = alloca i32, align 4
  %s.addr = alloca %struct.Sink*, align 8
  %Sink.obj = alloca %struct.Sink, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %2 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 64, i1 false), !alias.scope !10, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp slt i32 %7, 64
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = load i32, i32* %k.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = load i32, i32* %k.addr, align 4
  %12 = mul nsw i32 %11, 3
  %13 = trunc i32 %12 to i8
  %14 = bitcast i8* %6 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 %10
  store i8 %13, i8* %15, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  %16 = load i32, i32* %k.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %k.addr, align 4
  br label %while.cond

while.end:
  call void @Sink.constructor(%struct.Sink* %Sink.obj, i32 48)
  store %struct.Sink* %Sink.obj, %struct.Sink** %s.addr, align 8
  %18 = load %struct.Sink*, %struct.Sink** %s.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @Sink.fill(%struct.Sink* %18, %struct.nish_array* %19)
  %20 = load %struct.Sink*, %struct.Sink** %s.addr, align 8
  %21 = getelementptr inbounds %struct.Sink, %struct.Sink* %20, i32 0, i32 1
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !17
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %28 = bitcast i8* %27 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 0
  %30 = load i8, i8* %29, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  %31 = zext i8 %30 to i64
  %32 = call i8* @nish_str_from_u64(i64 %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %34 = load %struct.Sink*, %struct.Sink** %s.addr, align 8
  %35 = getelementptr inbounds %struct.Sink, %struct.Sink* %34, i32 0, i32 1
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !17
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = icmp ult i64 17, %38
  br i1 %39, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 17, i64 %38)
  unreachable

bounds.ok.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %42 = bitcast i8* %41 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 17
  %44 = load i8, i8* %43, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  %45 = zext i8 %44 to i64
  %46 = call i8* @nish_str_from_u64(i64 %45)
  %47 = call i8* @nish_str_concat(i8* %33, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %49 = load %struct.Sink*, %struct.Sink** %s.addr, align 8
  %50 = getelementptr inbounds %struct.Sink, %struct.Sink* %49, i32 0, i32 1
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !17
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %54 = icmp ult i64 47, %53
  br i1 %54, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 47, i64 %53)
  unreachable

bounds.ok.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %57 = bitcast i8* %56 to i8*
  %58 = getelementptr inbounds i8, i8* %57, i64 47
  %59 = load i8, i8* %58, align 1, !alias.scope !10, !noalias !9, !tbaa !19
  %60 = zext i8 %59 to i64
  %61 = call i8* @nish_str_from_u64(i64 %60)
  %62 = call i8* @nish_str_concat(i8* %48, i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %64 = load %struct.Sink*, %struct.Sink** %s.addr, align 8
  %65 = getelementptr inbounds %struct.Sink, %struct.Sink* %64, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !5
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %63, i8* %67)
  call void @nish_print(i8* %68)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!20, !21, !22, !23, !24}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Sink", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
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
!17 = !{!4, !3, i64 8}
!18 = !{!"element i8", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}
