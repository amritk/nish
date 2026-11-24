%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"slice out of range: [\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c") of length \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare noundef i32 @nish_write_bytes(%struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @ranged(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %2
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @sized(i32 noundef %n) #0 {
entry:
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %2

if.end:
  %6 = sext i32 %n to i64
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 %6, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 %6, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %8
}

define internal noundef nonnull align 8 i8* @word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %start, i32 noundef %end) #1 {
entry:
  %0 = icmp sge i32 %start, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp sle i32 %start, %end
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sle i32 %end, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sext i32 %start to i64
  %9 = sext i32 %end to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = sub i64 %9, %8
  %14 = call i8* @nish_str_new(i8* %12, i64 %13)
  ret i8* %14

if.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define internal noundef nonnull align 8 i8* @lastWord(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf) #1 {
entry:
  %i.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = icmp ne i8 %11, 32
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %16 = load i32, i32* %i.addr, align 4
  store i32 %16, i32* %from.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond.1

while.cond.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = trunc i64 %18 to i32
  %21 = icmp slt i32 %19, %20
  br i1 %21, label %while.body.1, label %while.end.1

while.body.1:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %24 = load i32, i32* %i.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  %28 = icmp sgt i32 %24, %27
  br i1 %28, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  %29 = load i32, i32* %from.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = load i32, i32* %i.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds i8, i8* %34, i64 %30
  %36 = sub i64 %32, %30
  %37 = call i8* @nish_str_new(i8* %35, i64 %36)
  ret i8* %37
}

define internal void @copy(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sle i32 %2, %5
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %12, i8* %16, i64 %8, i1 false), !alias.scope !4, !noalias !3
  br label %if.end

if.end:
  ret void
}

define internal noundef nonnull align 8 i8* @tail(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %k) #0 {
entry:
  %0 = icmp sge i32 %k, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sle i32 %k, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = bitcast i8* %s to i64*
  %7 = load i64, i64* %6, align 8
  %8 = sext i32 %k to i64
  %9 = sub i64 %7, %8
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 %8
  %12 = call i8* @nish_str_new(i8* %11, i64 %9)
  ret i8* %12

if.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @middle(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = icmp sge i32 %a, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp sle i32 %a, %b
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sle i32 %b, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = call %struct.nish_array* @nish.slice$i32(%struct.nish_array* %xs, i32 %a, i32 %b)
  ret %struct.nish_array* %8

if.end:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* null, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %10
}

define internal void @rest(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %off) #1 {
entry:
  %0 = icmp sge i32 %off, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sle i32 %off, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = sext i32 %off to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = sub nsw i32 %9, %off
  %11 = sext i32 %10 to i64
  %12 = call i32 @nish_write_bytes(%struct.nish_array* %buf, i64 %6, i64 %11)
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [9 x i8], align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 9, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [9 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 104, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 105, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 32, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 116, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 104, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 101, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %4, i64 6
  store i8 114, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %4, i64 7
  store i8 101, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8, i8* %4, i64 8
  store i8 10, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %b.addr, align 8
  %14 = call %struct.nish_array* @ranged(i32 5)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = call %struct.nish_array* @sized(i32 7)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @word(%struct.nish_array* %24, i32 3, i32 8)
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %29 = call i64 @nish_arena_mark()
  %30 = call i8* @lastWord(%struct.nish_array* %28)
  %31 = call i8* @nish_arena_keep(i64 %29, i8* %30)
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = call %struct.nish_array* @sized(i32 12)
  store %struct.nish_array* %36, %struct.nish_array** %d.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @copy(%struct.nish_array* %37, %struct.nish_array* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = trunc i64 %41 to i32
  %43 = icmp sgt i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 0
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = zext i8 %49 to i64
  %51 = call i8* @nish_str_from_u64(i64 %50)
  call void @nish_print(i8* %51)
  br label %if.end

if.end:
  %52 = call i64 @nish_arena_mark()
  %53 = call i8* @tail(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i32 2)
  %54 = call i8* @nish_arena_keep(i64 %52, i8* %53)
  call void @nish_print(i8* %54)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = bitcast [4 x i32]* %arr.data.1 to i8*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %57, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %57 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 0
  store i32 1, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %61 = getelementptr inbounds i32, i32* %59, i64 1
  store i32 2, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %62 = getelementptr inbounds i32, i32* %59, i64 2
  store i32 3, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %63 = getelementptr inbounds i32, i32* %59, i64 3
  store i32 4, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %xs.addr, align 8
  %64 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %65 = call %struct.nish_array* @middle(%struct.nish_array* %64, i32 1, i32 3)
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = call i8* @nish_str_from_i32(i32 %68)
  call void @nish_print(i8* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @rest(%struct.nish_array* %70, i32 3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.slice$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %start, i32 noundef %end) #1 {
entry:
  %from.addr = alloca i64, align 8
  %to.addr = alloca i64, align 8
  %len.addr = alloca i64, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %start to i64
  store i64 %0, i64* %from.addr, align 8
  %1 = sext i32 %end to i64
  store i64 %1, i64* %to.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = sext i32 %4 to i64
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
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.2 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*))
  %20 = load i64, i64* %to.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*))
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
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %44 = trunc i64 %43 to i32
  %45 = icmp slt i32 %41, %44
  br label %land.end

land.end:
  %46 = phi i1 [ false, %land.end.1 ], [ %45, %land.rhs ]
  br i1 %46, label %for.body, label %for.end

for.body:
  %47 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %48 = load i32, i32* %i.addr, align 4
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 %49
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = icmp eq i64 %56, %58
  br i1 %59, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store

push.store:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %56
  store i32 %54, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %64 = add i64 %56, 1
  store i64 %64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = trunc i64 %64 to i32
  br label %for.inc

for.inc:
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %68 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %68
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
