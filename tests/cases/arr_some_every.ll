%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1

define void @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %seen.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 7, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 5, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %seen.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %17 = call i1 @nish.some$i32$fn.16.nish_main$arrow0(%struct.nish_array* %15, %struct.nish_array* %16)
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %20 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %19, i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %28 = call i1 @nish.every$i32$fn.16.nish_main$arrow1(%struct.nish_array* %26, %struct.nish_array* %27)
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %31 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %30, i8* %35)
  call void @nish_print(i8* %36)
  %37 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %38 = call i1 @nish.every$i32$fn.16.nish_main$arrow2(%struct.nish_array* %37)
  %39 = select i1 %38, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %41 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %42 = call i1 @nish.some$i32$fn.16.nish_main$arrow3(%struct.nish_array* %41)
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %44 = call i8* @nish_str_concat(i8* %40, i8* %43)
  call void @nish_print(i8* %44)
  %45 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %46 = call i1 @nish.someIndexed$i32$fn.16.nish_main$arrow4(%struct.nish_array* %45)
  %47 = select i1 %46, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %49 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %50 = call i1 @nish.everyIndexed$i32$fn.16.nish_main$arrow5(%struct.nish_array* %49)
  %51 = select i1 %50, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %52 = call i8* @nish_str_concat(i8* %48, i8* %51)
  call void @nish_print(i8* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %54 = call i1 @nish.some$i32$fn.16.nish_main$arrow6(%struct.nish_array* %53)
  %55 = select i1 %54, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %58 = call i1 @nish.every$i32$fn.16.nish_main$arrow7(%struct.nish_array* %57)
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %60 = call i8* @nish_str_concat(i8* %56, i8* %59)
  call void @nish_print(i8* %60)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden noundef zeroext i1 @nish_main$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %seen) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %seen, i64 4)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 %x, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sgt i32 %x, 4
  ret i1 %11
}

define hidden noundef zeroext i1 @nish_main$arrow1(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %seen) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %seen, i64 4)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %seen, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 %x, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %x, 2
  ret i1 %11
}

define hidden noundef zeroext i1 @nish_main$arrow2(i32 noundef %x) #2 {
entry:
  %0 = icmp sgt i32 %x, 0
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow3(i32 noundef %x) #2 {
entry:
  %0 = icmp sgt i32 %x, 9
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow4(i32 noundef %x, i32 noundef %i) #2 {
entry:
  %0 = icmp eq i32 %x, %i
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow5(i32 noundef %x, i32 noundef %i) #2 {
entry:
  %0 = icmp sgt i32 %x, %i
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow6(i32 noundef %x) #2 {
entry:
  %0 = icmp sgt i32 %x, 0
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow7(i32 noundef %x) #2 {
entry:
  %0 = icmp sgt i32 %x, 0
  ret i1 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef zeroext i1 @nish.some$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs ]
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow0(i32 %18, %struct.nish_array* %cap.0)
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef zeroext i1 @nish.every$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs ]
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow1(i32 %18, %struct.nish_array* %cap.0)
  %20 = xor i1 %19, true
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef zeroext i1 @nish.every$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow2(i32 %18)
  %20 = xor i1 %19, true
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef zeroext i1 @nish.some$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow3(i32 %18)
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef zeroext i1 @nish.someIndexed$i32$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = load i32, i32* %i.addr, align 4
  %20 = call i1 @nish_main$arrow4(i32 %18, i32 %19)
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef zeroext i1 @nish.everyIndexed$i32$fn.16.nish_main$arrow5(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = load i32, i32* %i.addr, align 4
  %20 = call i1 @nish_main$arrow5(i32 %18, i32 %19)
  %21 = xor i1 %20, true
  br i1 %21, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef zeroext i1 @nish.some$i32$fn.16.nish_main$arrow6(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow6(i32 %18)
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef zeroext i1 @nish.every$i32$fn.16.nish_main$arrow7(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow7(i32 %18)
  %20 = xor i1 %19, true
  br i1 %20, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }

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
