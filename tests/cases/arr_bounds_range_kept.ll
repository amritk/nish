%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"16\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4
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

define internal noundef i32 @unsignedSum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  %5 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %10 = load i32, i32* %r.addr, align 4
  %11 = icmp ult i32 %10, 8
  br i1 %11, label %for.body, label %for.end

for.body:
  store i32 0, i32* %c.addr, align 4
  %12 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %17 = load i32, i32* %c.addr, align 4
  %18 = icmp ult i32 %17, 8
  br i1 %18, label %for.body.1, label %for.end.1

for.body.1:
  %19 = load i32, i32* %total.addr, align 4
  %20 = load i32, i32* %r.addr, align 4
  %21 = load i32, i32* %c.addr, align 4
  %22 = add i32 %20, %21
  %23 = zext i32 %22 to i64
  %24 = icmp ult i64 %23, %14
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %23, i64 %14)
  unreachable

bounds.ok:
  %25 = bitcast i8* %16 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %31 = load i32, i32* %c.addr, align 4
  %32 = add i32 %31, 1
  store i32 %32, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %33 = load i32, i32* %r.addr, align 4
  %34 = add i32 %33, 1
  store i32 %34, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %35 = load i32, i32* %total.addr, align 4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %40

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @unknownLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %r.addr, align 4
  %5 = icmp slt i32 %4, 4
  br i1 %5, label %for.body, label %for.end

for.body:
  store i32 0, i32* %c.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp slt i32 %10, 4
  br i1 %11, label %for.body.1, label %for.end.1

for.body.1:
  %12 = load i32, i32* %total.addr, align 4
  %13 = load i32, i32* %r.addr, align 4
  %14 = mul nsw i32 %13, 4
  %15 = load i32, i32* %c.addr, align 4
  %16 = add nsw i32 %14, %15
  %17 = sext i32 %16 to i64
  %18 = icmp ult i64 %17, %7
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %17, i64 %7)
  unreachable

bounds.ok:
  %19 = bitcast i8* %9 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %17
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %25 = load i32, i32* %c.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %27 = load i32, i32* %r.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %29 = load i32, i32* %total.addr, align 4
  ret i32 %29

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %sized.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %5 = call double @nish_parse_number(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 2)
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = mul i64 %7, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %10, %struct.nish_array** %sized.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = call i32 @unsignedSum(%struct.nish_array* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = load %struct.nish_array*, %struct.nish_array** %sized.addr, align 8
  %20 = call i32 @unknownLength(%struct.nish_array* %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
