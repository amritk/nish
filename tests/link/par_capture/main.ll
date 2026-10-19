%struct.Weights = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"nish\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.21.Weights.scaled$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.Weights* noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.13.lookUp$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.scaledBy$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.weighted$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.Weights* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 noundef, i8* noundef, i32 noundef) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.19.offsetBy$f64$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef, %struct.nish_array* noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal noundef i32 @Weights.scaled(%struct.Weights* noundef nonnull align 8 dereferenceable(4) %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %self.addr = alloca %struct.Weights*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store %struct.Weights* %this, %struct.Weights** %self.addr, align 8
  %0 = load %struct.Weights*, %struct.Weights** %self.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.21.Weights.scaled$arrow0(%struct.nish_array* %xs, %struct.Weights* %0)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9
}

define internal noundef i32 @lookUp(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 0, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.13.lookUp$arrow0(%struct.nish_array* %xs, %struct.nish_array* %9, %struct.nish_array* %table)
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 2, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 2
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %18
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @scaledBy(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.scaledBy$arrow0(%struct.nish_array* %xs, i32 %k)
  ret %struct.nish_array* %0
}

define internal noundef i32 @weighted(%struct.Weights* noundef readonly align 8 nocapture %w, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp ne %struct.Weights* %w, null
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.weighted$arrow0(%struct.nish_array* %xs, %struct.Weights* %w)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 3, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 3
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %k.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [4 x i32], align 8
  %word.addr = alloca i8*, align 8
  %codes.addr = alloca %struct.nish_array*, align 8
  %w.addr = alloca %struct.Weights*, align 8
  %m.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %by.addr = alloca %struct.nish_array*, align 8
  %tag.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [1 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 3, i32* %k.addr, align 4
  store i32 1, i32* %b.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = load i32, i32* %k.addr, align 4
  %11 = load i32, i32* %b.addr, align 4
  %12 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* %9, i32 %10, i32 %11)
  store %struct.nish_array* %12, %struct.nish_array** %ys.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %15 = bitcast [4 x i32]* %arr.data.1 to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 10, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 20, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = getelementptr inbounds i32, i32* %17, i64 2
  store i32 30, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = getelementptr inbounds i32, i32* %17, i64 3
  store i32 40, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %table.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 4, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 4, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %24 = bitcast [4 x i32]* %arr.data.2 to i8*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 0, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = getelementptr inbounds i32, i32* %26, i64 1
  store i32 0, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = getelementptr inbounds i32, i32* %26, i64 2
  store i32 0, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = getelementptr inbounds i32, i32* %26, i64 3
  store i32 0, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %dst.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %34 = load i32, i32* %k.addr, align 4
  call void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %31, %struct.nish_array* %32, %struct.nish_array* %33, i32 %34)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %35 = load i8*, i8** %word.addr, align 8
  %36 = load i32, i32* %b.addr, align 4
  %37 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 4, i8* %35, i32 %36)
  store %struct.nish_array* %37, %struct.nish_array** %codes.addr, align 8
  %38 = call i8* @nish_alloc_struct(i64 4)
  %39 = bitcast i8* %38 to %struct.Weights*
  %40 = getelementptr inbounds %struct.Weights, %struct.Weights* %39, i32 0, i32 0
  store i32 3, i32* %40, align 4, !tbaa !17
  store %struct.Weights* %39, %struct.Weights** %w.addr, align 8
  store i32 7, i32* %m.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %42 = load i32, i32* %m.addr, align 4
  %43 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %41, i32 0, i32 %42)
  store i32 %43, i32* %sum.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %45 = call %struct.nish_array* @scaledBy(%struct.nish_array* %44, i32 5)
  store %struct.nish_array* %45, %struct.nish_array** %by.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = icmp ult i64 3, %48
  br i1 %49, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %48)
  unreachable

bounds.ok:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = bitcast i8* %51 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 3
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = icmp ult i64 0, %59
  br i1 %60, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %59)
  unreachable

bounds.ok.1:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 0
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %56, i8* %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %69 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = icmp ult i64 3, %71
  br i1 %72, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 3, i64 %71)
  unreachable

bounds.ok.2:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 3
  %77 = load i32, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %68, i8* %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %81 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp ult i64 0, %83
  br i1 %84, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %83)
  unreachable

bounds.ok.3:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 0
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %80, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %93 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 3, %95
  br i1 %96, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 3, i64 %95)
  unreachable

bounds.ok.4:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 3
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %92, i8* %102)
  %104 = call i8* @nish_str_concat(i8* %103, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %105 = load i32, i32* %sum.addr, align 4
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %104, i8* %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %109 = load %struct.nish_array*, %struct.nish_array** %by.addr, align 8
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = icmp ult i64 2, %111
  br i1 %112, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %111)
  unreachable

bounds.ok.5:
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %115 = bitcast i8* %114 to i32*
  %116 = getelementptr inbounds i32, i32* %115, i64 2
  %117 = load i32, i32* %116, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %108, i8* %118)
  %120 = call i8* @nish_str_concat(i8* %119, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %121 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %122 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %123 = call i32 @weighted(%struct.Weights* %121, %struct.nish_array* %122)
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %120, i8* %124)
  call void @nish_print(i8* %125)
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 1, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 1, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %128 = bitcast [1 x double]* %arr.data.3 to i8*
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %128, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %130 = bitcast i8* %128 to double*
  %131 = getelementptr inbounds double, double* %130, i64 0
  store double 0x3FF8000000000000, double* %131, align 8, !alias.scope !4, !noalias !3, !tbaa !19
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %tag.addr, align 8
  %132 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %133 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %134 = call i32 @Weights.scaled(%struct.Weights* %132, %struct.nish_array* %133)
  %135 = call i8* @nish_str_from_i32(i32 %134)
  %136 = call i8* @nish_str_concat(i8* %135, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %137 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %138 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %139 = call i32 @lookUp(%struct.nish_array* %137, %struct.nish_array* %138)
  %140 = call i8* @nish_str_from_i32(i32 %139)
  %141 = call i8* @nish_str_concat(i8* %136, i8* %140)
  %142 = call i8* @nish_str_concat(i8* %141, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %143 = load %struct.nish_array*, %struct.nish_array** %tag.addr, align 8
  %144 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %145 = call i32 @offsetBy$f64(%struct.nish_array* %143, %struct.nish_array* %144)
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %142, i8* %146)
  call void @nish_print(i8* %147)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @Weights.scaled$arrow0(i32 noundef %x, %struct.Weights* noundef nonnull readonly align 8 dereferenceable(4) nocapture %self) #0 {
entry:
  %0 = getelementptr inbounds %struct.Weights, %struct.Weights* %self, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !17
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @lookUp$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table) #0 {
entry:
  %0 = srem i32 %x, 4
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %9
}

define hidden noundef i32 @scaledBy$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @weighted$arrow0(i32 noundef %x, %struct.Weights* noundef nonnull readonly align 8 dereferenceable(4) nocapture %w) #0 {
entry:
  %0 = getelementptr inbounds %struct.Weights, %struct.Weights* %w, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !17
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %x, i32 noundef %k, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %b)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %k) #0 {
entry:
  %0 = srem i32 %x, 4
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 %k)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow2(i32 noundef %i, i8* noundef nonnull noalias readonly align 8 nocapture %word, i32 noundef %b) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %word to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %word, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %b)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow3(i32 noundef %acc, i32 noundef %y, i32 noundef %m) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %acc, i32 %y)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = icmp eq i32 %m, 0
  %4 = icmp eq i32 %1, -2147483648
  %5 = icmp eq i32 %m, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = srem i32 %1, %m
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @offsetBy$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %tag, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 5, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 6, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %9 = bitcast [4 x i32]* %arr.data.1 to i8*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %9 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  store i32 0, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = getelementptr inbounds i32, i32* %11, i64 1
  store i32 0, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = getelementptr inbounds i32, i32* %11, i64 2
  store i32 0, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = getelementptr inbounds i32, i32* %11, i64 3
  store i32 0, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %d.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.19.offsetBy$f64$arrow0(%struct.nish_array* %xs, %struct.nish_array* %16, %struct.nish_array* %17, %struct.nish_array* %tag)
  %18 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 3, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 3
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %26
}

define hidden noundef i32 @offsetBy$f64$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %t, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %tag) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %x)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Weights", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"element double", !6, i64 0}
!19 = !{!18, !18, i64 0}
