%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define internal noundef i32 @sumI32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
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

define internal noundef double @sumF64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %total.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @squares(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = mul i64 %0, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp slt i32 %13, %n
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = load i32, i32* %i.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = mul nsw i32 %17, %18
  %20 = icmp ult i64 %16, %10
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %10)
  unreachable

bounds.ok:
  %21 = bitcast i8* %12 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %16
  store i32 %19, i32* %22, align 4, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @scale(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, double noundef %k) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = mul i64 %3, 8
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %5, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %20 = load i32, i32* %i.addr, align 4
  %21 = trunc i64 %12 to i32
  %22 = icmp slt i32 %20, %21
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %14 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %26
  %29 = load double, double* %28, align 8, !alias.scope !4, !noalias !3
  %30 = fmul double %29, %k
  %31 = icmp ult i64 %24, %17
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %24, i64 %17)
  unreachable

bounds.ok:
  %32 = bitcast i8* %19 to double*
  %33 = getelementptr inbounds double, double* %32, i64 %24
  store double %30, double* %33, align 8, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %36
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @widen(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = mul i64 %3, 8
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %5, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %20 = load i32, i32* %i.addr, align 4
  %21 = trunc i64 %12 to i32
  %22 = icmp slt i32 %20, %21
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %14 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %26
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3
  %30 = sext i32 %29 to i64
  %31 = icmp ult i64 %24, %17
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %24, i64 %17)
  unreachable

bounds.ok:
  %32 = bitcast i8* %19 to i64*
  %33 = getelementptr inbounds i64, i64* %32, i64 %24
  store i64 %30, i64* %33, align 8, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %36
}

define noundef i32 @nish_main() #1 {
entry:
  %sq.addr = alloca %struct.nish_array*, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x double], align 8
  %k.addr = alloca double, align 8
  %big.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @squares(i32 5)
  store %struct.nish_array* %0, %struct.nish_array** %sq.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %2 = call i32 @sumI32(%struct.nish_array* %1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = mul i64 3, 8
  %7 = bitcast [3 x double]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ws.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast i8* %11 to double*
  %13 = getelementptr inbounds double, double* %12, i64 0
  store double 0x3FE0000000000000, double* %13, align 8, !alias.scope !4, !noalias !3
  %14 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 1
  store double 0x3FF8000000000000, double* %18, align 8, !alias.scope !4, !noalias !3
  %19 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4
  %22 = bitcast i8* %21 to double*
  %23 = getelementptr inbounds double, double* %22, i64 2
  store double 0x4004000000000000, double* %23, align 8, !alias.scope !4, !noalias !3
  store double 0x4000000000000000, double* %k.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %25 = load double, double* %k.addr, align 8
  %26 = call %struct.nish_array* @scale(%struct.nish_array* %24, double %25)
  %27 = call double @sumF64(%struct.nish_array* %26)
  %28 = call i8* @nish_str_from_f64(double %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %30 = call %struct.nish_array* @widen(%struct.nish_array* %29)
  store %struct.nish_array* %30, %struct.nish_array** %big.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = icmp ult i64 4, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 4, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4
  %37 = bitcast i8* %36 to i64*
  %38 = getelementptr inbounds i64, i64* %37, i64 4
  %39 = load i64, i64* %38, align 8, !alias.scope !4, !noalias !3
  %40 = mul nsw i64 %39, 1000000000000
  %41 = call i8* @nish_str_from_i64(i64 %40)
  call void @nish_print(i8* %41)
  %42 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4
  %45 = trunc i64 %44 to i32
  %46 = call i8* @nish_str_from_i32(i32 %45)
  call void @nish_print(i8* %46)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
