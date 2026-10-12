%struct.Weights = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"nish\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.scaledBy$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.15.weighted$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.Weights* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 noundef, i8* noundef, i32 noundef) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, i32 noundef) #0
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
  %Weights.obj = alloca %struct.Weights, align 8
  %m.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %by.addr = alloca %struct.nish_array*, align 8
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
  %42 = getelementptr inbounds %struct.Weights, %struct.Weights* %Weights.obj, i32 0, i32 0
  store i32 3, i32* %42, align 4, !tbaa !17
  store %struct.Weights* %Weights.obj, %struct.Weights** %w.addr, align 8
  store i32 7, i32* %m.addr, align 4
  %43 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %44 = load i32, i32* %m.addr, align 4
  %45 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %43, i32 0, i32 %44)
  store i32 %45, i32* %sum.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = call %struct.nish_array* @scaledBy(%struct.nish_array* %46, i32 5)
  store %struct.nish_array* %47, %struct.nish_array** %by.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = icmp ult i64 3, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 3
  %56 = load i32, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %59 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp ult i64 0, %61
  br i1 %62, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %61)
  unreachable

bounds.ok.1:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 0
  %67 = load i32, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %58, i8* %68)
  %70 = call i8* @nish_str_concat(i8* %69, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %71 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 3, %73
  br i1 %74, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 3, i64 %73)
  unreachable

bounds.ok.2:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 3
  %79 = load i32, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %70, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %83 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = icmp ult i64 0, %85
  br i1 %86, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %85)
  unreachable

bounds.ok.3:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %89 = bitcast i8* %88 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 0
  %91 = load i32, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %82, i8* %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %95 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = icmp ult i64 3, %97
  br i1 %98, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 3, i64 %97)
  unreachable

bounds.ok.4:
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = bitcast i8* %100 to i32*
  %102 = getelementptr inbounds i32, i32* %101, i64 3
  %103 = load i32, i32* %102, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %104 = call i8* @nish_str_from_i32(i32 %103)
  %105 = call i8* @nish_str_concat(i8* %94, i8* %104)
  %106 = call i8* @nish_str_concat(i8* %105, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %107 = load i32, i32* %sum.addr, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %106, i8* %108)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %111 = load %struct.nish_array*, %struct.nish_array** %by.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = icmp ult i64 2, %113
  br i1 %114, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %113)
  unreachable

bounds.ok.5:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = bitcast i8* %116 to i32*
  %118 = getelementptr inbounds i32, i32* %117, i64 2
  %119 = load i32, i32* %118, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* %110, i8* %120)
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %123 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %124 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %125 = call i32 @weighted(%struct.Weights* %123, %struct.nish_array* %124)
  %126 = call i8* @nish_str_from_i32(i32 %125)
  %127 = call i8* @nish_str_concat(i8* %122, i8* %126)
  call void @nish_print(i8* %127)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
