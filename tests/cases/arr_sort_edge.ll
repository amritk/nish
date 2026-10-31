%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"arena unchanged: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"nan: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"inconsistent: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noundef i64 @nish_arena_used() #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #1

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

define hidden noundef double @byFirst$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %0 = fptosi double 0x0000000000000000 to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %0
  %8 = load double, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = fptosi double 0x0000000000000000 to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %9, i64 %11)
  unreachable

bounds.ok.1:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to double*
  %16 = getelementptr inbounds double, double* %15, i64 %9
  %17 = load double, double* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = fcmp ogt double %8, %17
  br i1 %18, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %19 = fptosi double 0x0000000000000000 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to double*
  %23 = getelementptr inbounds double, double* %22, i64 %19
  %24 = load double, double* %23, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = fptosi double 0x0000000000000000 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to double*
  %29 = getelementptr inbounds double, double* %28, i64 %25
  %30 = load double, double* %29, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = fcmp olt double %24, %30
  br i1 %31, label %cond.true.1, label %cond.false.1

cond.true.1:
  %32 = fneg double 0x3FF0000000000000
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %33 = phi double [ %32, %cond.true.1 ], [ 0x0000000000000000, %cond.false.1 ]
  br label %cond.end

cond.end:
  %34 = phi double [ 0x3FF0000000000000, %cond.true ], [ %33, %cond.end.1 ]
  ret double %34
}

define void @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca double, align 8
  %before.addr = alloca i64, align 8
  %round.addr = alloca double, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x %struct.nish_array*], align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %fs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [6 x double], align 8
  %same.addr = alloca i1, align 1
  %finite.addr = alloca double, align 8
  %nans.addr = alloca double, align 8
  %f.addr = alloca double, align 8
  %forof.idx.1 = alloca i64, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %i.addr.1 = alloca double, align 8
  %sum.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %forof.idx.2 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %3 = load double, double* %i.addr, align 8
  %4 = fcmp olt double %3, 0x408F400000000000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = load double, double* %i.addr, align 8
  %7 = fmul double %6, 0x40BEEF0000000000
  %8 = frem double %7, 0x408F880000000000
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to double*
  %17 = getelementptr inbounds double, double* %16, i64 %10
  store double %8, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = sitofp i64 %18 to double
  br label %for.inc

for.inc:
  %20 = load double, double* %i.addr, align 8
  %21 = fadd double %20, 0x3FF0000000000000
  store double %21, double* %i.addr, align 8
  br label %for.cond

for.end:
  %22 = call i64 @nish_arena_used()
  store i64 %22, i64* %before.addr, align 8
  store double 0x0000000000000000, double* %round.addr, align 8
  br label %for.cond.1

for.cond.1:
  %23 = load double, double* %round.addr, align 8
  %24 = fcmp olt double %23, 0x4049000000000000
  br i1 %24, label %for.body.1, label %for.end.1

for.body.1:
  %25 = load double, double* %round.addr, align 8
  %26 = frem double %25, 0x4000000000000000
  %27 = fcmp oeq double %26, 0x0000000000000000
  br i1 %27, label %if.then, label %if.else

if.then:
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow0(%struct.nish_array* %28)
  br label %if.end

if.else:
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow1(%struct.nish_array* %30)
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %32 = load double, double* %round.addr, align 8
  %33 = fadd double %32, 0x3FF0000000000000
  store double %33, double* %round.addr, align 8
  br label %for.cond.1

for.end.1:
  %34 = call i64 @nish_arena_used()
  %35 = load i64, i64* %before.addr, align 8
  %36 = icmp eq i64 %34, %35
  %37 = select i1 %36, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %38 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.0 to i8*), i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %40 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %41 = fptosi double 0x0000000000000000 to i64
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 %41, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %41, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to double*
  %48 = getelementptr inbounds double, double* %47, i64 %41
  %49 = load double, double* %48, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %50 = call i8* @nish_str_from_f64(double %49)
  %51 = call i8* @nish_str_concat(i8* %39, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %53 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %54 = fptosi double 0x408F380000000000 to i64
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 %54, %56
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %54, i64 %56)
  unreachable

bounds.ok.1:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = bitcast i8* %59 to double*
  %61 = getelementptr inbounds double, double* %60, i64 %54
  %62 = load double, double* %61, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %63 = call i8* @nish_str_from_f64(double %62)
  %64 = call i8* @nish_str_concat(i8* %52, i8* %63)
  call void @nish_print(i8* %64)
  %65 = call i8* @nish_alloc_struct(i64 24)
  %66 = bitcast i8* %65 to %struct.nish_array*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  store i64 2, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 1
  store i64 2, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %69 = call i8* @nish_alloc_struct(i64 16)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  store i8* %69, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = bitcast i8* %69 to double*
  %72 = getelementptr inbounds double, double* %71, i64 0
  store double 0x4008000000000000, double* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %73 = getelementptr inbounds double, double* %71, i64 1
  store double 0x403E000000000000, double* %73, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = call i8* @nish_alloc_struct(i64 24)
  %75 = bitcast i8* %74 to %struct.nish_array*
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  store i64 2, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  store i64 2, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %78 = call i8* @nish_alloc_struct(i64 16)
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  store i8* %78, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %80 = bitcast i8* %78 to double*
  %81 = getelementptr inbounds double, double* %80, i64 0
  store double 0x3FF0000000000000, double* %81, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %82 = getelementptr inbounds double, double* %80, i64 1
  store double 0x4024000000000000, double* %82, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %83 = call i8* @nish_alloc_struct(i64 24)
  %84 = bitcast i8* %83 to %struct.nish_array*
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  store i64 2, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 1
  store i64 2, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %87 = call i8* @nish_alloc_struct(i64 16)
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  store i8* %87, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %89 = bitcast i8* %87 to double*
  %90 = getelementptr inbounds double, double* %89, i64 0
  store double 0x4000000000000000, double* %90, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %91 = getelementptr inbounds double, double* %89, i64 1
  store double 0x4034000000000000, double* %91, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %92 = call i8* @nish_alloc_struct(i64 24)
  %93 = bitcast i8* %92 to %struct.nish_array*
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  store i64 2, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 1
  store i64 2, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %96 = call i8* @nish_alloc_struct(i64 16)
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  store i8* %96, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %98 = bitcast i8* %96 to double*
  %99 = getelementptr inbounds double, double* %98, i64 0
  store double 0x3FF0000000000000, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %100 = getelementptr inbounds double, double* %98, i64 1
  store double 0x4026000000000000, double* %100, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = call i8* @nish_alloc_struct(i64 24)
  %102 = bitcast i8* %101 to %struct.nish_array*
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  store i64 2, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 1
  store i64 2, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %105 = call i8* @nish_alloc_struct(i64 16)
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  store i8* %105, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = bitcast i8* %105 to double*
  %108 = getelementptr inbounds double, double* %107, i64 0
  store double 0x4008000000000000, double* %108, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %109 = getelementptr inbounds double, double* %107, i64 1
  store double 0x403F000000000000, double* %109, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %110 = call i8* @nish_alloc_struct(i64 24)
  %111 = bitcast i8* %110 to %struct.nish_array*
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  store i64 2, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 1
  store i64 2, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %114 = call i8* @nish_alloc_struct(i64 16)
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  store i8* %114, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast i8* %114 to double*
  %117 = getelementptr inbounds double, double* %116, i64 0
  store double 0x0000000000000000, double* %117, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = getelementptr inbounds double, double* %116, i64 1
  store double 0x0000000000000000, double* %118, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %121 = bitcast [6 x %struct.nish_array*]* %arr.data to i8*
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %121, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %123 = bitcast i8* %121 to %struct.nish_array**
  %124 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 0
  store %struct.nish_array* %66, %struct.nish_array** %124, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %125 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 1
  store %struct.nish_array* %75, %struct.nish_array** %125, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %126 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 2
  store %struct.nish_array* %84, %struct.nish_array** %126, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %127 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 3
  store %struct.nish_array* %93, %struct.nish_array** %127, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %128 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 4
  store %struct.nish_array* %102, %struct.nish_array** %128, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %129 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %123, i64 5
  store %struct.nish_array* %111, %struct.nish_array** %129, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %rows.addr, align 8
  %130 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %131 = call %struct.nish_array* @nish.sortWith$arr.f64$fn.7.byFirst(%struct.nish_array* %130)
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %134, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %parts.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %136 = load i64, i64* %forof.idx, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = icmp ult i64 %136, %138
  br i1 %139, label %forof.body, label %forof.end

forof.body:
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %142 = bitcast i8* %141 to %struct.nish_array**
  %143 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %142, i64 %136
  %144 = load %struct.nish_array*, %struct.nish_array** %143, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %144, %struct.nish_array** %row.addr, align 8
  %145 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %146 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %147 = fptosi double 0x0000000000000000 to i64
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 0
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = icmp ult i64 %147, %149
  br i1 %150, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %147, i64 %149)
  unreachable

bounds.ok.2:
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %153 = bitcast i8* %152 to double*
  %154 = getelementptr inbounds double, double* %153, i64 %147
  %155 = load double, double* %154, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %156 = call i8* @nish_str_from_f64(double %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %158 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %159 = fptosi double 0x3FF0000000000000 to i64
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 0
  %161 = load i64, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = icmp ult i64 %159, %161
  br i1 %162, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %159, i64 %161)
  unreachable

bounds.ok.3:
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 2
  %164 = load i8*, i8** %163, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %165 = bitcast i8* %164 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %159
  %167 = load double, double* %166, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %168 = call i8* @nish_str_from_f64(double %167)
  %169 = call i8* @nish_str_concat(i8* %157, i8* %168)
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 0
  %171 = load i64, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 1
  %173 = load i64, i64* %172, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %174 = icmp eq i64 %171, %173
  br i1 %174, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %145, i64 8)
  br label %push.store.1

push.store.1:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 2
  %176 = load i8*, i8** %175, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %177 = bitcast i8* %176 to i8**
  %178 = getelementptr inbounds i8*, i8** %177, i64 %171
  store i8* %169, i8** %178, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %179 = add i64 %171, 1
  store i64 %179, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = sitofp i64 %179 to double
  br label %forof.inc

forof.inc:
  %181 = load i64, i64* %forof.idx, align 8
  %182 = add i64 %181, 1
  store i64 %182, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %183 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*) to i64*
  %187 = load i64, i64* %186, align 8
  %188 = sub i64 %185, 1
  %189 = mul i64 %187, %188
  %190 = icmp eq i64 %185, 0
  %191 = select i1 %190, i64 0, i64 %189
  store i64 %191, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %192 = load i64, i64* %join.at, align 8
  %193 = icmp ult i64 %192, %185
  br i1 %193, label %join.sum.body, label %join.copy

join.sum.body:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %196 = bitcast i8* %195 to i8**
  %197 = getelementptr inbounds i8*, i8** %196, i64 %192
  %198 = load i8*, i8** %197, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %199 = load i64, i64* %join.total, align 8
  %200 = bitcast i8* %198 to i64*
  %201 = load i64, i64* %200, align 8
  %202 = add i64 %199, %201
  store i64 %202, i64* %join.total, align 8
  %203 = add i64 %192, 1
  store i64 %203, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %204 = load i64, i64* %join.total, align 8
  %205 = icmp ugt i64 %204, 2147483647
  %206 = add i64 %204, 9
  %207 = select i1 %205, i64 4611686018427387904, i64 %206
  %208 = call i8* @nish_alloc_struct(i64 %207)
  %209 = bitcast i8* %208 to i64*
  store i64 %204, i64* %209, align 8
  %210 = getelementptr inbounds i8, i8* %208, i64 8
  store i8* %210, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %211 = load i64, i64* %join.at, align 8
  %212 = icmp ult i64 %211, %185
  br i1 %212, label %join.part, label %join.end

join.part:
  %213 = load i8*, i8** %join.p, align 8
  %214 = icmp eq i64 %211, 0
  %215 = select i1 %214, i64 0, i64 %187
  %216 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %213, i8* %216, i64 %215, i1 false)
  %217 = getelementptr inbounds i8, i8* %213, i64 %215
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %220 = bitcast i8* %219 to i8**
  %221 = getelementptr inbounds i8*, i8** %220, i64 %211
  %222 = load i8*, i8** %221, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %223 = bitcast i8* %222 to i64*
  %224 = load i64, i64* %223, align 8
  %225 = getelementptr inbounds i8, i8* %222, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %217, i8* %225, i64 %224, i1 false)
  %226 = getelementptr inbounds i8, i8* %217, i64 %224
  store i8* %226, i8** %join.p, align 8
  %227 = add i64 %211, 1
  store i64 %227, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %228 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %228, align 1
  call void @nish_print(i8* %208)
  %229 = fdiv double 0x0000000000000000, 0x0000000000000000
  %230 = fdiv double 0x0000000000000000, 0x0000000000000000
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 6, i64* %231, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 6, i64* %232, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %233 = bitcast [6 x double]* %arr.data.1 to i8*
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %233, i8** %234, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %235 = bitcast i8* %233 to double*
  %236 = getelementptr inbounds double, double* %235, i64 0
  store double 0x400C000000000000, double* %236, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %237 = getelementptr inbounds double, double* %235, i64 1
  store double %229, double* %237, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %238 = getelementptr inbounds double, double* %235, i64 2
  store double 0x3FF8000000000000, double* %238, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %239 = getelementptr inbounds double, double* %235, i64 3
  store double 0x4004000000000000, double* %239, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %240 = getelementptr inbounds double, double* %235, i64 4
  store double %230, double* %240, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %241 = getelementptr inbounds double, double* %235, i64 5
  store double 0x3FE0000000000000, double* %241, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %fs.addr, align 8
  %242 = load %struct.nish_array*, %struct.nish_array** %fs.addr, align 8
  %243 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow2(%struct.nish_array* %242)
  %244 = load %struct.nish_array*, %struct.nish_array** %fs.addr, align 8
  %245 = icmp eq %struct.nish_array* %243, %244
  store i1 %245, i1* %same.addr, align 1
  store double 0x0000000000000000, double* %finite.addr, align 8
  store double 0x0000000000000000, double* %nans.addr, align 8
  %246 = load %struct.nish_array*, %struct.nish_array** %fs.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %247 = load i64, i64* %forof.idx.1, align 8
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 0
  %249 = load i64, i64* %248, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %250 = icmp ult i64 %247, %249
  br i1 %250, label %forof.body.1, label %forof.end.1

forof.body.1:
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 2
  %252 = load i8*, i8** %251, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %253 = bitcast i8* %252 to double*
  %254 = getelementptr inbounds double, double* %253, i64 %247
  %255 = load double, double* %254, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store double %255, double* %f.addr, align 8
  %256 = load double, double* %f.addr, align 8
  %257 = load double, double* %f.addr, align 8
  %258 = fcmp une double %256, %257
  br i1 %258, label %if.then.1, label %if.else.1

if.then.1:
  %259 = load double, double* %nans.addr, align 8
  %260 = fadd double %259, 0x3FF0000000000000
  store double %260, double* %nans.addr, align 8
  br label %if.end.1

if.else.1:
  %261 = load double, double* %finite.addr, align 8
  %262 = load double, double* %f.addr, align 8
  %263 = fadd double %261, %262
  store double %263, double* %finite.addr, align 8
  br label %if.end.1

if.end.1:
  br label %forof.inc.1

forof.inc.1:
  %264 = load i64, i64* %forof.idx.1, align 8
  %265 = add i64 %264, 1
  store i64 %265, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %266 = load i1, i1* %same.addr, align 1
  %267 = select i1 %266, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %268 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8* %267)
  %269 = call i8* @nish_str_concat(i8* %268, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %270 = load %struct.nish_array*, %struct.nish_array** %fs.addr, align 8
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %270, i64 0, i32 0
  %272 = load i64, i64* %271, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %273 = sitofp i64 %272 to double
  %274 = call i8* @nish_str_from_f64(double %273)
  %275 = call i8* @nish_str_concat(i8* %269, i8* %274)
  %276 = call i8* @nish_str_concat(i8* %275, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %277 = load double, double* %finite.addr, align 8
  %278 = call i8* @nish_str_from_f64(double %277)
  %279 = call i8* @nish_str_concat(i8* %276, i8* %278)
  %280 = call i8* @nish_str_concat(i8* %279, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %281 = load double, double* %nans.addr, align 8
  %282 = call i8* @nish_str_from_f64(double %281)
  %283 = call i8* @nish_str_concat(i8* %280, i8* %282)
  call void @nish_print(i8* %283)
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 0, i64* %284, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %285 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 0, i64* %285, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* null, i8** %286, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %ws.addr, align 8
  store double 0x0000000000000000, double* %i.addr.1, align 8
  br label %for.cond.2

for.cond.2:
  %287 = load double, double* %i.addr.1, align 8
  %288 = fcmp olt double %287, 0x4069000000000000
  br i1 %288, label %for.body.2, label %for.end.2

for.body.2:
  %289 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %290 = load double, double* %i.addr.1, align 8
  %291 = fmul double %290, 0x403F000000000000
  %292 = frem double %291, 0x4031000000000000
  %293 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %289, i64 0, i32 0
  %294 = load i64, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %289, i64 0, i32 1
  %296 = load i64, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %297 = icmp eq i64 %294, %296
  br i1 %297, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %289, i64 8)
  br label %push.store.2

push.store.2:
  %298 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %289, i64 0, i32 2
  %299 = load i8*, i8** %298, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %300 = bitcast i8* %299 to double*
  %301 = getelementptr inbounds double, double* %300, i64 %294
  store double %292, double* %301, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %302 = add i64 %294, 1
  store i64 %302, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %303 = sitofp i64 %302 to double
  br label %for.inc.2

for.inc.2:
  %304 = load double, double* %i.addr.1, align 8
  %305 = fadd double %304, 0x3FF0000000000000
  store double %305, double* %i.addr.1, align 8
  br label %for.cond.2

for.end.2:
  %306 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %307 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow3(%struct.nish_array* %306)
  store double 0x0000000000000000, double* %sum.addr, align 8
  %308 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %309 = load i64, i64* %forof.idx.2, align 8
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 0
  %311 = load i64, i64* %310, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %312 = icmp ult i64 %309, %311
  br i1 %312, label %forof.body.2, label %forof.end.2

forof.body.2:
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 2
  %314 = load i8*, i8** %313, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %315 = bitcast i8* %314 to double*
  %316 = getelementptr inbounds double, double* %315, i64 %309
  %317 = load double, double* %316, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store double %317, double* %w.addr, align 8
  %318 = load double, double* %sum.addr, align 8
  %319 = load double, double* %w.addr, align 8
  %320 = fadd double %318, %319
  store double %320, double* %sum.addr, align 8
  br label %forof.inc.2

forof.inc.2:
  %321 = load i64, i64* %forof.idx.2, align 8
  %322 = add i64 %321, 1
  store i64 %322, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  %323 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %324 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %323, i64 0, i32 0
  %325 = load i64, i64* %324, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %326 = sitofp i64 %325 to double
  %327 = call i8* @nish_str_from_f64(double %326)
  %328 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.6 to i8*), i8* %327)
  %329 = call i8* @nish_str_concat(i8* %328, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %330 = load double, double* %sum.addr, align 8
  %331 = call i8* @nish_str_from_f64(double %330)
  %332 = call i8* @nish_str_concat(i8* %329, i8* %331)
  call void @nish_print(i8* %332)
  ret void
}

define hidden noundef double @nish_main$arrow0(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fsub double %a, %b
  ret double %0
}

define hidden noundef double @nish_main$arrow1(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fsub double %b, %a
  ret double %0
}

define hidden noundef double @nish_main$arrow2(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fsub double %a, %b
  ret double %0
}

define hidden noundef double @nish_main$arrow3(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fmul double %a, 0x4008000000000000
  %1 = fadd double %0, %b
  %2 = frem double %1, 0x4014000000000000
  %3 = fsub double %2, 0x4000000000000000
  ret double %3
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.stepTo(i32 noundef %lo, i32 noundef %step, i32 noundef %n) #1 {
entry:
  %0 = sub i32 %n, %lo
  %1 = icmp sgt i32 %0, %step
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = add i32 %lo, %step
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %n, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 9007199254740992
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %10, %struct.nish_array** %tmp.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %xs, %struct.nish_array* %16, i32 0, i32 %17)
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %18 = load i32, i32* %lo.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %lo.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.cond ], [ %22, %land.rhs ]
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load i32, i32* %lo.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i32 @nish.stepTo(i32 %24, i32 32, i32 %25)
  store i32 %26, i32* %hi.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %28 = load i32, i32* %lo.addr, align 4
  %29 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow0(%struct.nish_array* %27, %struct.nish_array* %xs, i32 %28, i32 %29)
  %30 = load i32, i32* %hi.addr, align 4
  store i32 %30, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %width.addr, align 4
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %width.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %while.body.1, label %while.end.1

while.body.1:
  %37 = load i1, i1* %inTmp.addr, align 1
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  %38 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* %38, %struct.nish_array* %xs, i32 %39, i32 %40)
  br label %if.end.1

if.else:
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* %xs, %struct.nish_array* %41, i32 %42, i32 %43)
  br label %if.end.1

if.end.1:
  %44 = load i1, i1* %inTmp.addr, align 1
  %45 = xor i1 %44, true
  store i1 %45, i1* %inTmp.addr, align 1
  %46 = load i32, i32* %width.addr, align 4
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = call i32 @nish.stepTo(i32 %46, i32 %47, i32 %48)
  store i32 %49, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %50 = load i1, i1* %inTmp.addr, align 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %52 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %51, %struct.nish_array* %xs, i32 0, i32 %52)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 9007199254740992
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %10, %struct.nish_array** %tmp.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %xs, %struct.nish_array* %16, i32 0, i32 %17)
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %18 = load i32, i32* %lo.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %lo.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.cond ], [ %22, %land.rhs ]
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load i32, i32* %lo.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i32 @nish.stepTo(i32 %24, i32 32, i32 %25)
  store i32 %26, i32* %hi.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %28 = load i32, i32* %lo.addr, align 4
  %29 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow1(%struct.nish_array* %27, %struct.nish_array* %xs, i32 %28, i32 %29)
  %30 = load i32, i32* %hi.addr, align 4
  store i32 %30, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %width.addr, align 4
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %width.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %while.body.1, label %while.end.1

while.body.1:
  %37 = load i1, i1* %inTmp.addr, align 1
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  %38 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* %38, %struct.nish_array* %xs, i32 %39, i32 %40)
  br label %if.end.1

if.else:
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* %xs, %struct.nish_array* %41, i32 %42, i32 %43)
  br label %if.end.1

if.end.1:
  %44 = load i1, i1* %inTmp.addr, align 1
  %45 = xor i1 %44, true
  store i1 %45, i1* %inTmp.addr, align 1
  %46 = load i32, i32* %width.addr, align 4
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = call i32 @nish.stepTo(i32 %46, i32 %47, i32 %48)
  store i32 %49, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %50 = load i1, i1* %inTmp.addr, align 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %52 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %51, %struct.nish_array* %xs, i32 0, i32 %52)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$arr.f64$fn.7.byFirst(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 9007199254740992
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %10, %struct.nish_array** %tmp.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$arr.f64(%struct.nish_array* %xs, %struct.nish_array* %16, i32 0, i32 %17)
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %18 = load i32, i32* %lo.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %lo.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.cond ], [ %22, %land.rhs ]
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load i32, i32* %lo.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i32 @nish.stepTo(i32 %24, i32 32, i32 %25)
  store i32 %26, i32* %hi.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %28 = load i32, i32* %lo.addr, align 4
  %29 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$arr.f64$fn.7.byFirst(%struct.nish_array* %27, %struct.nish_array* %xs, i32 %28, i32 %29)
  %30 = load i32, i32* %hi.addr, align 4
  store i32 %30, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %width.addr, align 4
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %width.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %while.body.1, label %while.end.1

while.body.1:
  %37 = load i1, i1* %inTmp.addr, align 1
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  %38 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$arr.f64$fn.7.byFirst(%struct.nish_array* %38, %struct.nish_array* %xs, i32 %39, i32 %40)
  br label %if.end.1

if.else:
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$arr.f64$fn.7.byFirst(%struct.nish_array* %xs, %struct.nish_array* %41, i32 %42, i32 %43)
  br label %if.end.1

if.end.1:
  %44 = load i1, i1* %inTmp.addr, align 1
  %45 = xor i1 %44, true
  store i1 %45, i1* %inTmp.addr, align 1
  %46 = load i32, i32* %width.addr, align 4
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = call i32 @nish.stepTo(i32 %46, i32 %47, i32 %48)
  store i32 %49, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %50 = load i1, i1* %inTmp.addr, align 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %52 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$arr.f64(%struct.nish_array* %51, %struct.nish_array* %xs, i32 0, i32 %52)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 9007199254740992
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %10, %struct.nish_array** %tmp.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %xs, %struct.nish_array* %16, i32 0, i32 %17)
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %18 = load i32, i32* %lo.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %lo.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.cond ], [ %22, %land.rhs ]
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load i32, i32* %lo.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i32 @nish.stepTo(i32 %24, i32 32, i32 %25)
  store i32 %26, i32* %hi.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %28 = load i32, i32* %lo.addr, align 4
  %29 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow2(%struct.nish_array* %27, %struct.nish_array* %xs, i32 %28, i32 %29)
  %30 = load i32, i32* %hi.addr, align 4
  store i32 %30, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %width.addr, align 4
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %width.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %while.body.1, label %while.end.1

while.body.1:
  %37 = load i1, i1* %inTmp.addr, align 1
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  %38 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow2(%struct.nish_array* %38, %struct.nish_array* %xs, i32 %39, i32 %40)
  br label %if.end.1

if.else:
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow2(%struct.nish_array* %xs, %struct.nish_array* %41, i32 %42, i32 %43)
  br label %if.end.1

if.end.1:
  %44 = load i1, i1* %inTmp.addr, align 1
  %45 = xor i1 %44, true
  store i1 %45, i1* %inTmp.addr, align 1
  %46 = load i32, i32* %width.addr, align 4
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = call i32 @nish.stepTo(i32 %46, i32 %47, i32 %48)
  store i32 %49, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %50 = load i1, i1* %inTmp.addr, align 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %52 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %51, %struct.nish_array* %xs, i32 0, i32 %52)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = icmp ule i64 %7, 9007199254740992
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %10, %struct.nish_array** %tmp.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %xs, %struct.nish_array* %16, i32 0, i32 %17)
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %18 = load i32, i32* %lo.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %lo.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.cond ], [ %22, %land.rhs ]
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load i32, i32* %lo.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = call i32 @nish.stepTo(i32 %24, i32 32, i32 %25)
  store i32 %26, i32* %hi.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %28 = load i32, i32* %lo.addr, align 4
  %29 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow3(%struct.nish_array* %27, %struct.nish_array* %xs, i32 %28, i32 %29)
  %30 = load i32, i32* %hi.addr, align 4
  store i32 %30, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %width.addr, align 4
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %width.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %while.body.1, label %while.end.1

while.body.1:
  %37 = load i1, i1* %inTmp.addr, align 1
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  %38 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow3(%struct.nish_array* %38, %struct.nish_array* %xs, i32 %39, i32 %40)
  br label %if.end.1

if.else:
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %n.addr, align 4
  %43 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow3(%struct.nish_array* %xs, %struct.nish_array* %41, i32 %42, i32 %43)
  br label %if.end.1

if.end.1:
  %44 = load i1, i1* %inTmp.addr, align 1
  %45 = xor i1 %44, true
  store i1 %45, i1* %inTmp.addr, align 1
  %46 = load i32, i32* %width.addr, align 4
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = call i32 @nish.stepTo(i32 %46, i32 %47, i32 %48)
  store i32 %49, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %50 = load i1, i1* %inTmp.addr, align 1
  br i1 %50, label %if.then.2, label %if.end.2

if.then.2:
  %51 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %52 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %51, %struct.nish_array* %xs, i32 0, i32 %52)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal void @nish.copyRun$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = sitofp i64 %1 to double
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  %16 = icmp slt i32 %13, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %land.end.2 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %k.addr, align 4
  %19 = sitofp i64 %5 to double
  %20 = call i32 @llvm.fptosi.sat.i32.f64(double %19)
  %21 = icmp slt i32 %18, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %3 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %26
  %29 = load double, double* %28, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = bitcast i8* %7 to double*
  %31 = getelementptr inbounds double, double* %30, i64 %24
  store double %29, double* %31, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = call double @nish_main$arrow0(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %123 = call double @nish_main$arrow0(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = call double @nish_main$arrow1(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %123 = call double @nish_main$arrow1(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$arr.f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = sitofp i64 %1 to double
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  %16 = icmp slt i32 %13, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %land.end.2 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %k.addr, align 4
  %19 = sitofp i64 %5 to double
  %20 = call i32 @llvm.fptosi.sat.i32.f64(double %19)
  %21 = icmp slt i32 %18, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %3 to %struct.nish_array**
  %28 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %27, i64 %26
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = bitcast i8* %7 to %struct.nish_array**
  %31 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %30, i64 %24
  store %struct.nish_array* %29, %struct.nish_array** %31, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.insertionRun$arr.f64$fn.7.byFirst(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to %struct.nish_array**
  %20 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %19, i64 %18
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to %struct.nish_array**
  %25 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %24, i64 %23
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = call double @byFirst$(%struct.nish_array* %21, %struct.nish_array* %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to %struct.nish_array**
  %66 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %65, i64 %64
  %67 = load %struct.nish_array*, %struct.nish_array** %66, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = bitcast i8* %38 to %struct.nish_array**
  %69 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %68, i64 %62
  store %struct.nish_array* %67, %struct.nish_array** %69, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to %struct.nish_array**
  %116 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %115, i64 %114
  %117 = load %struct.nish_array*, %struct.nish_array** %116, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to %struct.nish_array**
  %121 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %120, i64 %119
  %122 = load %struct.nish_array*, %struct.nish_array** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %123 = call double @byFirst$(%struct.nish_array* %117, %struct.nish_array* %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to %struct.nish_array**
  %144 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %143, i64 %142
  %145 = load %struct.nish_array*, %struct.nish_array** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %146 = bitcast i8* %91 to %struct.nish_array**
  %147 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %146, i64 %140
  store %struct.nish_array* %145, %struct.nish_array** %147, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to %struct.nish_array**
  %166 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %165, i64 %164
  %167 = load %struct.nish_array*, %struct.nish_array** %166, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %168 = bitcast i8* %77 to %struct.nish_array**
  %169 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %168, i64 %162
  store %struct.nish_array* %167, %struct.nish_array** %169, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @nish.mergePass$arr.f64$fn.7.byFirst(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$arr.f64$fn.7.byFirst(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = call double @nish_main$arrow2(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %123 = call double @nish_main$arrow2(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow2(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = call double @nish_main$arrow3(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %123 = call double @nish_main$arrow3(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow3(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = call double @nish_main$arrow0(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %79 = call double @nish_main$arrow0(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = call double @nish_main$arrow1(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %79 = call double @nish_main$arrow1(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$arr.f64$fn.7.byFirst(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to %struct.nish_array**
  %21 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %20, i64 %17
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to %struct.nish_array**
  %27 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %26, i64 %23
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = call double @byFirst$(%struct.nish_array* %22, %struct.nish_array* %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$arr.f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to %struct.nish_array**
  %72 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %71, i64 %70
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to %struct.nish_array**
  %77 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %76, i64 %75
  %78 = load %struct.nish_array*, %struct.nish_array** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %79 = call double @byFirst$(%struct.nish_array* %73, %struct.nish_array* %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to %struct.nish_array**
  %99 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %98, i64 %97
  %100 = load %struct.nish_array*, %struct.nish_array** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %101 = bitcast i8* %40 to %struct.nish_array**
  %102 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %101, i64 %95
  store %struct.nish_array* %100, %struct.nish_array** %102, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to %struct.nish_array**
  %122 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %121, i64 %120
  %123 = load %struct.nish_array*, %struct.nish_array** %122, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %124 = bitcast i8* %40 to %struct.nish_array**
  %125 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %124, i64 %118
  store %struct.nish_array* %123, %struct.nish_array** %125, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = call double @nish_main$arrow2(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %79 = call double @nish_main$arrow2(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = call double @nish_main$arrow3(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %79 = call double @nish_main$arrow3(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
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
!12 = !{!"element double", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
