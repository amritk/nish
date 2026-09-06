%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_free_arena() #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @trace(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %m) #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %m, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %t.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %m, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %m, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8
  %13 = bitcast i8* %12 to %struct.sts_array**
  %14 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %13, i64 %7
  %15 = load %struct.sts_array*, %struct.sts_array** %14, align 8
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 0
  %19 = load i64, i64* %18, align 8
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 %17, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4
  %26 = add i32 %5, %25
  store i32 %26, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = load i32, i32* %t.addr, align 4
  ret i32 %29
}

define noundef i32 @sts_main() #0 {
entry:
  %m.addr = alloca %struct.sts_array*, align 8
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.sts_array*, align 8
  %j.addr = alloca i32, align 4
  %empty.addr = alloca %struct.sts_array*, align 8
  %grid.addr = alloca %struct.sts_array*, align 8
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8
  store %struct.sts_array* %1, %struct.sts_array** %m.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 3
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = call i8* @sts_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.sts_array*
  %9 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 0
  store i64 3, i64* %9, align 8
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 1
  store i64 3, i64* %10, align 8
  %11 = mul i64 3, 4
  %12 = call i8* @sts_alloc_struct(i64 %11)
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 %11, i1 false)
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 2
  store i8* %12, i8** %13, align 8
  store %struct.sts_array* %8, %struct.sts_array** %row.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %14 = load i32, i32* %j.addr, align 4
  %15 = icmp slt i32 %14, 3
  br i1 %15, label %for.body.1, label %for.end.1

for.body.1:
  %16 = load %struct.sts_array*, %struct.sts_array** %row.addr, align 8
  %17 = load i32, i32* %j.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = mul i32 %19, 3
  %21 = load i32, i32* %j.addr, align 4
  %22 = add i32 %20, %21
  %23 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 %18, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %18, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %16, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %18
  store i32 %22, i32* %29, align 4
  br label %for.inc.1

for.inc.1:
  %30 = load i32, i32* %j.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %32 = load %struct.sts_array*, %struct.sts_array** %m.addr, align 8
  %33 = load %struct.sts_array*, %struct.sts_array** %row.addr, align 8
  %34 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %32, i64 0, i32 0
  %35 = load i64, i64* %34, align 8
  %36 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %32, i64 0, i32 1
  %37 = load i64, i64* %36, align 8
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %32, i64 8)
  br label %push.store

push.store:
  %39 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %32, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8
  %41 = bitcast i8* %40 to %struct.sts_array**
  %42 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %41, i64 %35
  store %struct.sts_array* %33, %struct.sts_array** %42, align 8
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8
  %44 = trunc i64 %43 to i32
  br label %for.inc

for.inc:
  %45 = load i32, i32* %i.addr, align 4
  %46 = add i32 %45, 1
  store i32 %46, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %47 = load %struct.sts_array*, %struct.sts_array** %m.addr, align 8
  %48 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %47, i64 0, i32 0
  %49 = load i64, i64* %48, align 8
  %50 = icmp ult i64 1, %49
  br i1 %50, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 1, i64 %49)
  unreachable

bounds.ok.1:
  %51 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %47, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8
  %53 = bitcast i8* %52 to %struct.sts_array**
  %54 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %53, i64 1
  %55 = load %struct.sts_array*, %struct.sts_array** %54, align 8
  %56 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8
  %58 = icmp ult i64 1, %57
  br i1 %58, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 1, i64 %57)
  unreachable

bounds.ok.2:
  %59 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %55, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 1
  store i32 100, i32* %62, align 4
  %63 = load %struct.sts_array*, %struct.sts_array** %m.addr, align 8
  %64 = call i32 @trace(%struct.sts_array* %63)
  %65 = call i8* @sts_str_from_i32(i32 %64)
  call void @sts_print(i8* %65)
  %66 = load %struct.sts_array*, %struct.sts_array** %m.addr, align 8
  %67 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8
  %69 = icmp ult i64 2, %68
  br i1 %69, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @sts_panic_index(i64 2, i64 %68)
  unreachable

bounds.ok.3:
  %70 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8
  %72 = bitcast i8* %71 to %struct.sts_array**
  %73 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %72, i64 2
  %74 = load %struct.sts_array*, %struct.sts_array** %73, align 8
  %75 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8
  %77 = trunc i64 %76 to i32
  %78 = call i8* @sts_str_from_i32(i32 %77)
  call void @sts_print(i8* %78)
  %79 = call i8* @sts_alloc_struct(i64 24)
  %80 = bitcast i8* %79 to %struct.sts_array*
  %81 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %80, i64 0, i32 0
  store i64 0, i64* %81, align 8
  %82 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %80, i64 0, i32 1
  store i64 0, i64* %82, align 8
  %83 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %80, i64 0, i32 2
  store i8* null, i8** %83, align 8
  %84 = call i8* @sts_alloc_struct(i64 24)
  %85 = bitcast i8* %84 to %struct.sts_array*
  %86 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %85, i64 0, i32 0
  store i64 1, i64* %86, align 8
  %87 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %85, i64 0, i32 1
  store i64 1, i64* %87, align 8
  %88 = call i8* @sts_alloc_struct(i64 4)
  %89 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %85, i64 0, i32 2
  store i8* %88, i8** %89, align 8
  %90 = bitcast i8* %88 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 0
  store i32 1, i32* %91, align 4
  %92 = call i8* @sts_alloc_struct(i64 24)
  %93 = bitcast i8* %92 to %struct.sts_array*
  %94 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %93, i64 0, i32 0
  store i64 2, i64* %94, align 8
  %95 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %93, i64 0, i32 1
  store i64 2, i64* %95, align 8
  %96 = call i8* @sts_alloc_struct(i64 16)
  %97 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %93, i64 0, i32 2
  store i8* %96, i8** %97, align 8
  %98 = bitcast i8* %96 to %struct.sts_array**
  %99 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %98, i64 0
  store %struct.sts_array* %80, %struct.sts_array** %99, align 8
  %100 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %98, i64 1
  store %struct.sts_array* %85, %struct.sts_array** %100, align 8
  store %struct.sts_array* %93, %struct.sts_array** %empty.addr, align 8
  %101 = load %struct.sts_array*, %struct.sts_array** %empty.addr, align 8
  %102 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8
  %104 = icmp ult i64 0, %103
  br i1 %104, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @sts_panic_index(i64 0, i64 %103)
  unreachable

bounds.ok.4:
  %105 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %101, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8
  %107 = bitcast i8* %106 to %struct.sts_array**
  %108 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %107, i64 0
  %109 = load %struct.sts_array*, %struct.sts_array** %108, align 8
  %110 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %109, i64 0, i32 0
  %111 = load i64, i64* %110, align 8
  %112 = trunc i64 %111 to i32
  %113 = call i8* @sts_str_from_i32(i32 %112)
  call void @sts_print(i8* %113)
  %114 = call i8* @sts_alloc_struct(i64 24)
  %115 = bitcast i8* %114 to %struct.sts_array*
  %116 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %115, i64 0, i32 0
  store i64 0, i64* %116, align 8
  %117 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %115, i64 0, i32 1
  store i64 0, i64* %117, align 8
  %118 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %115, i64 0, i32 2
  store i8* null, i8** %118, align 8
  store %struct.sts_array* %115, %struct.sts_array** %grid.addr, align 8
  %119 = load %struct.sts_array*, %struct.sts_array** %grid.addr, align 8
  %120 = call i8* @sts_alloc_struct(i64 24)
  %121 = bitcast i8* %120 to %struct.sts_array*
  %122 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %121, i64 0, i32 0
  store i64 2, i64* %122, align 8
  %123 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %121, i64 0, i32 1
  store i64 2, i64* %123, align 8
  %124 = mul i64 2, 4
  %125 = call i8* @sts_alloc_struct(i64 %124)
  call void @llvm.memset.p0i8.i64(i8* align 8 %125, i8 0, i64 %124, i1 false)
  %126 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %121, i64 0, i32 2
  store i8* %125, i8** %126, align 8
  %127 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %119, i64 0, i32 0
  %128 = load i64, i64* %127, align 8
  %129 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %119, i64 0, i32 1
  %130 = load i64, i64* %129, align 8
  %131 = icmp eq i64 %128, %130
  br i1 %131, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @sts_array_grow(%struct.sts_array* %119, i64 8)
  br label %push.store.1

push.store.1:
  %132 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %119, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8
  %134 = bitcast i8* %133 to %struct.sts_array**
  %135 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %134, i64 %128
  store %struct.sts_array* %121, %struct.sts_array** %135, align 8
  %136 = add i64 %128, 1
  store i64 %136, i64* %127, align 8
  %137 = trunc i64 %136 to i32
  %138 = load %struct.sts_array*, %struct.sts_array** %grid.addr, align 8
  %139 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %138, i64 0, i32 0
  %140 = load i64, i64* %139, align 8
  %141 = icmp ult i64 0, %140
  br i1 %141, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @sts_panic_index(i64 0, i64 %140)
  unreachable

bounds.ok.5:
  %142 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %138, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8
  %144 = bitcast i8* %143 to %struct.sts_array**
  %145 = getelementptr inbounds %struct.sts_array*, %struct.sts_array** %144, i64 0
  %146 = load %struct.sts_array*, %struct.sts_array** %145, align 8
  %147 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %146, i64 0, i32 0
  %148 = load i64, i64* %147, align 8
  %149 = icmp ult i64 1, %148
  br i1 %149, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @sts_panic_index(i64 1, i64 %148)
  unreachable

bounds.ok.6:
  %150 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %146, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8
  %152 = bitcast i8* %151 to i32*
  %153 = getelementptr inbounds i32, i32* %152, i64 1
  %154 = load i32, i32* %153, align 4
  %155 = call i8* @sts_str_from_i32(i32 %154)
  call void @sts_print(i8* %155)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
