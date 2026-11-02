%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 64)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %6, align 8, !tbaa !15
  ret void
}

define internal noundef i32 @scan(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h, i32 noundef %stop) #1 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %v.addr = alloca <16 x i8>, align 8
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %buf.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %2 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp slt i32 %7, %stop
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end.1

land.end.1:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs.1 ]
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %18 = icmp ne i8 %17, 10
  br label %land.end

land.end:
  %19 = phi i1 [ false, %land.end.1 ], [ %18, %land.rhs ]
  br i1 %19, label %while.body, label %while.end

while.body:
  %20 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %25 = load i32, i32* %i.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %i.addr, align 4
  %28 = trunc i64 %22 to i32
  %29 = sub nsw i32 %28, 16
  %30 = icmp sle i32 %27, %29
  br label %land.end.2

land.end.2:
  %31 = phi i1 [ false, %while.cond.1 ], [ %30, %land.rhs.2 ]
  br i1 %31, label %while.body.1, label %while.end.1

while.body.1:
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = add i64 %33, 16
  %35 = icmp ult i64 %33, %22
  %36 = icmp ule i64 %34, %22
  %37 = and i1 %35, %36
  br i1 %37, label %bounds.ok, label %bounds.fail

bounds.fail:
  %38 = add i64 %33, 15
  %39 = select i1 %35, i64 %38, i64 %33
  call void @nish_panic_index(i64 %39, i64 %22)
  unreachable

bounds.ok:
  %40 = bitcast i8* %24 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 %33
  %42 = bitcast i8* %41 to <16 x i8>*
  %43 = load <16 x i8>, <16 x i8>* %42, align 1
  store <16 x i8> %43, <16 x i8>* %v.addr, align 8
  %44 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %45 = extractelement <16 x i8> %44, i32 0
  %46 = icmp eq i8 %45, 10
  br i1 %46, label %if.then, label %if.end

if.then:
  br label %while.end.1

if.end:
  %47 = load i32, i32* %i.addr, align 4
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 16)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %49, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %51 = load i32, i32* %i.addr, align 4
  %52 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 1)
  %53 = extractvalue { i32, i1 } %52, 0
  %54 = extractvalue { i32, i1 } %52, 1
  br i1 %54, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %53, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %55 = load i32, i32* %i.addr, align 4
  ret i32 %55

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @fill(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h, i8 noundef %b) #1 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %buf.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %2 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = trunc i64 %4 to i32
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %6 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %15 = icmp ne i8 %14, %b
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %22 = load i32, i32* %i.addr, align 4
  %23 = trunc i64 %19 to i32
  %24 = sub nsw i32 %23, 16
  %25 = icmp sle i32 %22, %24
  br i1 %25, label %while.body.1, label %while.end.1

while.body.1:
  %26 = insertelement <16 x i8> undef, i8 %b, i32 0
  %27 = shufflevector <16 x i8> %26, <16 x i8> undef, <16 x i32> zeroinitializer
  %28 = load i32, i32* %i.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = add i64 %29, 16
  %31 = icmp ult i64 %29, %19
  %32 = icmp ule i64 %30, %19
  %33 = and i1 %31, %32
  br i1 %33, label %bounds.ok, label %bounds.fail

bounds.fail:
  %34 = add i64 %29, 15
  %35 = select i1 %31, i64 %34, i64 %29
  call void @nish_panic_index(i64 %35, i64 %19)
  unreachable

bounds.ok:
  %36 = bitcast i8* %21 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %29
  %38 = bitcast i8* %37 to <16 x i8>*
  store <16 x i8> %27, <16 x i8>* %38, align 1
  %39 = load i32, i32* %i.addr, align 4
  %40 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 16)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %41, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %43 = load i32, i32* %i.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 1)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %45, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %0 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 40, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 40, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i8*
  %9 = getelementptr inbounds i8, i8* %8, i64 40
  store i8 10, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %11 = call i32 @scan(%struct.Holder* %10, i32 64)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %13, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 32, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 32, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 32
  store i8 10, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %23 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %24 = call i32 @scan(%struct.Holder* %23, i32 64)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  call void @fill(%struct.Holder* %26, i8 7)
  %27 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %28 = getelementptr inbounds %struct.Holder, %struct.Holder* %27, i32 0, i32 0
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !15
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 0, %31
  br i1 %32, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %31)
  unreachable

bounds.ok.2:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 0
  %37 = load i8, i8* %36, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %38 = zext i8 %37 to i64
  %39 = call i8* @nish_str_from_u64(i64 %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %41 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %42 = getelementptr inbounds %struct.Holder, %struct.Holder* %41, i32 0, i32 0
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !15
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 40, %45
  br i1 %46, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 40, i64 %45)
  unreachable

bounds.ok.3:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i8*
  %50 = getelementptr inbounds i8, i8* %49, i64 40
  %51 = load i8, i8* %50, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %52 = zext i8 %51 to i64
  %53 = call i8* @nish_str_from_u64(i64 %52)
  %54 = call i8* @nish_str_concat(i8* %40, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %56 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %57 = getelementptr inbounds %struct.Holder, %struct.Holder* %56, i32 0, i32 0
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !15
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = icmp ult i64 63, %60
  br i1 %61, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 63, i64 %60)
  unreachable

bounds.ok.4:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i8*
  %65 = getelementptr inbounds i8, i8* %64, i64 63
  %66 = load i8, i8* %65, align 1, !alias.scope !4, !noalias !3, !tbaa !17
  %67 = zext i8 %66 to i64
  %68 = call i8* @nish_str_from_u64(i64 %67)
  %69 = call i8* @nish_str_concat(i8* %55, i8* %68)
  call void @nish_print(i8* %69)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
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
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Holder", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i8", !6, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
