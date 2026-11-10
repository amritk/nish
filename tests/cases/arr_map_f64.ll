%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"slice out of range: [\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c") of length \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #2
declare i64 @llvm.fptosi.sat.i64.f64(double) #2

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

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call %struct.nish_array* @nish.map$f64$str$fn.11.show$arrow0(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, 1
  %6 = mul i64 %4, %5
  %7 = icmp eq i64 %2, 0
  %8 = select i1 %7, i64 0, i64 %6
  store i64 %8, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %9 = load i64, i64* %join.at, align 8
  %10 = icmp ult i64 %9, %2
  br i1 %10, label %join.sum.body, label %join.copy

join.sum.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %9
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = load i64, i64* %join.total, align 8
  %17 = bitcast i8* %15 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = add i64 %16, %18
  store i64 %19, i64* %join.total, align 8
  %20 = add i64 %9, 1
  store i64 %20, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %21 = load i64, i64* %join.total, align 8
  %22 = icmp ugt i64 %21, 2147483647
  %23 = add i64 %21, 9
  %24 = select i1 %22, i64 4611686018427387904, i64 %23
  %25 = call i8* @nish_alloc_struct(i64 %24)
  %26 = bitcast i8* %25 to i64*
  store i64 %21, i64* %26, align 8
  %27 = getelementptr inbounds i8, i8* %25, i64 8
  store i8* %27, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %28 = load i64, i64* %join.at, align 8
  %29 = icmp ult i64 %28, %2
  br i1 %29, label %join.part, label %join.end

join.part:
  %30 = load i8*, i8** %join.p, align 8
  %31 = icmp eq i64 %28, 0
  %32 = select i1 %31, i64 0, i64 %4
  %33 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %30, i8* %33, i64 %32, i1 false)
  %34 = getelementptr inbounds i8, i8* %30, i64 %32
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %28
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = getelementptr inbounds i8, i8* %39, i64 8
  %43 = icmp eq i64 %41, 1
  br i1 %43, label %join.byte, label %join.bulk

join.byte:
  %44 = load i8, i8* %42, align 1
  store i8 %44, i8* %34, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %34, i8* %42, i64 %41, i1 false)
  br label %join.next

join.next:
  %45 = getelementptr inbounds i8, i8* %34, i64 %41
  store i8* %45, i8** %join.p, align 8
  %46 = add i64 %28, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %47 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %47, align 1
  ret i8* %25
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fneg double 0x4000000000000000
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %3 = bitcast [4 x double]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %3 to double*
  %6 = getelementptr inbounds double, double* %5, i64 0
  store double 0x3FF8000000000000, double* %6, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds double, double* %5, i64 1
  store double %0, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds double, double* %5, i64 2
  store double 0x3FD0000000000000, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds double, double* %5, i64 3
  store double 0x4020000000000000, double* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = call %struct.nish_array* @nish.mapIndexed$f64$f64$fn.16.nish_main$arrow0(%struct.nish_array* %10)
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @show(%struct.nish_array* %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = call %struct.nish_array* @nish.filter$f64$fn.16.nish_main$arrow1(%struct.nish_array* %15)
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @show(%struct.nish_array* %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  call void @nish_print(i8* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = call i1 @nish.some$f64$fn.16.nish_main$arrow2(%struct.nish_array* %20)
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = call i1 @nish.every$f64$fn.16.nish_main$arrow3(%struct.nish_array* %24)
  %26 = select i1 %25, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %30 = call double @nish.findIndex$f64$fn.16.nish_main$arrow4(%struct.nish_array* %29)
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = call %struct.nish_array* @nish.slice$f64(%struct.nish_array* %33, double 0x3FF0000000000000, double 0x4008000000000000)
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @show(%struct.nish_array* %34)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  call void @nish_print(i8* %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef nonnull align 8 i8* @show$arrow0(double noundef %x) #1 {
entry:
  %0 = call i8* @nish_str_from_f64(double %x)
  ret i8* %0
}

define hidden noundef double @nish_main$arrow0(double noundef %x, double noundef %i) #2 {
entry:
  %0 = fmul double %x, 0x4000000000000000
  %1 = fadd double %0, %i
  ret double %1
}

define hidden noundef zeroext i1 @nish_main$arrow1(double noundef %x) #2 {
entry:
  %0 = fcmp ogt double %x, 0x0000000000000000
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow2(double noundef %x) #2 {
entry:
  %0 = fcmp olt double %x, 0x0000000000000000
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow3(double noundef %x) #2 {
entry:
  %0 = fcmp une double %x, 0x0000000000000000
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow4(double noundef %x) #2 {
entry:
  %0 = fcmp oeq double %x, 0x3FD0000000000000
  ret i1 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$f64$str$fn.11.show$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = sitofp i64 %6 to double
  store double %7, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %8 = load double, double* %i.addr, align 8
  %9 = load double, double* %n.addr, align 8
  %10 = fcmp olt double %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load double, double* %i.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = sitofp i64 %13 to double
  %15 = fcmp olt double %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load double, double* %i.addr, align 8
  %19 = fptosi double %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to double*
  %26 = getelementptr inbounds double, double* %25, i64 %19
  %27 = load double, double* %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @show$arrow0(double %27)
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %32
  store i8* %30, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = sitofp i64 %40 to double
  br label %for.inc

for.inc:
  %42 = load double, double* %i.addr, align 8
  %43 = fadd double %42, 0x3FF0000000000000
  store double %43, double* %i.addr, align 8
  br label %for.cond

for.end:
  %44 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %44
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.mapIndexed$f64$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = sitofp i64 %6 to double
  store double %7, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %8 = load double, double* %i.addr, align 8
  %9 = load double, double* %n.addr, align 8
  %10 = fcmp olt double %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load double, double* %i.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = sitofp i64 %13 to double
  %15 = fcmp olt double %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load double, double* %i.addr, align 8
  %19 = fptosi double %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to double*
  %26 = getelementptr inbounds double, double* %25, i64 %19
  %27 = load double, double* %26, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = load double, double* %i.addr, align 8
  %29 = call double @nish_main$arrow0(double %27, double %28)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to double*
  %38 = getelementptr inbounds double, double* %37, i64 %31
  store double %29, double* %38, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = sitofp i64 %39 to double
  br label %for.inc

for.inc:
  %41 = load double, double* %i.addr, align 8
  %42 = fadd double %41, 0x3FF0000000000000
  store double %42, double* %i.addr, align 8
  br label %for.cond

for.end:
  %43 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %43
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filter$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = sitofp i64 %6 to double
  store double %7, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %8 = load double, double* %i.addr, align 8
  %9 = load double, double* %n.addr, align 8
  %10 = fcmp olt double %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load double, double* %i.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = sitofp i64 %13 to double
  %15 = fcmp olt double %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load double, double* %i.addr, align 8
  %18 = fptosi double %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %18, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %23 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %18
  %26 = load double, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store double %26, double* %x.addr, align 8
  %27 = load double, double* %x.addr, align 8
  %28 = call i1 @nish_main$arrow1(double %27)
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %30 = load double, double* %x.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %29, i64 8)
  br label %push.store

push.store:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast i8* %37 to double*
  %39 = getelementptr inbounds double, double* %38, i64 %32
  store double %30, double* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = sitofp i64 %40 to double
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %42 = load double, double* %i.addr, align 8
  %43 = fadd double %42, 0x3FF0000000000000
  store double %43, double* %i.addr, align 8
  br label %for.cond

for.end:
  %44 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %44
}

define internal noundef zeroext i1 @nish.some$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  store double %2, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load double, double* %i.addr, align 8
  %8 = load double, double* %n.addr, align 8
  %9 = fcmp olt double %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load double, double* %i.addr, align 8
  %11 = sitofp i64 %4 to double
  %12 = fcmp olt double %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load double, double* %i.addr, align 8
  %15 = fptosi double %14 to i64
  %16 = icmp ult i64 %15, %4
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %4)
  unreachable

bounds.ok:
  %17 = bitcast i8* %6 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %15
  %19 = load double, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %20 = call i1 @nish_main$arrow2(double %19)
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %21 = load double, double* %i.addr, align 8
  %22 = fadd double %21, 0x3FF0000000000000
  store double %22, double* %i.addr, align 8
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef zeroext i1 @nish.every$f64$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  store double %2, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load double, double* %i.addr, align 8
  %8 = load double, double* %n.addr, align 8
  %9 = fcmp olt double %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load double, double* %i.addr, align 8
  %11 = sitofp i64 %4 to double
  %12 = fcmp olt double %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load double, double* %i.addr, align 8
  %15 = fptosi double %14 to i64
  %16 = icmp ult i64 %15, %4
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %4)
  unreachable

bounds.ok:
  %17 = bitcast i8* %6 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %15
  %19 = load double, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %20 = call i1 @nish_main$arrow3(double %19)
  %21 = xor i1 %20, true
  br i1 %21, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %22 = load double, double* %i.addr, align 8
  %23 = fadd double %22, 0x3FF0000000000000
  store double %23, double* %i.addr, align 8
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef double @nish.findIndex$f64$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  store double %2, double* %n.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load double, double* %i.addr, align 8
  %8 = load double, double* %n.addr, align 8
  %9 = fcmp olt double %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load double, double* %i.addr, align 8
  %11 = sitofp i64 %4 to double
  %12 = fcmp olt double %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load double, double* %i.addr, align 8
  %15 = fptosi double %14 to i64
  %16 = icmp ult i64 %15, %4
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %4)
  unreachable

bounds.ok:
  %17 = bitcast i8* %6 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %15
  %19 = load double, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %20 = call i1 @nish_main$arrow4(double %19)
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load double, double* %i.addr, align 8
  ret double %21

if.end:
  br label %for.inc

for.inc:
  %22 = load double, double* %i.addr, align 8
  %23 = fadd double %22, 0x3FF0000000000000
  store double %23, double* %i.addr, align 8
  br label %for.cond

for.end:
  %24 = fneg double 0x3FF0000000000000
  ret double %24
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.slice$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, double noundef %start, double noundef %end) #0 {
entry:
  %from.addr = alloca i64, align 8
  %to.addr = alloca i64, align 8
  %len.addr = alloca i64, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i64 @llvm.fptosi.sat.i64.f64(double %start)
  store i64 %0, i64* %from.addr, align 8
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %end)
  store i64 %1, i64* %to.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = sitofp i64 %3 to double
  %5 = call i64 @llvm.fptosi.sat.i64.f64(double %4)
  store i64 %5, i64* %len.addr, align 8
  %6 = load i64, i64* %from.addr, align 8
  %7 = icmp slt i64 %6, 0
  br i1 %7, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %8 = load i64, i64* %from.addr, align 8
  %9 = load i64, i64* %to.addr, align 8
  %10 = icmp sgt i64 %8, %9
  br label %lor.end.1

lor.end.1:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs.1 ]
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i64, i64* %to.addr, align 8
  %13 = load i64, i64* %len.addr, align 8
  %14 = icmp sgt i64 %12, %13
  br label %lor.end

lor.end:
  %15 = phi i1 [ true, %lor.end.1 ], [ %14, %lor.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i64, i64* %from.addr, align 8
  %17 = call i8* @nish_str_from_i64(i64 %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.4 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*))
  %20 = load i64, i64* %to.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [13 x i8] }* @.str.6 to i8*))
  %24 = load i64, i64* %len.addr, align 8
  %25 = call i8* @nish_str_from_i64(i64 %24)
  %26 = call i8* @nish_str_concat(i8* %23, i8* %25)
  call void @nish_panic(i8* %26)
  unreachable

if.end:
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %28, %struct.nish_array** %out.addr, align 8
  %32 = load i64, i64* %from.addr, align 8
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %34 = load i32, i32* %i.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %36 = load i32, i32* %i.addr, align 4
  %37 = load i64, i64* %to.addr, align 8
  %38 = trunc i64 %37 to i32
  %39 = icmp slt i32 %36, %38
  br label %land.end.1

land.end.1:
  %40 = phi i1 [ false, %for.cond ], [ %39, %land.rhs.1 ]
  br i1 %40, label %land.rhs, label %land.end

land.rhs:
  %41 = load i32, i32* %i.addr, align 4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = sitofp i64 %43 to double
  %45 = call i32 @llvm.fptosi.sat.i32.f64(double %44)
  %46 = icmp slt i32 %41, %45
  br label %land.end

land.end:
  %47 = phi i1 [ false, %land.end.1 ], [ %46, %land.rhs ]
  br i1 %47, label %for.body, label %for.end

for.body:
  %48 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %49 = load i32, i32* %i.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = bitcast i8* %52 to double*
  %54 = getelementptr inbounds double, double* %53, i64 %50
  %55 = load double, double* %54, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %60 = icmp eq i64 %57, %59
  br i1 %60, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %48, i64 8)
  br label %push.store

push.store:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %57
  store double %55, double* %64, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %65 = add i64 %57, 1
  store i64 %65, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = sitofp i64 %65 to double
  br label %for.inc

for.inc:
  %67 = load i32, i32* %i.addr, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %69 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %69
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element double", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
