%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define internal noundef i32 @trace(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %m) #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %m, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %t.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %m, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %9 to %struct.nish_array**
  %11 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %10, i64 %7
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !alias.scope !4, !noalias !3
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3
  %23 = add nsw i32 %5, %22
  store i32 %23, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %t.addr, align 4
  ret i32 %26
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %j.addr = alloca i32, align 4
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.nish_array*], align 8
  %grid.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %m.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4
  %9 = mul i64 3, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %6, %struct.nish_array** %row.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %12 = load i32, i32* %j.addr, align 4
  %13 = icmp slt i32 %12, 3
  br i1 %13, label %for.body.1, label %for.end.1

for.body.1:
  %14 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %15 = load i32, i32* %j.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = load i32, i32* %i.addr, align 4
  %18 = mul nsw i32 %17, 3
  %19 = load i32, i32* %j.addr, align 4
  %20 = add nsw i32 %18, %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %16
  store i32 %20, i32* %24, align 4, !alias.scope !4, !noalias !3
  br label %for.inc.1

for.inc.1:
  %25 = load i32, i32* %j.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %27 = load %struct.nish_array*, %struct.nish_array** %m.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %27, i64 8)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  %36 = bitcast i8* %35 to %struct.nish_array**
  %37 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %36, i64 %30
  store %struct.nish_array* %28, %struct.nish_array** %37, align 8, !alias.scope !4, !noalias !3
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4
  %39 = trunc i64 %38 to i32
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %m.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4
  %45 = icmp ult i64 1, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4
  %48 = bitcast i8* %47 to %struct.nish_array**
  %49 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %48, i64 1
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !alias.scope !4, !noalias !3
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4
  %53 = icmp ult i64 1, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 1
  store i32 100, i32* %57, align 4, !alias.scope !4, !noalias !3
  %58 = load %struct.nish_array*, %struct.nish_array** %m.addr, align 8
  %59 = call i32 @trace(%struct.nish_array* %58)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  %61 = load %struct.nish_array*, %struct.nish_array** %m.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4
  %64 = icmp ult i64 2, %63
  br i1 %64, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %63)
  unreachable

bounds.ok.2:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4
  %67 = bitcast i8* %66 to %struct.nish_array**
  %68 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %67, i64 2
  %69 = load %struct.nish_array*, %struct.nish_array** %68, align 8, !alias.scope !4, !noalias !3
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4
  %72 = trunc i64 %71 to i32
  %73 = call i8* @nish_str_from_i32(i32 %72)
  call void @nish_print(i8* %73)
  %74 = call i8* @nish_alloc_struct(i64 24)
  %75 = bitcast i8* %74 to %struct.nish_array*
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  store i64 0, i64* %76, align 8, !alias.scope !3, !noalias !4
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  store i64 0, i64* %77, align 8, !alias.scope !3, !noalias !4
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  store i8* null, i8** %78, align 8, !alias.scope !3, !noalias !4
  %79 = call i8* @nish_alloc_struct(i64 24)
  %80 = bitcast i8* %79 to %struct.nish_array*
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  store i64 1, i64* %81, align 8, !alias.scope !3, !noalias !4
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 1
  store i64 1, i64* %82, align 8, !alias.scope !3, !noalias !4
  %83 = call i8* @nish_alloc_struct(i64 4)
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  store i8* %83, i8** %84, align 8, !alias.scope !3, !noalias !4
  %85 = bitcast i8* %83 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 0
  store i32 1, i32* %86, align 4, !alias.scope !4, !noalias !3
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %87, align 8, !alias.scope !3, !noalias !4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %88, align 8, !alias.scope !3, !noalias !4
  %89 = bitcast [2 x %struct.nish_array*]* %arr.data to i8*
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %89, i8** %90, align 8, !alias.scope !3, !noalias !4
  %91 = bitcast i8* %89 to %struct.nish_array**
  %92 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %91, i64 0
  store %struct.nish_array* %75, %struct.nish_array** %92, align 8, !alias.scope !4, !noalias !3
  %93 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %91, i64 1
  store %struct.nish_array* %80, %struct.nish_array** %93, align 8, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %94 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4
  %97 = bitcast i8* %96 to %struct.nish_array**
  %98 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %97, i64 0
  %99 = load %struct.nish_array*, %struct.nish_array** %98, align 8, !alias.scope !4, !noalias !3
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4
  %102 = trunc i64 %101 to i32
  %103 = call i8* @nish_str_from_i32(i32 %102)
  call void @nish_print(i8* %103)
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %104, align 8, !alias.scope !3, !noalias !4
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %105, align 8, !alias.scope !3, !noalias !4
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %106, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %grid.addr, align 8
  %107 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %108 = call i8* @nish_alloc_struct(i64 24)
  %109 = bitcast i8* %108 to %struct.nish_array*
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 0
  store i64 2, i64* %110, align 8, !alias.scope !3, !noalias !4
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 1
  store i64 2, i64* %111, align 8, !alias.scope !3, !noalias !4
  %112 = mul i64 2, 4
  %113 = call i8* @nish_alloc_struct(i64 %112)
  call void @llvm.memset.p0i8.i64(i8* align 8 %113, i8 0, i64 %112, i1 false), !alias.scope !4, !noalias !3
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 2
  store i8* %113, i8** %114, align 8, !alias.scope !3, !noalias !4
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 1
  %118 = load i64, i64* %117, align 8, !alias.scope !3, !noalias !4
  %119 = icmp eq i64 %116, %118
  br i1 %119, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %107, i64 8)
  br label %push.store.1

push.store.1:
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4
  %122 = bitcast i8* %121 to %struct.nish_array**
  %123 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %122, i64 %116
  store %struct.nish_array* %109, %struct.nish_array** %123, align 8, !alias.scope !4, !noalias !3
  %124 = add i64 %116, 1
  store i64 %124, i64* %115, align 8, !alias.scope !3, !noalias !4
  %125 = trunc i64 %124 to i32
  %126 = load %struct.nish_array*, %struct.nish_array** %grid.addr, align 8
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %128 = load i64, i64* %127, align 8, !alias.scope !3, !noalias !4
  %129 = icmp ult i64 0, %128
  br i1 %129, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %128)
  unreachable

bounds.ok.3:
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %131 = load i8*, i8** %130, align 8, !alias.scope !3, !noalias !4
  %132 = bitcast i8* %131 to %struct.nish_array**
  %133 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %132, i64 0
  %134 = load %struct.nish_array*, %struct.nish_array** %133, align 8, !alias.scope !4, !noalias !3
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 0
  %136 = load i64, i64* %135, align 8, !alias.scope !3, !noalias !4
  %137 = icmp ult i64 1, %136
  br i1 %137, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %136)
  unreachable

bounds.ok.4:
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 2
  %139 = load i8*, i8** %138, align 8, !alias.scope !3, !noalias !4
  %140 = bitcast i8* %139 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 1
  %142 = load i32, i32* %141, align 4, !alias.scope !4, !noalias !3
  %143 = call i8* @nish_str_from_i32(i32 %142)
  call void @nish_print(i8* %143)
  ret i32 0
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
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
