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
  ret i32 %9
}

define internal noundef i32 @lookUp(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %dst.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.13.lookUp$arrow0(%struct.nish_array* %xs, %struct.nish_array* %11, %struct.nish_array* %table)
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 2, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 2
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %20
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @scaledBy(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %0 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.scaledBy$arrow0(%struct.nish_array* %xs, i32 %k)
  ret %struct.nish_array* %0
}

define internal noundef i32 @weighted(%struct.Weights* noundef readonly align 8 nocapture %w, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
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
  ret i32 %9

if.end:
  ret i32 -1
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %word.addr = alloca i8*, align 8
  %codes.addr = alloca %struct.nish_array*, align 8
  %w.addr = alloca %struct.Weights*, align 8
  %m.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %by.addr = alloca %struct.nish_array*, align 8
  %tag.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 3, i32* %k.addr, align 4
  store i32 1, i32* %b.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = load i32, i32* %k.addr, align 4
  %13 = load i32, i32* %b.addr, align 4
  %14 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* %11, i32 %12, i32 %13)
  store %struct.nish_array* %14, %struct.nish_array** %ys.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = bitcast [4 x i32]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 10, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = getelementptr inbounds i32, i32* %19, i64 1
  store i32 20, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = getelementptr inbounds i32, i32* %19, i64 2
  store i32 30, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = getelementptr inbounds i32, i32* %19, i64 3
  store i32 40, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 4, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 4, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %28 = call i8* @nish_alloc_struct(i64 16)
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %28 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  store i32 0, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = getelementptr inbounds i32, i32* %30, i64 1
  store i32 0, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %33 = getelementptr inbounds i32, i32* %30, i64 2
  store i32 0, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %34 = getelementptr inbounds i32, i32* %30, i64 3
  store i32 0, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %25, %struct.nish_array** %dst.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %38 = load i32, i32* %k.addr, align 4
  call void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %35, %struct.nish_array* %36, %struct.nish_array* %37, i32 %38)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %39 = load i8*, i8** %word.addr, align 8
  %40 = load i32, i32* %b.addr, align 4
  %41 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 4, i8* %39, i32 %40)
  store %struct.nish_array* %41, %struct.nish_array** %codes.addr, align 8
  %42 = call i8* @nish_alloc_struct(i64 4)
  %43 = bitcast i8* %42 to %struct.Weights*
  %44 = getelementptr inbounds %struct.Weights, %struct.Weights* %43, i32 0, i32 0
  store i32 3, i32* %44, align 4, !tbaa !17
  store %struct.Weights* %43, %struct.Weights** %w.addr, align 8
  store i32 7, i32* %m.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %46 = load i32, i32* %m.addr, align 4
  %47 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %45, i32 0, i32 %46)
  store i32 %47, i32* %sum.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = call %struct.nish_array* @scaledBy(%struct.nish_array* %48, i32 5)
  store %struct.nish_array* %49, %struct.nish_array** %by.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 3, %52
  br i1 %53, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %52)
  unreachable

bounds.ok:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 3
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %61 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = icmp ult i64 0, %63
  br i1 %64, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %63)
  unreachable

bounds.ok.1:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 0
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = call i8* @nish_str_from_i32(i32 %69)
  %71 = call i8* @nish_str_concat(i8* %60, i8* %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %73 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = icmp ult i64 3, %75
  br i1 %76, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 3, i64 %75)
  unreachable

bounds.ok.2:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 3
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %82 = call i8* @nish_str_from_i32(i32 %81)
  %83 = call i8* @nish_str_concat(i8* %72, i8* %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %85 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 0, %87
  br i1 %88, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %87)
  unreachable

bounds.ok.3:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 0
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %84, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %97 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = icmp ult i64 3, %99
  br i1 %100, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 3, i64 %99)
  unreachable

bounds.ok.4:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 3
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %96, i8* %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %109 = load i32, i32* %sum.addr, align 4
  %110 = call i8* @nish_str_from_i32(i32 %109)
  %111 = call i8* @nish_str_concat(i8* %108, i8* %110)
  %112 = call i8* @nish_str_concat(i8* %111, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %113 = load %struct.nish_array*, %struct.nish_array** %by.addr, align 8
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 0
  %115 = load i64, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = icmp ult i64 2, %115
  br i1 %116, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %115)
  unreachable

bounds.ok.5:
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %119 = bitcast i8* %118 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 2
  %121 = load i32, i32* %120, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %122 = call i8* @nish_str_from_i32(i32 %121)
  %123 = call i8* @nish_str_concat(i8* %112, i8* %122)
  %124 = call i8* @nish_str_concat(i8* %123, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %125 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %126 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %127 = call i32 @weighted(%struct.Weights* %125, %struct.nish_array* %126)
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %124, i8* %128)
  call void @nish_print(i8* %129)
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %132 = bitcast [1 x double]* %arr.data.1 to i8*
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %132, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %134 = bitcast i8* %132 to double*
  %135 = getelementptr inbounds double, double* %134, i64 0
  store double 0x3FF8000000000000, double* %135, align 8, !alias.scope !4, !noalias !3, !tbaa !19
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %tag.addr, align 8
  %136 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %137 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %138 = call i32 @Weights.scaled(%struct.Weights* %136, %struct.nish_array* %137)
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %139, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %141 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %142 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %143 = call i32 @lookUp(%struct.nish_array* %141, %struct.nish_array* %142)
  %144 = call i8* @nish_str_from_i32(i32 %143)
  %145 = call i8* @nish_str_concat(i8* %140, i8* %144)
  %146 = call i8* @nish_str_concat(i8* %145, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %147 = load %struct.nish_array*, %struct.nish_array** %tag.addr, align 8
  %148 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %149 = call i32 @offsetBy$f64(%struct.nish_array* %147, %struct.nish_array* %148)
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* %146, i8* %150)
  call void @nish_print(i8* %151)
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
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 4, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 4, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %11 = call i8* @nish_alloc_struct(i64 16)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 0, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 0, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = getelementptr inbounds i32, i32* %13, i64 2
  store i32 0, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = getelementptr inbounds i32, i32* %13, i64 3
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %8, %struct.nish_array** %d.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.19.offsetBy$f64$arrow0(%struct.nish_array* %xs, %struct.nish_array* %18, %struct.nish_array* %19, %struct.nish_array* %tag)
  %20 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ult i64 3, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 3
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %28
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
