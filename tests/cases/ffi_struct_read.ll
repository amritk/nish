%struct.Sample = type { i8, i64, i8*, double }
%struct.Lconv = type { i8*, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c": tag \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", count \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c", name \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", ratio \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"churned \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kept\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alias\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"nullable\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"fresh\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"decimal point \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c", thousands separator \22\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\22\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @samplePtr()
declare void @overwriteSample()
declare i8* @localeconv()
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #4

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

define internal noundef nonnull align 8 dereferenceable(32) %struct.Sample* @copied() #0 {
entry:
  %0 = call i8* @samplePtr()
  %1 = call i8* @nish_alloc_struct(i64 32)
  %2 = bitcast i8* %1 to %struct.Sample*
  %3 = bitcast %struct.Sample* %2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %3, i8* align 1 %0, i64 32, i1 false)
  ret %struct.Sample* %2
}

define internal noundef i64 @churn() #0 {
entry:
  %total.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.Sample*, align 8
  %Sample.obj = alloca %struct.Sample, align 8
  store i64 0, i64* %total.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 64
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = bitcast %struct.Sample* %Sample.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 32, i1 false)
  store %struct.Sample* %Sample.obj, %struct.Sample** %s.addr, align 8
  %3 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %4 = getelementptr inbounds %struct.Sample, %struct.Sample* %3, i32 0, i32 0
  store i8 255, i8* %4, align 1
  %5 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %6 = getelementptr inbounds %struct.Sample, %struct.Sample* %5, i32 0, i32 1
  store i64 99, i64* %6, align 8
  %7 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %8 = getelementptr inbounds %struct.Sample, %struct.Sample* %7, i32 0, i32 3
  store double 0x4023000000000000, double* %8, align 8
  %9 = load i64, i64* %total.addr, align 8
  %10 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %11 = getelementptr inbounds %struct.Sample, %struct.Sample* %10, i32 0, i32 1
  %12 = load i64, i64* %11, align 8
  %13 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %9, i64 %12)
  %14 = extractvalue { i64, i1 } %13, 0
  %15 = extractvalue { i64, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %14, i64* %total.addr, align 8
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = load i64, i64* %total.addr, align 8
  ret i64 %18

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @show(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.Sample* noundef nonnull readonly align 8 dereferenceable(32) nocapture %s) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %1 = getelementptr inbounds %struct.Sample, %struct.Sample* %s, i32 0, i32 0
  %2 = load i8, i8* %1, align 1
  %3 = zext i8 %2 to i64
  %4 = call i8* @nish_str_from_u64(i64 %3)
  %5 = call i8* @nish_str_concat(i8* %0, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [9 x i8] }* @.str.1 to i8*))
  %7 = getelementptr inbounds %struct.Sample, %struct.Sample* %s, i32 0, i32 1
  %8 = load i64, i64* %7, align 8
  %9 = call i8* @nish_str_from_i64(i64 %8)
  %10 = call i8* @nish_str_concat(i8* %6, i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  %12 = getelementptr inbounds %struct.Sample, %struct.Sample* %s, i32 0, i32 2
  %13 = load i8*, i8** %12, align 8
  %14 = call i8* @nish.ffi.str(i8* %13)
  %15 = call i8* @nish_str_concat(i8* %11, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  %17 = getelementptr inbounds %struct.Sample, %struct.Sample* %s, i32 0, i32 3
  %18 = load double, double* %17, align 8
  %19 = call i8* @nish_str_from_f64(double %18)
  %20 = call i8* @nish_str_concat(i8* %16, i8* %19)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @run() #0 {
entry:
  %kept.addr = alloca %struct.Sample*, align 8
  %alias.addr = alloca %struct.Sample*, align 8
  %maybe.addr = alloca %struct.Sample*, align 8
  %lc.addr = alloca %struct.Lconv*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Sample* @copied()
  store %struct.Sample* %0, %struct.Sample** %kept.addr, align 8
  %1 = call i8* @samplePtr()
  %2 = call i8* @nish_alloc_struct(i64 32)
  %3 = bitcast i8* %2 to %struct.Sample*
  %4 = bitcast %struct.Sample* %3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %4, i8* align 1 %1, i64 32, i1 false)
  store %struct.Sample* %3, %struct.Sample** %alias.addr, align 8
  store %struct.Sample* null, %struct.Sample** %maybe.addr, align 8
  %5 = call i8* @samplePtr()
  %6 = call i8* @nish_alloc_struct(i64 32)
  %7 = bitcast i8* %6 to %struct.Sample*
  %8 = bitcast %struct.Sample* %7 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %8, i8* align 1 %5, i64 32, i1 false)
  store %struct.Sample* %7, %struct.Sample** %maybe.addr, align 8
  %9 = call i64 @churn()
  %10 = call i8* @nish_str_from_i64(i64 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %10)
  call void @nish_print(i8* %11)
  call void @overwriteSample()
  %12 = load %struct.Sample*, %struct.Sample** %kept.addr, align 8
  call void @show(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %struct.Sample* %12)
  %13 = load %struct.Sample*, %struct.Sample** %alias.addr, align 8
  call void @show(i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %struct.Sample* %13)
  %14 = load %struct.Sample*, %struct.Sample** %maybe.addr, align 8
  %15 = icmp ne %struct.Sample* %14, null
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load %struct.Sample*, %struct.Sample** %maybe.addr, align 8
  call void @show(i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*), %struct.Sample* %16)
  br label %if.end

if.end:
  %17 = call i8* @samplePtr()
  %18 = call i8* @nish_alloc_struct(i64 32)
  %19 = bitcast i8* %18 to %struct.Sample*
  %20 = bitcast %struct.Sample* %19 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %20, i8* align 1 %17, i64 32, i1 false)
  call void @show(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), %struct.Sample* %19)
  %21 = call i8* @localeconv()
  %22 = call i8* @nish_alloc_struct(i64 16)
  %23 = bitcast i8* %22 to %struct.Lconv*
  %24 = bitcast %struct.Lconv* %23 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %24, i8* align 1 %21, i64 16, i1 false)
  store %struct.Lconv* %23, %struct.Lconv** %lc.addr, align 8
  %25 = load %struct.Lconv*, %struct.Lconv** %lc.addr, align 8
  %26 = getelementptr inbounds %struct.Lconv, %struct.Lconv* %25, i32 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = call i8* @nish.ffi.str(i8* %27)
  %29 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.9 to i8*), i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [24 x i8] }* @.str.10 to i8*))
  %31 = load %struct.Lconv*, %struct.Lconv** %lc.addr, align 8
  %32 = getelementptr inbounds %struct.Lconv, %struct.Lconv* %31, i32 0, i32 1
  %33 = load i8*, i8** %32, align 8
  %34 = call i8* @nish.ffi.str(i8* %33)
  %35 = call i8* @nish_str_concat(i8* %30, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*))
  call void @nish_print(i8* %36)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
