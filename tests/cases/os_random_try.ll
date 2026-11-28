%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"no entropy\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"filled \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare zeroext i1 @nish_random_try_fill(%struct.nish_array* noundef nonnull align 8 nocapture) #0

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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @draw(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %into) #0 {
entry:
  %0 = call zeroext i1 @nish_random_try_fill(%struct.nish_array* %into)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.nish_result.i32.str*
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 0
  store i1 false, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 2
  store i8* bitcast ({ i64, [11 x i8] }* @.str.0 to i8*), i8** %5, align 8
  ret %struct.nish_result.i32.str* %3

if.end:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %into, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = call i8* @nish_alloc_struct(i64 16)
  %10 = bitcast i8* %9 to %struct.nish_result.i32.str*
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  store i1 true, i1* %11, align 1
  %12 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  store i32 %8, i32* %12, align 4
  ret %struct.nish_result.i32.str* %10
}

define internal void @report(%struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) readonly nocapture %r) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 0
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %if.then, label %if.else

if.then:
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  br label %if.end

if.else:
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  call void @nish_print(i8* %7)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [32 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [32 x i8], align 8
  %filled.addr = alloca i1, align 1
  %same.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [0 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 32, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 32, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [32 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 32, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 32, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [32 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %9 = call %struct.nish_result.i32.str* @draw(%struct.nish_array* %8)
  call void @report(%struct.nish_result.i32.str* %9)
  %10 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %11 = call zeroext i1 @nish_random_try_fill(%struct.nish_array* %10)
  store i1 %11, i1* %filled.addr, align 1
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %i.addr, align 4
  %12 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = trunc i64 %14 to i32
  %24 = icmp slt i32 %22, %23
  br i1 %24, label %land.rhs, label %land.end

land.rhs:
  %25 = load i32, i32* %i.addr, align 4
  %26 = trunc i64 %19 to i32
  %27 = icmp slt i32 %25, %26
  br label %land.end

land.end:
  %28 = phi i1 [ false, %for.cond ], [ %27, %land.rhs ]
  br i1 %28, label %for.body, label %for.end

for.body:
  %29 = load i32, i32* %i.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %16 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %30
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %21 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %35
  %38 = load i8, i8* %37, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = icmp ne i8 %33, %38
  br i1 %39, label %if.then, label %if.end

if.then:
  store i1 false, i1* %same.addr, align 1
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load i1, i1* %filled.addr, align 1
  br i1 %42, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %43 = load i1, i1* %same.addr, align 1
  %44 = xor i1 %43, true
  br label %land.end.1

land.end.1:
  %45 = phi i1 [ false, %for.end ], [ %44, %land.rhs.1 ]
  %46 = select i1 %45, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %46)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast [0 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %49, i8 0, i64 0, i1 false), !alias.scope !4, !noalias !3
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = call %struct.nish_result.i32.str* @draw(%struct.nish_array* %arr.hdr.2)
  call void @report(%struct.nish_result.i32.str* %51)
  %52 = call i8* @nish_alloc_struct(i64 24)
  %53 = bitcast i8* %52 to %struct.nish_array*
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  store i64 65536, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 1
  store i64 65536, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %56, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  store i8* %56, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = call %struct.nish_result.i32.str* @draw(%struct.nish_array* %53)
  call void @report(%struct.nish_result.i32.str* %58)
  %59 = call i8* @nish_alloc_struct(i64 24)
  %60 = bitcast i8* %59 to %struct.nish_array*
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  store i64 65537, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  store i64 65537, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = call i8* @nish_alloc_struct(i64 65537)
  call void @llvm.memset.p0i8.i64(i8* align 8 %63, i8 0, i64 65537, i1 false), !alias.scope !4, !noalias !3
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  store i8* %63, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = call %struct.nish_result.i32.str* @draw(%struct.nish_array* %60)
  call void @report(%struct.nish_result.i32.str* %65)
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
