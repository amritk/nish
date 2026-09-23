%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"banana\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

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

define internal noundef i32 @countCode(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %code) #0 {
entry:
  %n.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = icmp eq i32 %11, %code
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %count.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %count.addr, align 4
  br label %if.end

if.end:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %17 = load i32, i32* %count.addr, align 4
  ret i32 %17
}

define internal noundef i32 @dot(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %xn.addr = alloca i32, align 4
  %yn.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %xn.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %yn.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = load i32, i32* %xn.addr, align 4
  %12 = icmp slt i32 %10, %11
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %yn.addr, align 4
  %15 = icmp slt i32 %13, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %total.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %7 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %9 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3
  %28 = mul nsw i32 %22, %27
  %29 = add nsw i32 %17, %28
  store i32 %29, i32* %total.addr, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %total.addr, align 4
  ret i32 %32
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @tails(i8* noundef nonnull noalias readonly align 8 nocapture %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %from) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %from, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %from, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3
  store i32 %13, i32* %k.addr, align 4
  %14 = load i32, i32* %k.addr, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load i32, i32* %k.addr, align 4
  %17 = bitcast i8* %s to i64*
  %18 = load i64, i64* %17, align 8
  %19 = trunc i64 %18 to i32
  %20 = icmp sle i32 %16, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %forof.body ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %23 = bitcast i8* %s to i64*
  %24 = load i64, i64* %23, align 8
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = call i64 @llvm.smin.i64(i64 %26, i64 %24)
  %28 = call i64 @llvm.smax.i64(i64 %26, i64 %24)
  %29 = sub i64 %28, %27
  %30 = getelementptr inbounds i8, i8* %s, i64 8
  %31 = getelementptr inbounds i8, i8* %30, i64 %27
  %32 = call i8* @nish_str_new(i8* %31, i64 %29)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 8)
  br label %push.store

push.store:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 %34
  store i8* %32, i8** %41, align 8, !alias.scope !4, !noalias !3
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !3, !noalias !4
  %43 = trunc i64 %42 to i32
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %44 = load i64, i64* %forof.idx, align 8
  %45 = add i64 %44, 1
  store i64 %45, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %46 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %46
}

define noundef i32 @nish_main() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [5 x i32], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call i32 @countCode(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i32 97)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast [3 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast [2 x i32]* %arr.data.1 to i8*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 4, i32* %15, align 4, !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds i32, i32* %14, i64 1
  store i32 5, i32* %16, align 4, !alias.scope !4, !noalias !3
  %17 = call i32 @dot(%struct.nish_array* %arr.hdr, %struct.nish_array* %arr.hdr.1)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = sub nsw i32 0, 1
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 5, i64* %20, align 8, !alias.scope !3, !noalias !4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 5, i64* %21, align 8, !alias.scope !3, !noalias !4
  %22 = bitcast [5 x i32]* %arr.data.2 to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4
  %24 = bitcast i8* %22 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  store i32 0, i32* %25, align 4, !alias.scope !4, !noalias !3
  %26 = getelementptr inbounds i32, i32* %24, i64 1
  store i32 2, i32* %26, align 4, !alias.scope !4, !noalias !3
  %27 = getelementptr inbounds i32, i32* %24, i64 2
  store i32 3, i32* %27, align 4, !alias.scope !4, !noalias !3
  %28 = getelementptr inbounds i32, i32* %24, i64 3
  store i32 4, i32* %28, align 4, !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds i32, i32* %24, i64 4
  store i32 %19, i32* %29, align 4, !alias.scope !4, !noalias !3
  %30 = call %struct.nish_array* @tails(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), %struct.nish_array* %arr.hdr.2)
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4
  %33 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %34 = load i64, i64* %33, align 8
  %35 = sub i64 %32, 1
  %36 = mul i64 %34, %35
  %37 = icmp eq i64 %32, 0
  %38 = select i1 %37, i64 0, i64 %36
  store i64 %38, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %39 = load i64, i64* %join.at, align 8
  %40 = icmp ult i64 %39, %32
  br i1 %40, label %join.sum.body, label %join.copy

join.sum.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4
  %43 = bitcast i8* %42 to i8**
  %44 = getelementptr inbounds i8*, i8** %43, i64 %39
  %45 = load i8*, i8** %44, align 8, !alias.scope !4, !noalias !3
  %46 = load i64, i64* %join.total, align 8
  %47 = bitcast i8* %45 to i64*
  %48 = load i64, i64* %47, align 8
  %49 = add i64 %46, %48
  store i64 %49, i64* %join.total, align 8
  %50 = add i64 %39, 1
  store i64 %50, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %51 = load i64, i64* %join.total, align 8
  %52 = add i64 %51, 9
  %53 = call i8* @nish_alloc_struct(i64 %52)
  %54 = bitcast i8* %53 to i64*
  store i64 %51, i64* %54, align 8
  %55 = getelementptr inbounds i8, i8* %53, i64 8
  store i8* %55, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %56 = load i64, i64* %join.at, align 8
  %57 = icmp ult i64 %56, %32
  br i1 %57, label %join.part, label %join.end

join.part:
  %58 = load i8*, i8** %join.p, align 8
  %59 = icmp eq i64 %56, 0
  %60 = select i1 %59, i64 0, i64 %34
  %61 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %58, i8* %61, i64 %60, i1 false)
  %62 = getelementptr inbounds i8, i8* %58, i64 %60
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4
  %65 = bitcast i8* %64 to i8**
  %66 = getelementptr inbounds i8*, i8** %65, i64 %56
  %67 = load i8*, i8** %66, align 8, !alias.scope !4, !noalias !3
  %68 = bitcast i8* %67 to i64*
  %69 = load i64, i64* %68, align 8
  %70 = getelementptr inbounds i8, i8* %67, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %62, i8* %70, i64 %69, i1 false)
  %71 = getelementptr inbounds i8, i8* %62, i64 %69
  store i8* %71, i8** %join.p, align 8
  %72 = add i64 %56, 1
  store i64 %72, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %73 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %73, align 1
  call void @nish_print(i8* %53)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
