%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_const_0_WIDE.data = private unnamed_addr constant [8 x i16] [i16 0, i16 1, i16 255, i16 256, i16 1000, i16 2001, i16 32768, i16 65535], align 16
@nish_const_0_WIDE = internal constant %struct.nish_array { i64 8, i64 8, i8* bitcast ([8 x i16]* @nish_const_0_WIDE.data to i8*) }, align 8
@nish_const_0_MASKS.data = private unnamed_addr constant [8 x i32] [i32 0, i32 1, i32 65535, i32 65536, i32 4000000000, i32 4294967295, i32 2147483648, i32 4294967295], align 16
@nish_const_0_MASKS = internal constant %struct.nish_array { i64 8, i64 8, i8* bitcast ([8 x i32]* @nish_const_0_MASKS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"u16 \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"u32 \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #4

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

define internal noundef i32 @wideSum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %x.addr = alloca i16, align 2
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %s.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i16*
  %7 = getelementptr inbounds i16, i16* %6, i64 %0
  %8 = load i16, i16* %7, align 2, !alias.scope !4, !noalias !3, !tbaa !13
  store i16 %8, i16* %x.addr, align 2
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i16, i16* %x.addr, align 2
  %11 = zext i16 %10 to i32
  %12 = add i32 %9, %11
  store i32 %12, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = add i64 %13, 1
  store i64 %14, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %15 = load i32, i32* %s.addr, align 4
  ret i32 %15
}

define internal noundef i32 @maskXor(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %s.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %13 = xor i32 %7, %12
  store i32 %13, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %16 = load i32, i32* %s.addr, align 4
  ret i32 %16
}

define void @nish_main() #2 {
entry:
  %wide.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %w.addr = alloca i16, align 2
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %masks.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %m.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %wide.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i16*
  %10 = getelementptr inbounds i16, i16* %9, i64 %3
  %11 = load i16, i16* %10, align 2, !alias.scope !4, !noalias !3, !tbaa !13
  store i16 %11, i16* %w.addr, align 2
  %12 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %13 = load i16, i16* %w.addr, align 2
  %14 = zext i16 %13 to i64
  %15 = call i8* @nish_str_from_u64(i64 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* %15, i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = add i64 %27, 1
  store i64 %28, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %35 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %39 = load i64, i64* %38, align 8
  %40 = sub i64 %37, 1
  %41 = mul i64 %39, %40
  %42 = icmp eq i64 %37, 0
  %43 = select i1 %42, i64 0, i64 %41
  store i64 %43, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %44 = load i64, i64* %join.at, align 8
  %45 = icmp ult i64 %44, %37
  br i1 %45, label %join.sum.body, label %join.copy

join.sum.body:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to i8**
  %49 = getelementptr inbounds i8*, i8** %48, i64 %44
  %50 = load i8*, i8** %49, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %51 = load i64, i64* %join.total, align 8
  %52 = bitcast i8* %50 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = add i64 %51, %53
  store i64 %54, i64* %join.total, align 8
  %55 = add i64 %44, 1
  store i64 %55, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %56 = load i64, i64* %join.total, align 8
  %57 = icmp ugt i64 %56, 2147483647
  %58 = add i64 %56, 9
  %59 = select i1 %57, i64 4611686018427387904, i64 %58
  %60 = call i8* @nish_alloc_struct(i64 %59)
  %61 = bitcast i8* %60 to i64*
  store i64 %56, i64* %61, align 8
  %62 = getelementptr inbounds i8, i8* %60, i64 8
  store i8* %62, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %63 = load i64, i64* %join.at, align 8
  %64 = icmp ult i64 %63, %37
  br i1 %64, label %join.part, label %join.end

join.part:
  %65 = load i8*, i8** %join.p, align 8
  %66 = icmp eq i64 %63, 0
  %67 = select i1 %66, i64 0, i64 %39
  %68 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %65, i8* %68, i64 %67, i1 false)
  %69 = getelementptr inbounds i8, i8* %65, i64 %67
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast i8* %71 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %63
  %74 = load i8*, i8** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %75 = bitcast i8* %74 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = getelementptr inbounds i8, i8* %74, i64 8
  %78 = icmp eq i64 %76, 1
  br i1 %78, label %join.byte, label %join.bulk

join.byte:
  %79 = load i8, i8* %77, align 1
  store i8 %79, i8* %69, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %69, i8* %77, i64 %76, i1 false)
  br label %join.next

join.next:
  %80 = getelementptr inbounds i8, i8* %69, i64 %76
  store i8* %80, i8** %join.p, align 8
  %81 = add i64 %63, 1
  store i64 %81, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %82 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %82, align 1
  %83 = call i8* @nish_str_concat(i8* %34, i8* %60)
  call void @nish_print(i8* %83)
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %masks.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %87 = load i64, i64* %forof.idx.1, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = icmp ult i64 %87, %89
  br i1 %90, label %forof.body.1, label %forof.end.1

forof.body.1:
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = bitcast i8* %92 to i32*
  %94 = getelementptr inbounds i32, i32* %93, i64 %87
  %95 = load i32, i32* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  store i32 %95, i32* %m.addr, align 4
  %96 = load %struct.nish_array*, %struct.nish_array** %masks.addr, align 8
  %97 = load i32, i32* %m.addr, align 4
  %98 = zext i32 %97 to i64
  %99 = call i8* @nish_str_from_u64(i64 %98)
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 1
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %104 = icmp eq i64 %101, %103
  br i1 %104, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %96, i64 8)
  br label %push.store.1

push.store.1:
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = bitcast i8* %106 to i8**
  %108 = getelementptr inbounds i8*, i8** %107, i64 %101
  store i8* %99, i8** %108, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %109 = add i64 %101, 1
  store i64 %109, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = trunc i64 %109 to i32
  br label %forof.inc.1

forof.inc.1:
  %111 = load i64, i64* %forof.idx.1, align 8
  %112 = add i64 %111, 1
  store i64 %112, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = trunc i64 %114 to i32
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %119 = load %struct.nish_array*, %struct.nish_array** %masks.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %123 = load i64, i64* %122, align 8
  %124 = sub i64 %121, 1
  %125 = mul i64 %123, %124
  %126 = icmp eq i64 %121, 0
  %127 = select i1 %126, i64 0, i64 %125
  store i64 %127, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %128 = load i64, i64* %join.at.1, align 8
  %129 = icmp ult i64 %128, %121
  br i1 %129, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %132 = bitcast i8* %131 to i8**
  %133 = getelementptr inbounds i8*, i8** %132, i64 %128
  %134 = load i8*, i8** %133, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %135 = load i64, i64* %join.total.1, align 8
  %136 = bitcast i8* %134 to i64*
  %137 = load i64, i64* %136, align 8
  %138 = add i64 %135, %137
  store i64 %138, i64* %join.total.1, align 8
  %139 = add i64 %128, 1
  store i64 %139, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %140 = load i64, i64* %join.total.1, align 8
  %141 = icmp ugt i64 %140, 2147483647
  %142 = add i64 %140, 9
  %143 = select i1 %141, i64 4611686018427387904, i64 %142
  %144 = call i8* @nish_alloc_struct(i64 %143)
  %145 = bitcast i8* %144 to i64*
  store i64 %140, i64* %145, align 8
  %146 = getelementptr inbounds i8, i8* %144, i64 8
  store i8* %146, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %147 = load i64, i64* %join.at.1, align 8
  %148 = icmp ult i64 %147, %121
  br i1 %148, label %join.part.1, label %join.end.1

join.part.1:
  %149 = load i8*, i8** %join.p.1, align 8
  %150 = icmp eq i64 %147, 0
  %151 = select i1 %150, i64 0, i64 %123
  %152 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %149, i8* %152, i64 %151, i1 false)
  %153 = getelementptr inbounds i8, i8* %149, i64 %151
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %156 = bitcast i8* %155 to i8**
  %157 = getelementptr inbounds i8*, i8** %156, i64 %147
  %158 = load i8*, i8** %157, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %159 = bitcast i8* %158 to i64*
  %160 = load i64, i64* %159, align 8
  %161 = getelementptr inbounds i8, i8* %158, i64 8
  %162 = icmp eq i64 %160, 1
  br i1 %162, label %join.byte.1, label %join.bulk.1

join.byte.1:
  %163 = load i8, i8* %161, align 1
  store i8 %163, i8* %153, align 1
  br label %join.next.1

join.bulk.1:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %153, i8* %161, i64 %160, i1 false)
  br label %join.next.1

join.next.1:
  %164 = getelementptr inbounds i8, i8* %153, i64 %160
  store i8* %164, i8** %join.p.1, align 8
  %165 = add i64 %147, 1
  store i64 %165, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %166 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %166, align 1
  %167 = call i8* @nish_str_concat(i8* %118, i8* %144)
  call void @nish_print(i8* %167)
  %168 = call i32 @wideSum(%struct.nish_array* @nish_const_0_WIDE)
  %169 = zext i32 %168 to i64
  %170 = call i8* @nish_str_from_u64(i64 %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %172 = call i32 @maskXor(%struct.nish_array* @nish_const_0_MASKS)
  %173 = zext i32 %172 to i64
  %174 = call i8* @nish_str_from_u64(i64 %173)
  %175 = call i8* @nish_str_concat(i8* %171, i8* %174)
  call void @nish_print(i8* %175)
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 2
  %177 = load i8*, i8** %176, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %178 = bitcast i8* %177 to i16*
  %179 = getelementptr inbounds i16, i16* %178, i64 7
  %180 = load i16, i16* %179, align 2, !alias.scope !4, !noalias !3, !tbaa !13
  %181 = trunc i32 1 to i16
  %182 = add i16 %180, %181
  %183 = zext i16 %182 to i64
  %184 = call i8* @nish_str_from_u64(i64 %183)
  %185 = call i8* @nish_str_concat(i8* %184, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 2
  %187 = load i8*, i8** %186, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %188 = bitcast i8* %187 to i32*
  %189 = getelementptr inbounds i32, i32* %188, i64 7
  %190 = load i32, i32* %189, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %191 = add i32 %190, 1
  %192 = zext i32 %191 to i64
  %193 = call i8* @nish_str_from_u64(i64 %192)
  %194 = call i8* @nish_str_concat(i8* %185, i8* %193)
  call void @nish_print(i8* %194)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!12 = !{!"element i16", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i32", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
