%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_errno_slot = external global i32, align 4
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"before any call: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"/nonexistent/nish-errno\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"open: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" errno \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"after an allocation: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"99999999999999999999999\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"strtol out of range: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"42\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"strtol in range: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [77 x i8] } { i64 76, [77 x i8] c"`errno_says` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"errno_says: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i32 @open(i8*, i32)
declare i64 @strtol(i8*, i8*, i32)
declare i8* @errno_says(i32)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare nonnull i32* @nish_errno_ptr() #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4

define private i8* @nish.ffi.str(i8* %p) {
entry:
  br label %scan

scan:
  %n = phi i64 [ 0, %entry ], [ %next, %scan ]
  %at = getelementptr inbounds i8, i8* %p, i64 %n
  %byte = load i8, i8* %at, align 1
  %next = add i64 %n, 1
  %end = icmp eq i8 %byte, 0
  br i1 %end, label %copy, label %scan

copy:
  %s = call i8* @nish_str_new(i8* %p, i64 %n)
  ret i8* %s
}

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

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 4000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %25 = load i64, i64* %24, align 8
  %26 = sub i64 %23, 1
  %27 = mul i64 %25, %26
  %28 = icmp eq i64 %23, 0
  %29 = select i1 %28, i64 0, i64 %27
  store i64 %29, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %30 = load i64, i64* %join.at, align 8
  %31 = icmp ult i64 %30, %23
  br i1 %31, label %join.sum.body, label %join.copy

join.sum.body:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %30
  %36 = load i8*, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = load i64, i64* %join.total, align 8
  %38 = bitcast i8* %36 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = add i64 %37, %39
  store i64 %40, i64* %join.total, align 8
  %41 = add i64 %30, 1
  store i64 %41, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %42 = load i64, i64* %join.total, align 8
  %43 = icmp ugt i64 %42, 2147483647
  %44 = add i64 %42, 9
  %45 = select i1 %43, i64 4611686018427387904, i64 %44
  %46 = call i8* @nish_alloc_struct(i64 %45)
  %47 = bitcast i8* %46 to i64*
  store i64 %42, i64* %47, align 8
  %48 = getelementptr inbounds i8, i8* %46, i64 8
  store i8* %48, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %49 = load i64, i64* %join.at, align 8
  %50 = icmp ult i64 %49, %23
  br i1 %50, label %join.part, label %join.end

join.part:
  %51 = load i8*, i8** %join.p, align 8
  %52 = icmp eq i64 %49, 0
  %53 = select i1 %52, i64 0, i64 %25
  %54 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %51, i8* %54, i64 %53, i1 false)
  %55 = getelementptr inbounds i8, i8* %51, i64 %53
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %49
  %60 = load i8*, i8** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = bitcast i8* %60 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = getelementptr inbounds i8, i8* %60, i64 8
  %64 = icmp eq i64 %62, 1
  br i1 %64, label %join.byte, label %join.bulk

join.byte:
  %65 = load i8, i8* %63, align 1
  store i8 %65, i8* %55, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %63, i64 %62, i1 false)
  br label %join.next

join.next:
  %66 = getelementptr inbounds i8, i8* %55, i64 %62
  store i8* %66, i8** %join.p, align 8
  %67 = add i64 %49, 1
  store i64 %67, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %68 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %68, align 1
  %69 = bitcast i8* %46 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = trunc i64 %70 to i32
  ret i32 %71
}

define internal noundef i32 @lastErrno() #1 {
entry:
  %0 = load i32, i32* @nish_errno_slot, align 4
  ret i32 %0
}

define noundef i32 @run() #2 {
entry:
  %fd.addr = alloca i32, align 4
  %big.addr = alloca i64, align 8
  %small.addr = alloca i64, align 8
  %said.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @lastErrno()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*), i8* %1)
  call void @nish_print(i8* %2)
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [24 x i8] }* @.str.2 to i8*), i64 8
  %4 = call i32* @nish_errno_ptr()
  store i32 0, i32* %4, align 4
  %5 = call i32 @open(i8* %3, i32 0)
  %6 = load i32, i32* %4, align 4
  store i32 %6, i32* @nish_errno_slot, align 4
  store i32 %5, i32* %fd.addr, align 4
  %7 = load i32, i32* %fd.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %11 = call i32 @lastErrno()
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  call void @nish_print(i8* %13)
  %14 = call i32 @churn()
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.5 to i8*), i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %18 = load i32, i32* @nish_errno_slot, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %17, i8* %19)
  call void @nish_print(i8* %20)
  %21 = getelementptr inbounds i8, i8* bitcast ({ i64, [24 x i8] }* @.str.6 to i8*), i64 8
  %22 = call i32* @nish_errno_ptr()
  store i32 0, i32* %22, align 4
  %23 = call i64 @strtol(i8* %21, i8* null, i32 10)
  %24 = load i32, i32* %22, align 4
  store i32 %24, i32* @nish_errno_slot, align 4
  store i64 %23, i64* %big.addr, align 8
  %25 = load i64, i64* %big.addr, align 8
  %26 = icmp sgt i64 %25, 4000000000000000
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.7 to i8*), i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %30 = load i32, i32* @nish_errno_slot, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %29, i8* %31)
  call void @nish_print(i8* %32)
  %33 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*), i64 8
  %34 = call i32* @nish_errno_ptr()
  store i32 0, i32* %34, align 4
  %35 = call i64 @strtol(i8* %33, i8* null, i32 10)
  %36 = load i32, i32* %34, align 4
  store i32 %36, i32* @nish_errno_slot, align 4
  store i64 %35, i64* %small.addr, align 8
  %37 = load i64, i64* %small.addr, align 8
  %38 = call i8* @nish_str_from_i64(i64 %37)
  %39 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.11 to i8*), i8* %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %41 = load i32, i32* @nish_errno_slot, align 4
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %40, i8* %42)
  call void @nish_print(i8* %43)
  %44 = call i32* @nish_errno_ptr()
  store i32 0, i32* %44, align 4
  %45 = call i8* @errno_says(i32 5)
  %46 = load i32, i32* %44, align 4
  store i32 %46, i32* @nish_errno_slot, align 4
  %47 = icmp eq i8* %45, null
  br i1 %47, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [77 x i8] }* @.str.12 to i8*))
  unreachable

ffi.copy:
  %48 = call i8* @nish.ffi.str(i8* %45)
  store i8* %48, i8** %said.addr, align 8
  %49 = load i8*, i8** %said.addr, align 8
  %50 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.13 to i8*), i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  %52 = load i32, i32* @nish_errno_slot, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %51, i8* %53)
  call void @nish_print(i8* %54)
  %55 = load i32, i32* @nish_errno_slot, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %55
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
