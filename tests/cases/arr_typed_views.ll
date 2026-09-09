%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_free_arena() #3
declare noundef i64 @amrit_arena_mark() #3
declare void @amrit_arena_release(i64 noundef) #3
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #3
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i64(i64 noundef) #3
declare void @amrit_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @sumI32(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = add nsw i32 %9, %10
  store i32 %11, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i32, i32* %total.addr, align 4
  ret i32 %14
}

define internal noundef double @sumF64(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %total.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %0
  %8 = load double, double* %7, align 8, !alias.scope !4, !noalias !3
  store double %8, double* %x.addr, align 8
  %9 = load double, double* %total.addr, align 8
  %10 = load double, double* %x.addr, align 8
  %11 = fadd double %9, %10
  store double %11, double* %total.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load double, double* %total.addr, align 8
  ret double %14
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.amrit_array* @squares(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.amrit_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = call i8* @amrit_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.amrit_array*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = mul i64 %0, 4
  %6 = call i8* @amrit_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %2, %struct.amrit_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, %n
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = mul nsw i32 %13, %14
  %16 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %10, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = icmp ult i64 %12, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %12, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %10, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %12
  store i32 %15, i32* %22, align 4, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  ret %struct.amrit_array* %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.amrit_array* @scale(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, double noundef %k) #1 {
entry:
  %out.addr = alloca %struct.amrit_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = call i8* @amrit_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.amrit_array*
  %6 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = mul i64 %3, 8
  %9 = call i8* @amrit_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %5, %struct.amrit_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %20
  %28 = load double, double* %27, align 8, !alias.scope !4, !noalias !3
  %29 = fmul double %28, %k
  %30 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4
  %32 = icmp ult i64 %18, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %18, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4
  %35 = bitcast i8* %34 to double*
  %36 = getelementptr inbounds double, double* %35, i64 %18
  store double %29, double* %36, align 8, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  ret %struct.amrit_array* %39
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.amrit_array* @widen(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.amrit_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = call i8* @amrit_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.amrit_array*
  %6 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = mul i64 %3, 8
  %9 = call i8* @amrit_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %5, %struct.amrit_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3
  %29 = sext i32 %28 to i64
  %30 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4
  %32 = icmp ult i64 %18, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %18, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4
  %35 = bitcast i8* %34 to i64*
  %36 = getelementptr inbounds i64, i64* %35, i64 %18
  store i64 %29, i64* %36, align 8, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.amrit_array*, %struct.amrit_array** %out.addr, align 8
  ret %struct.amrit_array* %39
}

define noundef i32 @amrit_main() #1 {
entry:
  %sq.addr = alloca %struct.amrit_array*, align 8
  %ws.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x double], align 8
  %k.addr = alloca double, align 8
  %big.addr = alloca %struct.amrit_array*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call %struct.amrit_array* @squares(i32 5)
  store %struct.amrit_array* %0, %struct.amrit_array** %sq.addr, align 8
  %1 = load %struct.amrit_array*, %struct.amrit_array** %sq.addr, align 8
  %2 = call i32 @sumI32(%struct.amrit_array* %1)
  %3 = call i8* @amrit_str_from_i32(i32 %2)
  call void @amrit_print(i8* %3)
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = mul i64 3, 8
  %7 = bitcast [3 x double]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %ws.addr, align 8
  %9 = load %struct.amrit_array*, %struct.amrit_array** %ws.addr, align 8
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast i8* %14 to double*
  %16 = getelementptr inbounds double, double* %15, i64 0
  store double 0x3FE0000000000000, double* %16, align 8, !alias.scope !4, !noalias !3
  %17 = load %struct.amrit_array*, %struct.amrit_array** %ws.addr, align 8
  %18 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4
  %20 = icmp ult i64 1, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 1, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %17, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4
  %23 = bitcast i8* %22 to double*
  %24 = getelementptr inbounds double, double* %23, i64 1
  store double 0x3FF8000000000000, double* %24, align 8, !alias.scope !4, !noalias !3
  %25 = load %struct.amrit_array*, %struct.amrit_array** %ws.addr, align 8
  %26 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4
  %28 = icmp ult i64 2, %27
  br i1 %28, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 2, i64 %27)
  unreachable

bounds.ok.2:
  %29 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %30 to double*
  %32 = getelementptr inbounds double, double* %31, i64 2
  store double 0x4004000000000000, double* %32, align 8, !alias.scope !4, !noalias !3
  store double 0x4000000000000000, double* %k.addr, align 8
  %33 = load %struct.amrit_array*, %struct.amrit_array** %ws.addr, align 8
  %34 = load double, double* %k.addr, align 8
  %35 = call %struct.amrit_array* @scale(%struct.amrit_array* %33, double %34)
  %36 = call double @sumF64(%struct.amrit_array* %35)
  %37 = call i8* @amrit_str_from_f64(double %36)
  call void @amrit_print(i8* %37)
  %38 = load %struct.amrit_array*, %struct.amrit_array** %sq.addr, align 8
  %39 = call %struct.amrit_array* @widen(%struct.amrit_array* %38)
  store %struct.amrit_array* %39, %struct.amrit_array** %big.addr, align 8
  %40 = load %struct.amrit_array*, %struct.amrit_array** %big.addr, align 8
  %41 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4
  %43 = icmp ult i64 4, %42
  br i1 %43, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 4, i64 %42)
  unreachable

bounds.ok.3:
  %44 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4
  %46 = bitcast i8* %45 to i64*
  %47 = getelementptr inbounds i64, i64* %46, i64 4
  %48 = load i64, i64* %47, align 8, !alias.scope !4, !noalias !3
  %49 = mul nsw i64 %48, 1000000000000
  %50 = call i8* @amrit_str_from_i64(i64 %49)
  call void @amrit_print(i8* %50)
  %51 = load %struct.amrit_array*, %struct.amrit_array** %sq.addr, align 8
  %52 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4
  %54 = trunc i64 %53 to i32
  %55 = call i8* @amrit_str_from_i32(i32 %54)
  call void @amrit_print(i8* %55)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
