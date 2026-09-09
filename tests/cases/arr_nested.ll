%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare void @amrit_free_arena() #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #2
declare void @amrit_array_grow(%struct.amrit_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @amrit_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @trace(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %m) #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %m, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %t.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %m, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %m, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %12 to %struct.amrit_array**
  %14 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %13, i64 %7
  %15 = load %struct.amrit_array*, %struct.amrit_array** %14, align 8, !alias.scope !4, !noalias !3
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %17, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3
  %26 = add nsw i32 %5, %25
  store i32 %26, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = load i32, i32* %t.addr, align 4
  ret i32 %29
}

define noundef i32 @amrit_main() #0 {
entry:
  %m.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.amrit_array*, align 8
  %j.addr = alloca i32, align 4
  %empty.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.1 = alloca %struct.amrit_array, align 8
  %arr.data = alloca [2 x %struct.amrit_array*], align 8
  %grid.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.2 = alloca %struct.amrit_array, align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %m.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = call i8* @amrit_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.amrit_array*
  %7 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %6, i64 0, i32 0
  store i64 3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %6, i64 0, i32 1
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4
  %9 = mul i64 3, 4
  %10 = call i8* @amrit_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %6, %struct.amrit_array** %row.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %12 = load i32, i32* %j.addr, align 4
  %13 = icmp slt i32 %12, 3
  br i1 %13, label %for.body.1, label %for.end.1

for.body.1:
  %14 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %15 = load i32, i32* %j.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = load i32, i32* %i.addr, align 4
  %18 = mul nsw i32 %17, 3
  %19 = load i32, i32* %j.addr, align 4
  %20 = add nsw i32 %18, %19
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %14, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = icmp ult i64 %16, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %16, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %14, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %16
  store i32 %20, i32* %27, align 4, !alias.scope !4, !noalias !3
  br label %for.inc.1

for.inc.1:
  %28 = load i32, i32* %j.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %30 = load %struct.amrit_array*, %struct.amrit_array** %m.addr, align 8
  %31 = load %struct.amrit_array*, %struct.amrit_array** %row.addr, align 8
  %32 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %30, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %30, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow, label %push.store

push.grow:
  call void @amrit_array_grow(%struct.amrit_array* %30, i64 8)
  br label %push.store

push.store:
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %30, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast i8* %38 to %struct.amrit_array**
  %40 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %39, i64 %33
  store %struct.amrit_array* %31, %struct.amrit_array** %40, align 8, !alias.scope !4, !noalias !3
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !3, !noalias !4
  %42 = trunc i64 %41 to i32
  br label %for.inc

for.inc:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %45 = load %struct.amrit_array*, %struct.amrit_array** %m.addr, align 8
  %46 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4
  %48 = icmp ult i64 1, %47
  br i1 %48, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 1, i64 %47)
  unreachable

bounds.ok.1:
  %49 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %45, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4
  %51 = bitcast i8* %50 to %struct.amrit_array**
  %52 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %51, i64 1
  %53 = load %struct.amrit_array*, %struct.amrit_array** %52, align 8, !alias.scope !4, !noalias !3
  %54 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4
  %56 = icmp ult i64 1, %55
  br i1 %56, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 1, i64 %55)
  unreachable

bounds.ok.2:
  %57 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 1
  store i32 100, i32* %60, align 4, !alias.scope !4, !noalias !3
  %61 = load %struct.amrit_array*, %struct.amrit_array** %m.addr, align 8
  %62 = call i32 @trace(%struct.amrit_array* %61)
  %63 = call i8* @amrit_str_from_i32(i32 %62)
  call void @amrit_print(i8* %63)
  %64 = load %struct.amrit_array*, %struct.amrit_array** %m.addr, align 8
  %65 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4
  %67 = icmp ult i64 2, %66
  br i1 %67, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 2, i64 %66)
  unreachable

bounds.ok.3:
  %68 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4
  %70 = bitcast i8* %69 to %struct.amrit_array**
  %71 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %70, i64 2
  %72 = load %struct.amrit_array*, %struct.amrit_array** %71, align 8, !alias.scope !4, !noalias !3
  %73 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4
  %75 = trunc i64 %74 to i32
  %76 = call i8* @amrit_str_from_i32(i32 %75)
  call void @amrit_print(i8* %76)
  %77 = call i8* @amrit_alloc_struct(i64 24)
  %78 = bitcast i8* %77 to %struct.amrit_array*
  %79 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %78, i64 0, i32 0
  store i64 0, i64* %79, align 8, !alias.scope !3, !noalias !4
  %80 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %78, i64 0, i32 1
  store i64 0, i64* %80, align 8, !alias.scope !3, !noalias !4
  %81 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %78, i64 0, i32 2
  store i8* null, i8** %81, align 8, !alias.scope !3, !noalias !4
  %82 = call i8* @amrit_alloc_struct(i64 24)
  %83 = bitcast i8* %82 to %struct.amrit_array*
  %84 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %83, i64 0, i32 0
  store i64 1, i64* %84, align 8, !alias.scope !3, !noalias !4
  %85 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %83, i64 0, i32 1
  store i64 1, i64* %85, align 8, !alias.scope !3, !noalias !4
  %86 = call i8* @amrit_alloc_struct(i64 4)
  %87 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %83, i64 0, i32 2
  store i8* %86, i8** %87, align 8, !alias.scope !3, !noalias !4
  %88 = bitcast i8* %86 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 0
  store i32 1, i32* %89, align 4, !alias.scope !4, !noalias !3
  %90 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %90, align 8, !alias.scope !3, !noalias !4
  %91 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %91, align 8, !alias.scope !3, !noalias !4
  %92 = bitcast [2 x %struct.amrit_array*]* %arr.data to i8*
  %93 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 2
  store i8* %92, i8** %93, align 8, !alias.scope !3, !noalias !4
  %94 = bitcast i8* %92 to %struct.amrit_array**
  %95 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %94, i64 0
  store %struct.amrit_array* %78, %struct.amrit_array** %95, align 8, !alias.scope !4, !noalias !3
  %96 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %94, i64 1
  store %struct.amrit_array* %83, %struct.amrit_array** %96, align 8, !alias.scope !4, !noalias !3
  store %struct.amrit_array* %arr.hdr.1, %struct.amrit_array** %empty.addr, align 8
  %97 = load %struct.amrit_array*, %struct.amrit_array** %empty.addr, align 8
  %98 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4
  %100 = icmp ult i64 0, %99
  br i1 %100, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @amrit_panic_index(i64 0, i64 %99)
  unreachable

bounds.ok.4:
  %101 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4
  %103 = bitcast i8* %102 to %struct.amrit_array**
  %104 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %103, i64 0
  %105 = load %struct.amrit_array*, %struct.amrit_array** %104, align 8, !alias.scope !4, !noalias !3
  %106 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4
  %108 = trunc i64 %107 to i32
  %109 = call i8* @amrit_str_from_i32(i32 %108)
  call void @amrit_print(i8* %109)
  %110 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %110, align 8, !alias.scope !3, !noalias !4
  %111 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %111, align 8, !alias.scope !3, !noalias !4
  %112 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %112, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %arr.hdr.2, %struct.amrit_array** %grid.addr, align 8
  %113 = load %struct.amrit_array*, %struct.amrit_array** %grid.addr, align 8
  %114 = call i8* @amrit_alloc_struct(i64 24)
  %115 = bitcast i8* %114 to %struct.amrit_array*
  %116 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %115, i64 0, i32 0
  store i64 2, i64* %116, align 8, !alias.scope !3, !noalias !4
  %117 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %115, i64 0, i32 1
  store i64 2, i64* %117, align 8, !alias.scope !3, !noalias !4
  %118 = mul i64 2, 4
  %119 = call i8* @amrit_alloc_struct(i64 %118)
  call void @llvm.memset.p0i8.i64(i8* align 8 %119, i8 0, i64 %118, i1 false), !alias.scope !4, !noalias !3
  %120 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %115, i64 0, i32 2
  store i8* %119, i8** %120, align 8, !alias.scope !3, !noalias !4
  %121 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %113, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4
  %123 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %113, i64 0, i32 1
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4
  %125 = icmp eq i64 %122, %124
  br i1 %125, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @amrit_array_grow(%struct.amrit_array* %113, i64 8)
  br label %push.store.1

push.store.1:
  %126 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %113, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8, !alias.scope !3, !noalias !4
  %128 = bitcast i8* %127 to %struct.amrit_array**
  %129 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %128, i64 %122
  store %struct.amrit_array* %115, %struct.amrit_array** %129, align 8, !alias.scope !4, !noalias !3
  %130 = add i64 %122, 1
  store i64 %130, i64* %121, align 8, !alias.scope !3, !noalias !4
  %131 = trunc i64 %130 to i32
  %132 = load %struct.amrit_array*, %struct.amrit_array** %grid.addr, align 8
  %133 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4
  %135 = icmp ult i64 0, %134
  br i1 %135, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @amrit_panic_index(i64 0, i64 %134)
  unreachable

bounds.ok.5:
  %136 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4
  %138 = bitcast i8* %137 to %struct.amrit_array**
  %139 = getelementptr inbounds %struct.amrit_array*, %struct.amrit_array** %138, i64 0
  %140 = load %struct.amrit_array*, %struct.amrit_array** %139, align 8, !alias.scope !4, !noalias !3
  %141 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %140, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !3, !noalias !4
  %143 = icmp ult i64 1, %142
  br i1 %143, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @amrit_panic_index(i64 1, i64 %142)
  unreachable

bounds.ok.6:
  %144 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %140, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4
  %146 = bitcast i8* %145 to i32*
  %147 = getelementptr inbounds i32, i32* %146, i64 1
  %148 = load i32, i32* %147, align 4, !alias.scope !4, !noalias !3
  %149 = call i8* @amrit_str_from_i32(i32 %148)
  call void @amrit_print(i8* %149)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
