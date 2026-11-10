%struct.Item = type { i32, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ann\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bob\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"cy\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define hidden noundef zeroext i1 @isOdd$(i32 noundef %x) #0 {
entry:
  %0 = srem i32 %x, 2
  %1 = icmp eq i32 %0, 1
  ret i1 %1
}

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call %struct.nish_array* @nish.map$i32$str$fn.11.show$arrow0(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, 1
  %6 = mul i64 %4, %5
  %7 = icmp eq i64 %2, 0
  %8 = select i1 %7, i64 0, i64 %6
  store i64 %8, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %9 = load i64, i64* %join.at, align 8
  %10 = icmp ult i64 %9, %2
  br i1 %10, label %join.sum.body, label %join.copy

join.sum.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %9
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = load i64, i64* %join.total, align 8
  %17 = bitcast i8* %15 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = add i64 %16, %18
  store i64 %19, i64* %join.total, align 8
  %20 = add i64 %9, 1
  store i64 %20, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %21 = load i64, i64* %join.total, align 8
  %22 = icmp ugt i64 %21, 2147483647
  %23 = add i64 %21, 9
  %24 = select i1 %22, i64 4611686018427387904, i64 %23
  %25 = call i8* @nish_alloc_struct(i64 %24)
  %26 = bitcast i8* %25 to i64*
  store i64 %21, i64* %26, align 8
  %27 = getelementptr inbounds i8, i8* %25, i64 8
  store i8* %27, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %28 = load i64, i64* %join.at, align 8
  %29 = icmp ult i64 %28, %2
  br i1 %29, label %join.part, label %join.end

join.part:
  %30 = load i8*, i8** %join.p, align 8
  %31 = icmp eq i64 %28, 0
  %32 = select i1 %31, i64 0, i64 %4
  %33 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %30, i8* %33, i64 %32, i1 false)
  %34 = getelementptr inbounds i8, i8* %30, i64 %32
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %28
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = getelementptr inbounds i8, i8* %39, i64 8
  %43 = icmp eq i64 %41, 1
  br i1 %43, label %join.byte, label %join.bulk

join.byte:
  %44 = load i8, i8* %42, align 1
  store i8 %44, i8* %34, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %34, i8* %42, i64 %41, i1 false)
  br label %join.next

join.next:
  %45 = getelementptr inbounds i8, i8* %34, i64 %41
  store i8* %45, i8** %join.p, align 8
  %46 = add i64 %28, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %47 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %47, align 1
  ret i8* %25
}

define void @nish_main() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i32], align 8
  %items.addr = alloca %struct.nish_array*, align 8
  %Item.obj = alloca %struct.Item, align 8
  %Item.obj.1 = alloca %struct.Item, align 8
  %Item.obj.2 = alloca %struct.Item, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x %struct.Item], align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [5 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 5, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 8, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = call %struct.nish_array* @nish.filter$i32$fn.5.isOdd(%struct.nish_array* %10)
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @show(%struct.nish_array* %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = call %struct.nish_array* @nish.filterIndexed$i32$fn.16.nish_main$arrow0(%struct.nish_array* %15)
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @show(%struct.nish_array* %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  call void @nish_print(i8* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = call %struct.nish_array* @nish.filter$i32$fn.16.nish_main$arrow1(%struct.nish_array* %20)
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @show(%struct.nish_array* %21)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @show(%struct.nish_array* %27)
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %26, i8* %30)
  call void @nish_print(i8* %31)
  %32 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj, i32 0, i32 0
  store i32 1, i32* %32, align 4
  %33 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj, i32 0, i32 1
  store i1 true, i1* %33, align 1
  %34 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj.1, i32 0, i32 0
  store i32 2, i32* %34, align 4
  %35 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj.1, i32 0, i32 1
  store i1 false, i1* %35, align 1
  %36 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj.2, i32 0, i32 0
  store i32 3, i32* %36, align 4
  %37 = getelementptr inbounds %struct.Item, %struct.Item* %Item.obj.2, i32 0, i32 1
  store i1 true, i1* %37, align 1
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %40 = bitcast [3 x %struct.Item]* %arr.data.1 to i8*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %40 to %struct.Item*
  %43 = getelementptr inbounds %struct.Item, %struct.Item* %42, i64 0
  %44 = bitcast %struct.Item* %43 to i8*
  %45 = bitcast %struct.Item* %Item.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %44, i8* align 4 %45, i64 8, i1 false), !alias.scope !4, !noalias !3
  %46 = getelementptr inbounds %struct.Item, %struct.Item* %42, i64 1
  %47 = bitcast %struct.Item* %46 to i8*
  %48 = bitcast %struct.Item* %Item.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %47, i8* align 4 %48, i64 8, i1 false), !alias.scope !4, !noalias !3
  %49 = getelementptr inbounds %struct.Item, %struct.Item* %42, i64 2
  %50 = bitcast %struct.Item* %49 to i8*
  %51 = bitcast %struct.Item* %Item.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %50, i8* align 4 %51, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %items.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %53 = call %struct.nish_array* @nish.filter$$Item$fn.16.nish_main$arrow2(%struct.nish_array* %52)
  store %struct.nish_array* %53, %struct.nish_array** %kept.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 0, %56
  br i1 %57, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %56)
  unreachable

bounds.ok:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = bitcast i8* %59 to %struct.Item*
  %61 = getelementptr inbounds %struct.Item, %struct.Item* %60, i64 0
  %62 = getelementptr inbounds %struct.Item, %struct.Item* %61, i32 0, i32 0
  store i32 10, i32* %62, align 4
  %63 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %69 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast i8* %71 to %struct.Item*
  %73 = getelementptr inbounds %struct.Item, %struct.Item* %72, i64 0
  %74 = getelementptr inbounds %struct.Item, %struct.Item* %73, i32 0, i32 0
  %75 = load i32, i32* %74, align 4
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %68, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %79 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = icmp ult i64 1, %81
  br i1 %82, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %81)
  unreachable

bounds.ok.1:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to %struct.Item*
  %86 = getelementptr inbounds %struct.Item, %struct.Item* %85, i64 1
  %87 = getelementptr inbounds %struct.Item, %struct.Item* %86, i32 0, i32 0
  %88 = load i32, i32* %87, align 4
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* %78, i8* %89)
  %91 = call i8* @nish_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %92 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = icmp ult i64 0, %94
  br i1 %95, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %94)
  unreachable

bounds.ok.2:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %98 = bitcast i8* %97 to %struct.Item*
  %99 = getelementptr inbounds %struct.Item, %struct.Item* %98, i64 0
  %100 = getelementptr inbounds %struct.Item, %struct.Item* %99, i32 0, i32 0
  %101 = load i32, i32* %100, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %91, i8* %102)
  call void @nish_print(i8* %103)
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %106 = bitcast [3 x i8*]* %arr.data.2 to i8*
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %106, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %108 = bitcast i8* %106 to i8**
  %109 = getelementptr inbounds i8*, i8** %108, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %109, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %110 = getelementptr inbounds i8*, i8** %108, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8** %110, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %111 = getelementptr inbounds i8*, i8** %108, i64 2
  store i8* bitcast ({ i64, [3 x i8] }* @.str.6 to i8*), i8** %111, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %names.addr, align 8
  %112 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %113 = call %struct.nish_array* @nish.filter$str$fn.16.nish_main$arrow3(%struct.nish_array* %112)
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 0
  %115 = load i64, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*) to i64*
  %117 = load i64, i64* %116, align 8
  %118 = sub i64 %115, 1
  %119 = mul i64 %117, %118
  %120 = icmp eq i64 %115, 0
  %121 = select i1 %120, i64 0, i64 %119
  store i64 %121, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %122 = load i64, i64* %join.at, align 8
  %123 = icmp ult i64 %122, %115
  br i1 %123, label %join.sum.body, label %join.copy

join.sum.body:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = bitcast i8* %125 to i8**
  %127 = getelementptr inbounds i8*, i8** %126, i64 %122
  %128 = load i8*, i8** %127, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %129 = load i64, i64* %join.total, align 8
  %130 = bitcast i8* %128 to i64*
  %131 = load i64, i64* %130, align 8
  %132 = add i64 %129, %131
  store i64 %132, i64* %join.total, align 8
  %133 = add i64 %122, 1
  store i64 %133, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %134 = load i64, i64* %join.total, align 8
  %135 = icmp ugt i64 %134, 2147483647
  %136 = add i64 %134, 9
  %137 = select i1 %135, i64 4611686018427387904, i64 %136
  %138 = call i8* @nish_alloc_struct(i64 %137)
  %139 = bitcast i8* %138 to i64*
  store i64 %134, i64* %139, align 8
  %140 = getelementptr inbounds i8, i8* %138, i64 8
  store i8* %140, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %141 = load i64, i64* %join.at, align 8
  %142 = icmp ult i64 %141, %115
  br i1 %142, label %join.part, label %join.end

join.part:
  %143 = load i8*, i8** %join.p, align 8
  %144 = icmp eq i64 %141, 0
  %145 = select i1 %144, i64 0, i64 %117
  %146 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %143, i8* %146, i64 %145, i1 false)
  %147 = getelementptr inbounds i8, i8* %143, i64 %145
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %149 = load i8*, i8** %148, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %150 = bitcast i8* %149 to i8**
  %151 = getelementptr inbounds i8*, i8** %150, i64 %141
  %152 = load i8*, i8** %151, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %153 = bitcast i8* %152 to i64*
  %154 = load i64, i64* %153, align 8
  %155 = getelementptr inbounds i8, i8* %152, i64 8
  %156 = icmp eq i64 %154, 1
  br i1 %156, label %join.byte, label %join.bulk

join.byte:
  %157 = load i8, i8* %155, align 1
  store i8 %157, i8* %147, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %147, i8* %155, i64 %154, i1 false)
  br label %join.next

join.next:
  %158 = getelementptr inbounds i8, i8* %147, i64 %154
  store i8* %158, i8** %join.p, align 8
  %159 = add i64 %141, 1
  store i64 %159, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %160 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %160, align 1
  call void @nish_print(i8* %138)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden noundef nonnull align 8 i8* @show$arrow0(i32 noundef %x) #2 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  ret i8* %0
}

define hidden noundef zeroext i1 @nish_main$arrow0(i32 noundef %x, i32 noundef %i) #0 {
entry:
  %0 = srem i32 %i, 2
  %1 = icmp eq i32 %0, 0
  ret i1 %1
}

define hidden noundef zeroext i1 @nish_main$arrow1(i32 noundef %x) #0 {
entry:
  %0 = icmp sgt i32 %x, 100
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow2(%struct.Item* noundef nonnull readonly align 4 dereferenceable(8) nocapture %it) #3 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %it, i32 0, i32 1
  %1 = load i1, i1* %0, align 1
  ret i1 %1
}

define hidden noundef zeroext i1 @nish_main$arrow3(i8* noundef nonnull noalias readonly align 8 nocapture %n) #3 {
entry:
  %0 = bitcast i8* %n to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 3
  ret i1 %3
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.map$i32$str$fn.11.show$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @show$arrow0(i32 %24)
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %29
  store i8* %27, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %41
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filter$i32$fn.5.isOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %23, i32* %x.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = call i1 @isOdd$(i32 %24)
  br i1 %25, label %if.then, label %if.end

if.then:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = load i32, i32* %x.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %26, i64 4)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  store i32 %27, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %41
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filterIndexed$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %23, i32* %x.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = load i32, i32* %i.addr, align 4
  %26 = call i1 @nish_main$arrow0(i32 %24, i32 %25)
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %28 = load i32, i32* %x.addr, align 4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %27, i64 4)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %30
  store i32 %28, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %42
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filter$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %18
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %23, i32* %x.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = call i1 @nish_main$arrow1(i32 %24)
  br i1 %25, label %if.then, label %if.end

if.then:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = load i32, i32* %x.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %26, i64 4)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  store i32 %27, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %41
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filter$$Item$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca %struct.Item*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to %struct.Item*
  %22 = getelementptr inbounds %struct.Item, %struct.Item* %21, i64 %18
  store %struct.Item* %22, %struct.Item** %x.addr, align 8
  %23 = load %struct.Item*, %struct.Item** %x.addr, align 8
  %24 = call i1 @nish_main$arrow2(%struct.Item* %23)
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %26 = load %struct.Item*, %struct.Item** %x.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %31 = icmp eq i64 %28, %30
  br i1 %31, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %25, i64 8)
  br label %push.store

push.store:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to %struct.Item*
  %35 = getelementptr inbounds %struct.Item, %struct.Item* %34, i64 %28
  %36 = bitcast %struct.Item* %35 to i8*
  %37 = bitcast %struct.Item* %26 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %36, i8* align 4 %37, i64 8, i1 false), !alias.scope !4, !noalias !3
  %38 = add i64 %28, 1
  store i64 %38, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %42
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.filter$str$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca i8*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %11, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 %18
  %23 = load i8*, i8** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store i8* %23, i8** %x.addr, align 8
  %24 = load i8*, i8** %x.addr, align 8
  %25 = call i1 @nish_main$arrow3(i8* %24)
  br i1 %25, label %if.then, label %if.end

if.then:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = load i8*, i8** %x.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %26, i64 8)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %29
  store i8* %27, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %41
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
