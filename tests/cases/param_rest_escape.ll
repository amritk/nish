%struct.Bag = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @keep(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  ret %struct.nish_array* %xs
}

define internal void @Bag.constructor(%struct.Bag* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %items) #1 {
entry:
  %0 = getelementptr inbounds %struct.Bag, %struct.Bag* %this, i32 0, i32 0
  store %struct.nish_array* %items, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @Bag.size(%struct.Bag* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Bag, %struct.Bag* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define void @nish_main() #3 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %bag.addr = alloca %struct.Bag*, align 8
  %Bag.obj = alloca %struct.Bag, align 8
  %empty.addr = alloca %struct.Bag*, align 8
  %Bag.obj.1 = alloca %struct.Bag, align 8
  %outer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %10 = call %struct.nish_array* @keep(%struct.nish_array* %1)
  store %struct.nish_array* %10, %struct.nish_array** %a.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 2, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 2, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 4, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 5, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %20 = call %struct.nish_array* @keep(%struct.nish_array* %12)
  store %struct.nish_array* %20, %struct.nish_array** %b.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = trunc i64 %23 to i32
  %25 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = trunc i64 %27 to i32
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  %41 = load i32, i32* %40, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %42 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %45 = icmp ult i64 2, %44
  br i1 %45, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %44)
  unreachable

bounds.ok.1:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 2
  %50 = load i32, i32* %49, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %54 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %57 = icmp ult i64 1, %56
  br i1 %57, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %56)
  unreachable

bounds.ok.2:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 1
  %62 = load i32, i32* %61, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %62)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %66 = call i8* @nish_str_from_i32(i32 %64)
  call void @nish_print(i8* %66)
  %67 = call i8* @nish_alloc_struct(i64 24)
  %68 = bitcast i8* %67 to %struct.nish_array*
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  store i64 3, i64* %69, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 1
  store i64 3, i64* %70, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %71 = call i8* @nish_alloc_struct(i64 12)
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %73 = bitcast i8* %71 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 0
  store i32 7, i32* %74, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %75 = getelementptr inbounds i32, i32* %73, i64 1
  store i32 8, i32* %75, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %76 = getelementptr inbounds i32, i32* %73, i64 2
  store i32 9, i32* %76, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  call void @Bag.constructor(%struct.Bag* %Bag.obj, %struct.nish_array* %68)
  store %struct.Bag* %Bag.obj, %struct.Bag** %bag.addr, align 8
  %77 = load %struct.Bag*, %struct.Bag** %bag.addr, align 8
  %78 = call i32 @Bag.size(%struct.Bag* %77)
  %79 = call i8* @nish_str_from_i32(i32 %78)
  call void @nish_print(i8* %79)
  %80 = load %struct.Bag*, %struct.Bag** %bag.addr, align 8
  %81 = getelementptr inbounds %struct.Bag, %struct.Bag* %80, i32 0, i32 0
  %82 = load %struct.nish_array*, %struct.nish_array** %81, align 8, !tbaa !4
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %85 = icmp ult i64 1, %84
  br i1 %85, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %84)
  unreachable

bounds.ok.3:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %88 = bitcast i8* %87 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 1
  %90 = load i32, i32* %89, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %91 = call i8* @nish_str_from_i32(i32 %90)
  call void @nish_print(i8* %91)
  %92 = call i8* @nish_alloc_struct(i64 24)
  %93 = bitcast i8* %92 to %struct.nish_array*
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  store i64 0, i64* %94, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 1
  store i64 0, i64* %95, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  store i8* null, i8** %96, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  call void @Bag.constructor(%struct.Bag* %Bag.obj.1, %struct.nish_array* %93)
  store %struct.Bag* %Bag.obj.1, %struct.Bag** %empty.addr, align 8
  %97 = load %struct.Bag*, %struct.Bag** %empty.addr, align 8
  %98 = call i32 @Bag.size(%struct.Bag* %97)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  call void @nish_print(i8* %99)
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %100, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %101, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %102, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %outer.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %103 = load i32, i32* %i.addr, align 4
  %104 = icmp slt i32 %103, 3
  br i1 %104, label %for.body, label %for.end

for.body:
  %105 = load %struct.nish_array*, %struct.nish_array** %outer.addr, align 8
  %106 = load i32, i32* %i.addr, align 4
  %107 = load i32, i32* %i.addr, align 4
  %108 = mul nsw i32 %107, 10
  %109 = call i8* @nish_alloc_struct(i64 24)
  %110 = bitcast i8* %109 to %struct.nish_array*
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  store i64 2, i64* %111, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 1
  store i64 2, i64* %112, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %113 = call i8* @nish_alloc_struct(i64 8)
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 2
  store i8* %113, i8** %114, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %115 = bitcast i8* %113 to i32*
  %116 = getelementptr inbounds i32, i32* %115, i64 0
  store i32 %106, i32* %116, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %117 = getelementptr inbounds i32, i32* %115, i64 1
  store i32 %108, i32* %117, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %118 = call %struct.nish_array* @keep(%struct.nish_array* %110)
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %120 = load i64, i64* %119, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 1
  %122 = load i64, i64* %121, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %123 = icmp eq i64 %120, %122
  br i1 %123, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %105, i64 8)
  br label %push.store

push.store:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %126 = bitcast i8* %125 to %struct.nish_array**
  %127 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %126, i64 %120
  store %struct.nish_array* %118, %struct.nish_array** %127, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %128 = add i64 %120, 1
  store i64 %128, i64* %119, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %129 = trunc i64 %128 to i32
  br label %for.inc

for.inc:
  %130 = load i32, i32* %i.addr, align 4
  %131 = add nsw i32 %130, 1
  store i32 %131, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %sum.addr, align 4
  %132 = load %struct.nish_array*, %struct.nish_array** %outer.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %133 = load i64, i64* %forof.idx, align 8
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %136 = icmp ult i64 %133, %135
  br i1 %136, label %forof.body, label %forof.end

forof.body:
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %138 = load i8*, i8** %137, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %139 = bitcast i8* %138 to %struct.nish_array**
  %140 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %139, i64 %133
  %141 = load %struct.nish_array*, %struct.nish_array** %140, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  store %struct.nish_array* %141, %struct.nish_array** %row.addr, align 8
  %142 = load i32, i32* %sum.addr, align 4
  %143 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 0
  %145 = load i64, i64* %144, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %146 = icmp ult i64 0, %145
  br i1 %146, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %145)
  unreachable

bounds.ok.4:
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 0
  %151 = load i32, i32* %150, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %152 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %142, i32 %151)
  %153 = extractvalue { i32, i1 } %152, 0
  %154 = extractvalue { i32, i1 } %152, 1
  br i1 %154, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %155 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %157 = load i64, i64* %156, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %158 = icmp ult i64 1, %157
  br i1 %158, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %157)
  unreachable

bounds.ok.5:
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %161 = bitcast i8* %160 to i32*
  %162 = getelementptr inbounds i32, i32* %161, i64 1
  %163 = load i32, i32* %162, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %164 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %153, i32 %163)
  %165 = extractvalue { i32, i1 } %164, 0
  %166 = extractvalue { i32, i1 } %164, 1
  br i1 %166, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %165, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %167 = load i64, i64* %forof.idx, align 8
  %168 = add i64 %167, 1
  store i64 %168, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %169 = load i32, i32* %sum.addr, align 4
  %170 = call i8* @nish_str_from_i32(i32 %169)
  call void @nish_print(i8* %170)
  %171 = load %struct.nish_array*, %struct.nish_array** %outer.addr, align 8
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 0
  %173 = load i64, i64* %172, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %174 = icmp ult i64 2, %173
  br i1 %174, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %173)
  unreachable

bounds.ok.6:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 2
  %176 = load i8*, i8** %175, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %177 = bitcast i8* %176 to %struct.nish_array**
  %178 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %177, i64 2
  %179 = load %struct.nish_array*, %struct.nish_array** %178, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 0
  %181 = load i64, i64* %180, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %182 = icmp ult i64 1, %181
  br i1 %182, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 1, i64 %181)
  unreachable

bounds.ok.7:
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 2
  %184 = load i8*, i8** %183, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %185 = bitcast i8* %184 to i32*
  %186 = getelementptr inbounds i32, i32* %185, i64 1
  %187 = load i32, i32* %186, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %188 = call i8* @nish_str_from_i32(i32 %187)
  call void @nish_print(i8* %188)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!20, !21, !22, !23, !24}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Bag", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}
