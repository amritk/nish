%struct.Map$f32$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$f32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"map \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"set \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"update \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"guarded set \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"guarded add \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"getOrInsert \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Set: no entry at this index\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal void @count(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) %m, float noundef %k) #0 {
entry:
  %0 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %m, float %k)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %m, i32 %2)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %nullish.value ], [ 0, %nullish.default ]
  %5 = add nsw i32 %4, 1
  br i1 %1, label %set.found, label %set.insert

set.found:
  %6 = trunc i64 %0 to i32
  call void @nish.Map$f32$i32.setValueAt(%struct.Map$f32$i32* %m, i32 %6, i32 %5)
  br label %set.end

set.insert:
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %m, i64 %0, float %k, i32 %5)
  br label %set.end

set.end:
  ret void
}

define internal void @firstValue(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) %m, float noundef %k, i32 noundef %v) #0 {
entry:
  %0 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %m, float %k)
  %1 = icmp sge i64 %0, 0
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %m, i64 %0, float %k, i32 %v)
  br label %if.end

if.end:
  ret void
}

define internal void @firstOnly(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) %s, float noundef %k) #0 {
entry:
  %0 = call i64 @nish.Set$f32.probe(%struct.Set$f32* %s, float %k)
  %1 = icmp sge i64 %0, 0
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish.Set$f32.insertAt(%struct.Set$f32* %s, i64 %0, float %k)
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca float, align 4
  %one.addr = alloca float, align 4
  %m.addr = alloca %struct.Map$f32$i32*, align 8
  %k.addr = alloca float, align 4
  %walk.idx = alloca i32, align 4
  %s.addr = alloca %struct.Set$f32*, align 8
  %v.addr = alloca float, align 4
  %walk.idx.1 = alloca i32, align 4
  %counts.addr = alloca %struct.Map$f32$i32*, align 8
  %k.addr.1 = alloca float, align 4
  %walk.idx.2 = alloca i32, align 4
  %firsts.addr = alloca %struct.Map$f32$i32*, align 8
  %k.addr.2 = alloca float, align 4
  %walk.idx.3 = alloca i32, align 4
  %seen.addr = alloca %struct.Set$f32*, align 8
  %v.addr.1 = alloca float, align 4
  %walk.idx.4 = alloca i32, align 4
  %ids.addr = alloca %struct.Map$f32$i32*, align 8
  %id.addr = alloca i32, align 4
  %k.addr.3 = alloca float, align 4
  %walk.idx.5 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store float 0x0000000000000000, float* %zero.addr, align 4
  store float 0x3FF0000000000000, float* %one.addr, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f32$i32*
  call void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* %1)
  store %struct.Map$f32$i32* %1, %struct.Map$f32$i32** %m.addr, align 8
  %2 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  %3 = load float, float* %zero.addr, align 4
  %4 = fneg float %3
  %5 = call %struct.Map$f32$i32* @nish.Map$f32$i32.set(%struct.Map$f32$i32* %2, float %4, i32 1)
  %6 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  call void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* %6)
  %7 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %6, i32 0)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %8 = load i32, i32* %walk.idx, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %walk.body, label %walk.end

walk.body:
  %10 = call float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* %6, i32 %8)
  store float %10, float* %k.addr, align 4
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load float, float* %k.addr, align 4
  %16 = fpext float %15 to double
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %20 = load float, float* %one.addr, align 4
  %21 = load float, float* %k.addr, align 4
  %22 = fdiv float %20, %21
  %23 = fpext float %22 to double
  %24 = call i8* @nish_str_from_f64(double %23)
  %25 = call i8* @nish_str_concat(i8* %19, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %27 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  %28 = load float, float* %zero.addr, align 4
  %29 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %27, float %28)
  %30 = icmp sge i64 %29, 0
  br i1 %30, label %nullish.value, label %nullish.default

nullish.value:
  %31 = trunc i64 %29 to i32
  %32 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %27, i32 %31)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %33 = phi i32 [ %32, %nullish.value ], [ -1, %nullish.default ]
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %26, i8* %34)
  call void @nish_print(i8* %35)
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %37 = load i8*, i8** %36, align 8
  %38 = icmp eq i8* %37, %12
  br i1 %38, label %pass.rewind, label %pass.free

pass.rewind:
  %39 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %39, align 8
  br label %pass.done

pass.free:
  %40 = ptrtoint i8* %12 to i64
  %41 = add i64 %40, %14
  call void @nish_arena_release(i64 %41)
  br label %pass.done

pass.done:
  br label %walk.inc

walk.inc:
  %42 = add i32 %8, 1
  %43 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %6, i32 %42)
  store i32 %43, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* %6)
  %44 = call i8* @nish_alloc_struct(i64 48)
  %45 = bitcast i8* %44 to %struct.Set$f32*
  call void @nish.Set$f32.constructor(%struct.Set$f32* %45)
  store %struct.Set$f32* %45, %struct.Set$f32** %s.addr, align 8
  %46 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %47 = load float, float* %zero.addr, align 4
  %48 = fneg float %47
  %49 = call %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* %46, float %48)
  %50 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %51 = load float, float* %zero.addr, align 4
  %52 = call %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* %50, float %51)
  %53 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  call void @nish.Set$f32.walkOpen(%struct.Set$f32* %53)
  %54 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %53, i32 0)
  store i32 %54, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %55 = load i32, i32* %walk.idx.1, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %walk.body.1, label %walk.end.1

walk.body.1:
  %57 = call float @nish.Set$f32.keyAt(%struct.Set$f32* %53, i32 %55)
  store float %57, float* %v.addr, align 4
  %58 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %59 = load i8*, i8** %58, align 8
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %61 = load i64, i64* %60, align 8
  %62 = load float, float* %v.addr, align 4
  %63 = fpext float %62 to double
  %64 = call i8* @nish_str_from_f64(double %63)
  %65 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %67 = load float, float* %one.addr, align 4
  %68 = load float, float* %v.addr, align 4
  %69 = fdiv float %67, %68
  %70 = fpext float %69 to double
  %71 = call i8* @nish_str_from_f64(double %70)
  %72 = call i8* @nish_str_concat(i8* %66, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %74 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %75 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %74, i32 0, i32 0
  %76 = load i32, i32* %75, align 4, !tbaa !5
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* %73, i8* %77)
  call void @nish_print(i8* %78)
  %79 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %80 = load i8*, i8** %79, align 8
  %81 = icmp eq i8* %80, %59
  br i1 %81, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %61, i64* %82, align 8
  br label %pass.done.1

pass.free.1:
  %83 = ptrtoint i8* %59 to i64
  %84 = add i64 %83, %61
  call void @nish_arena_release(i64 %84)
  br label %pass.done.1

pass.done.1:
  br label %walk.inc.1

walk.inc.1:
  %85 = add i32 %55, 1
  %86 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %53, i32 %85)
  store i32 %86, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Set$f32.walkClose(%struct.Set$f32* %53)
  %87 = call i8* @nish_alloc_struct(i64 56)
  %88 = bitcast i8* %87 to %struct.Map$f32$i32*
  call void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* %88)
  store %struct.Map$f32$i32* %88, %struct.Map$f32$i32** %counts.addr, align 8
  %89 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %counts.addr, align 8
  %90 = load float, float* %zero.addr, align 4
  %91 = fneg float %90
  call void @count(%struct.Map$f32$i32* %89, float %91)
  %92 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %counts.addr, align 8
  %93 = load float, float* %zero.addr, align 4
  call void @count(%struct.Map$f32$i32* %92, float %93)
  %94 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %counts.addr, align 8
  call void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* %94)
  %95 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %94, i32 0)
  store i32 %95, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.cond.2:
  %96 = load i32, i32* %walk.idx.2, align 4
  %97 = icmp sge i32 %96, 0
  br i1 %97, label %walk.body.2, label %walk.end.2

walk.body.2:
  %98 = call float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* %94, i32 %96)
  store float %98, float* %k.addr.1, align 4
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %100 = load i8*, i8** %99, align 8
  %101 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %102 = load i64, i64* %101, align 8
  %103 = load float, float* %one.addr, align 4
  %104 = load float, float* %k.addr.1, align 4
  %105 = fdiv float %103, %104
  %106 = fpext float %105 to double
  %107 = call i8* @nish_str_from_f64(double %106)
  %108 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i8* %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %110 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %counts.addr, align 8
  %111 = load float, float* %k.addr.1, align 4
  %112 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %110, float %111)
  %113 = icmp sge i64 %112, 0
  br i1 %113, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %114 = trunc i64 %112 to i32
  %115 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %110, i32 %114)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %116 = phi i32 [ %115, %nullish.value.1 ], [ -1, %nullish.default.1 ]
  %117 = call i8* @nish_str_from_i32(i32 %116)
  %118 = call i8* @nish_str_concat(i8* %109, i8* %117)
  call void @nish_print(i8* %118)
  %119 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %120 = load i8*, i8** %119, align 8
  %121 = icmp eq i8* %120, %100
  br i1 %121, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %122 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %102, i64* %122, align 8
  br label %pass.done.2

pass.free.2:
  %123 = ptrtoint i8* %100 to i64
  %124 = add i64 %123, %102
  call void @nish_arena_release(i64 %124)
  br label %pass.done.2

pass.done.2:
  br label %walk.inc.2

walk.inc.2:
  %125 = add i32 %96, 1
  %126 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %94, i32 %125)
  store i32 %126, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.end.2:
  call void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* %94)
  %127 = call i8* @nish_alloc_struct(i64 56)
  %128 = bitcast i8* %127 to %struct.Map$f32$i32*
  call void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* %128)
  store %struct.Map$f32$i32* %128, %struct.Map$f32$i32** %firsts.addr, align 8
  %129 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %firsts.addr, align 8
  %130 = load float, float* %zero.addr, align 4
  %131 = fneg float %130
  call void @firstValue(%struct.Map$f32$i32* %129, float %131, i32 7)
  %132 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %firsts.addr, align 8
  %133 = load float, float* %zero.addr, align 4
  call void @firstValue(%struct.Map$f32$i32* %132, float %133, i32 8)
  %134 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %firsts.addr, align 8
  call void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* %134)
  %135 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %134, i32 0)
  store i32 %135, i32* %walk.idx.3, align 4
  br label %walk.cond.3

walk.cond.3:
  %136 = load i32, i32* %walk.idx.3, align 4
  %137 = icmp sge i32 %136, 0
  br i1 %137, label %walk.body.3, label %walk.end.3

walk.body.3:
  %138 = call float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* %134, i32 %136)
  store float %138, float* %k.addr.2, align 4
  %139 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %140 = load i8*, i8** %139, align 8
  %141 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %142 = load i64, i64* %141, align 8
  %143 = load float, float* %one.addr, align 4
  %144 = load float, float* %k.addr.2, align 4
  %145 = fdiv float %143, %144
  %146 = fpext float %145 to double
  %147 = call i8* @nish_str_from_f64(double %146)
  %148 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.4 to i8*), i8* %147)
  %149 = call i8* @nish_str_concat(i8* %148, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %150 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %firsts.addr, align 8
  %151 = load float, float* %k.addr.2, align 4
  %152 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %150, float %151)
  %153 = icmp sge i64 %152, 0
  br i1 %153, label %nullish.value.2, label %nullish.default.2

nullish.value.2:
  %154 = trunc i64 %152 to i32
  %155 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %150, i32 %154)
  br label %nullish.end.2

nullish.default.2:
  br label %nullish.end.2

nullish.end.2:
  %156 = phi i32 [ %155, %nullish.value.2 ], [ -1, %nullish.default.2 ]
  %157 = call i8* @nish_str_from_i32(i32 %156)
  %158 = call i8* @nish_str_concat(i8* %149, i8* %157)
  call void @nish_print(i8* %158)
  %159 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %160 = load i8*, i8** %159, align 8
  %161 = icmp eq i8* %160, %140
  br i1 %161, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %162 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %142, i64* %162, align 8
  br label %pass.done.3

pass.free.3:
  %163 = ptrtoint i8* %140 to i64
  %164 = add i64 %163, %142
  call void @nish_arena_release(i64 %164)
  br label %pass.done.3

pass.done.3:
  br label %walk.inc.3

walk.inc.3:
  %165 = add i32 %136, 1
  %166 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %134, i32 %165)
  store i32 %166, i32* %walk.idx.3, align 4
  br label %walk.cond.3

walk.end.3:
  call void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* %134)
  %167 = call i8* @nish_alloc_struct(i64 48)
  %168 = bitcast i8* %167 to %struct.Set$f32*
  call void @nish.Set$f32.constructor(%struct.Set$f32* %168)
  store %struct.Set$f32* %168, %struct.Set$f32** %seen.addr, align 8
  %169 = load %struct.Set$f32*, %struct.Set$f32** %seen.addr, align 8
  %170 = load float, float* %zero.addr, align 4
  %171 = fneg float %170
  call void @firstOnly(%struct.Set$f32* %169, float %171)
  %172 = load %struct.Set$f32*, %struct.Set$f32** %seen.addr, align 8
  %173 = load float, float* %zero.addr, align 4
  call void @firstOnly(%struct.Set$f32* %172, float %173)
  %174 = load %struct.Set$f32*, %struct.Set$f32** %seen.addr, align 8
  call void @nish.Set$f32.walkOpen(%struct.Set$f32* %174)
  %175 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %174, i32 0)
  store i32 %175, i32* %walk.idx.4, align 4
  br label %walk.cond.4

walk.cond.4:
  %176 = load i32, i32* %walk.idx.4, align 4
  %177 = icmp sge i32 %176, 0
  br i1 %177, label %walk.body.4, label %walk.end.4

walk.body.4:
  %178 = call float @nish.Set$f32.keyAt(%struct.Set$f32* %174, i32 %176)
  store float %178, float* %v.addr.1, align 4
  %179 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %180 = load i8*, i8** %179, align 8
  %181 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %182 = load i64, i64* %181, align 8
  %183 = load float, float* %one.addr, align 4
  %184 = load float, float* %v.addr.1, align 4
  %185 = fdiv float %183, %184
  %186 = fpext float %185 to double
  %187 = call i8* @nish_str_from_f64(double %186)
  %188 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.5 to i8*), i8* %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %190 = load %struct.Set$f32*, %struct.Set$f32** %seen.addr, align 8
  %191 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %190, i32 0, i32 0
  %192 = load i32, i32* %191, align 4, !tbaa !5
  %193 = call i8* @nish_str_from_i32(i32 %192)
  %194 = call i8* @nish_str_concat(i8* %189, i8* %193)
  call void @nish_print(i8* %194)
  %195 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %196 = load i8*, i8** %195, align 8
  %197 = icmp eq i8* %196, %180
  br i1 %197, label %pass.rewind.4, label %pass.free.4

pass.rewind.4:
  %198 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %182, i64* %198, align 8
  br label %pass.done.4

pass.free.4:
  %199 = ptrtoint i8* %180 to i64
  %200 = add i64 %199, %182
  call void @nish_arena_release(i64 %200)
  br label %pass.done.4

pass.done.4:
  br label %walk.inc.4

walk.inc.4:
  %201 = add i32 %176, 1
  %202 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %174, i32 %201)
  store i32 %202, i32* %walk.idx.4, align 4
  br label %walk.cond.4

walk.end.4:
  call void @nish.Set$f32.walkClose(%struct.Set$f32* %174)
  %203 = call i8* @nish_alloc_struct(i64 56)
  %204 = bitcast i8* %203 to %struct.Map$f32$i32*
  call void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* %204)
  store %struct.Map$f32$i32* %204, %struct.Map$f32$i32** %ids.addr, align 8
  %205 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %ids.addr, align 8
  %206 = load float, float* %zero.addr, align 4
  %207 = fneg float %206
  %208 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %205, float %207)
  %209 = icmp sge i64 %208, 0
  br i1 %209, label %get.found, label %get.insert

get.found:
  %210 = trunc i64 %208 to i32
  %211 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %205, i32 %210)
  br label %get.end

get.insert:
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %205, i64 %208, float %207, i32 5)
  br label %get.end

get.end:
  %212 = phi i32 [ %211, %get.found ], [ 5, %get.insert ]
  %213 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %ids.addr, align 8
  %214 = load float, float* %zero.addr, align 4
  %215 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %213, float %214)
  %216 = icmp sge i64 %215, 0
  br i1 %216, label %get.found.1, label %get.insert.1

get.found.1:
  %217 = trunc i64 %215 to i32
  %218 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %213, i32 %217)
  br label %get.end.1

get.insert.1:
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %213, i64 %215, float %214, i32 6)
  br label %get.end.1

get.end.1:
  %219 = phi i32 [ %218, %get.found.1 ], [ 6, %get.insert.1 ]
  %220 = add nsw i32 %212, %219
  store i32 %220, i32* %id.addr, align 4
  %221 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %ids.addr, align 8
  call void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* %221)
  %222 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %221, i32 0)
  store i32 %222, i32* %walk.idx.5, align 4
  br label %walk.cond.5

walk.cond.5:
  %223 = load i32, i32* %walk.idx.5, align 4
  %224 = icmp sge i32 %223, 0
  br i1 %224, label %walk.body.5, label %walk.end.5

walk.body.5:
  %225 = call float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* %221, i32 %223)
  store float %225, float* %k.addr.3, align 4
  %226 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %227 = load i8*, i8** %226, align 8
  %228 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %229 = load i64, i64* %228, align 8
  %230 = load float, float* %one.addr, align 4
  %231 = load float, float* %k.addr.3, align 4
  %232 = fdiv float %230, %231
  %233 = fpext float %232 to double
  %234 = call i8* @nish_str_from_f64(double %233)
  %235 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.6 to i8*), i8* %234)
  %236 = call i8* @nish_str_concat(i8* %235, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %237 = load i32, i32* %id.addr, align 4
  %238 = call i8* @nish_str_from_i32(i32 %237)
  %239 = call i8* @nish_str_concat(i8* %236, i8* %238)
  call void @nish_print(i8* %239)
  %240 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %241 = load i8*, i8** %240, align 8
  %242 = icmp eq i8* %241, %227
  br i1 %242, label %pass.rewind.5, label %pass.free.5

pass.rewind.5:
  %243 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %229, i64* %243, align 8
  br label %pass.done.5

pass.free.5:
  %244 = ptrtoint i8* %227 to i64
  %245 = add i64 %244, %229
  call void @nish_arena_release(i64 %245)
  br label %pass.done.5

pass.done.5:
  br label %walk.inc.5

walk.inc.5:
  %246 = add i32 %223, 1
  %247 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %221, i32 %246)
  store i32 %247, i32* %walk.idx.5, align 4
  br label %walk.cond.5

walk.end.5:
  call void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* %221)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = add nsw i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = mul nsw i32 %live, 2
  %4 = icmp slt i32 %3, %used
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %5 = load i32, i32* %n.addr, align 4
  %6 = mul nsw i32 %5, 2
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %12 = mul i64 %7, 4
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !10, !noalias !9
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  ret %struct.nish_array* %9
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = sub nsw i32 %used, 1
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %6
  store i32 %8, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.else:
  %13 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !20
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !21
  %2 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !22
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !23
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !10, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !24
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !25
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !26
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %30 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, float noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !21
  %4 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = call i64 @nish.probeTable$f32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, float %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f32$i32* @nish.Map$f32$i32.set(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) %this, float noundef %key, i32 noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %this, float %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f32$i32.setValueAt(%struct.Map$f32$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %this, i64 %5, float %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$f32$i32* %this
}

define internal void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !23
  ret void
}

define internal noundef i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = sub nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !23
  ret void
}

define internal noundef float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !25
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to float*
  %17 = getelementptr inbounds float, float* %16, i64 %10
  %18 = load float, float* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  ret float %18
}

define internal noundef i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  %18 = load i32, i32* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret i32 %18
}

define internal void @nish.Map$f32$i32.setValueAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #3 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, float noundef %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !22
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !23
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.8 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !25
  %21 = fadd float %key, 0.000000e+00
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %29 = bitcast i8* %28 to float*
  %30 = getelementptr inbounds float, float* %29, i64 %23
  store float %21, float* %30, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = trunc i64 %31 to i32
  %33 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !26
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 4)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %value, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !27
  %48 = load i32, i32* %h.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store.2

push.store.2:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  store i32 %48, i32* %57, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %58 = add i64 %50, 1
  store i64 %58, i64* %49, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %59 = trunc i64 %58 to i32
  %60 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %61 = load i32, i32* %60, align 4, !tbaa !22
  %62 = add nsw i32 %61, 1
  %63 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  store i32 %62, i32* %63, align 4, !tbaa !22
  %64 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  %65 = load i32, i32* %64, align 4, !tbaa !20
  %66 = add nsw i32 %65, 1
  %67 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  store i32 %66, i32* %67, align 4, !tbaa !20
  %68 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %69 = load %struct.nish_array*, %struct.nish_array** %68, align 8, !tbaa !25
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %72 = trunc i64 %71 to i32
  store i32 %72, i32* %used.addr, align 4
  %73 = load i32, i32* %used.addr, align 4
  %74 = mul nsw i32 %73, 4
  %75 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %76 = load %struct.nish_array*, %struct.nish_array** %75, align 8, !tbaa !24
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %79 = trunc i64 %78 to i32
  %80 = mul nsw i32 %79, 3
  %81 = icmp sgt i32 %74, %80
  br i1 %81, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* %this)
  br label %if.end.2

if.else:
  %82 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8, !tbaa !24
  %84 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  %85 = load i32, i32* %84, align 4, !tbaa !21
  %86 = load i32, i32* %bucket.addr, align 4
  %87 = load i32, i32* %h.addr, align 4
  %88 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %83, i32 %85, i32 %86, i32 %87, i32 %88)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !23
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !22
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !25
  %26 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !27
  call void @nish.compactEntries$f32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !26
  %30 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !27
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !24
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !21
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Set$f32.constructor(%struct.Set$f32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !30
  %2 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !31
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !32
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !10, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !33
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !34
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !35
  ret void
}

define internal noundef i64 @nish.Set$f32.probe(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, float noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !33
  %2 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !30
  %4 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !35
  %6 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = call i64 @nish.probeTable$f32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, float %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) %this, float noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$f32.probe(%struct.Set$f32* %this, float %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$f32.insertAt(%struct.Set$f32* %this, i64 %3, float %key)
  br label %if.end

if.end:
  ret %struct.Set$f32* %this
}

define internal void @nish.Set$f32.walkOpen(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef i32 @nish.Set$f32.walkNext(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$f32.walkClose(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = sub nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef float @nish.Set$f32.keyAt(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !34
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.9 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !34
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to float*
  %17 = getelementptr inbounds float, float* %16, i64 %10
  %18 = load float, float* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  ret float %18
}

define internal void @nish.Set$f32.insertAt(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, float noundef %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %16 = load i32, i32* %15, align 4, !tbaa !32
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$f32.rebuild(%struct.Set$f32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !34
  %21 = fadd float %key, 0.000000e+00
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %29 = bitcast i8* %28 to float*
  %30 = getelementptr inbounds float, float* %29, i64 %23
  store float %21, float* %30, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = trunc i64 %31 to i32
  %33 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !35
  %35 = load i32, i32* %h.addr, align 4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 4)
  br label %push.store.1

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %37
  store i32 %35, i32* %44, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %46 = trunc i64 %45 to i32
  %47 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %48 = load i32, i32* %47, align 4, !tbaa !31
  %49 = add nsw i32 %48, 1
  %50 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  store i32 %49, i32* %50, align 4, !tbaa !31
  %51 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  %52 = load i32, i32* %51, align 4, !tbaa !5
  %53 = add nsw i32 %52, 1
  %54 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  store i32 %53, i32* %54, align 4, !tbaa !5
  %55 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %56 = load %struct.nish_array*, %struct.nish_array** %55, align 8, !tbaa !34
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %59 = trunc i64 %58 to i32
  store i32 %59, i32* %used.addr, align 4
  %60 = load i32, i32* %used.addr, align 4
  %61 = mul nsw i32 %60, 4
  %62 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %63 = load %struct.nish_array*, %struct.nish_array** %62, align 8, !tbaa !33
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %66 = trunc i64 %65 to i32
  %67 = mul nsw i32 %66, 3
  %68 = icmp sgt i32 %61, %67
  br i1 %68, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$f32.rebuild(%struct.Set$f32* %this)
  br label %if.end.2

if.else:
  %69 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %70 = load %struct.nish_array*, %struct.nish_array** %69, align 8, !tbaa !33
  %71 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  %72 = load i32, i32* %71, align 4, !tbaa !30
  %73 = load i32, i32* %bucket.addr, align 4
  %74 = load i32, i32* %h.addr, align 4
  %75 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %70, i32 %72, i32 %73, i32 %74, i32 %75)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Set$f32.rebuild(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !32
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !33
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !31
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !34
  %26 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !35
  call void @nish.compactEntries$f32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !35
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !33
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !30
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !35
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
  ret void
}

define internal noundef i64 @nish.probeTable$f32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, float noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = fpext float %key to double
  %1 = fadd double %0, 0.000000e+00
  %2 = fcmp uno double %1, %1
  %3 = bitcast double %1 to i64
  %4 = select i1 %2, i64 9221120237041090560, i64 %3
  %5 = lshr i64 %4, 33
  %6 = xor i64 %4, %5
  %7 = mul i64 %6, -49064778989728563
  %8 = lshr i64 %7, 33
  %9 = xor i64 %7, %8
  %10 = mul i64 %9, -4265267296055464877
  %11 = lshr i64 %10, 33
  %12 = xor i64 %10, %11
  %13 = trunc i64 %12 to i32
  %14 = lshr i64 %12, 32
  %15 = trunc i64 %14 to i32
  %16 = xor i32 %13, %15
  %17 = icmp eq i32 %16, 0
  %18 = select i1 %17, i32 1, i32 %16
  store i32 %18, i32* %h.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = lshr i32 %19, 24
  store i32 %20, i32* %fingerprint.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = call i32 @nish.homeBucket(i32 %21, i32 %mask)
  store i32 %22, i32* %bucket.addr, align 4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %35 = load i32, i32* %bucket.addr, align 4
  %36 = icmp sge i32 %35, 0
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = trunc i64 %24 to i32
  %39 = icmp slt i32 %37, %38
  br label %land.end

land.end:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = load i32, i32* %bucket.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %26 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %45, i32* %word.addr, align 4
  %46 = load i32, i32* %word.addr, align 4
  %47 = icmp eq i32 %46, 0
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load i32, i32* %bucket.addr, align 4
  %49 = load i32, i32* %h.addr, align 4
  %50 = tail call i64 @nish.absentAt(i32 %48, i32 %49)
  ret i64 %50

if.end:
  %51 = load i32, i32* %word.addr, align 4
  %52 = lshr i32 %51, 24
  %53 = load i32, i32* %fingerprint.addr, align 4
  %54 = icmp eq i32 %52, %53
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  %55 = load i32, i32* %word.addr, align 4
  %56 = and i32 %55, 16777215
  %57 = sub nsw i32 %56, 1
  store i32 %57, i32* %at.addr, align 4
  %58 = load i32, i32* %at.addr, align 4
  %59 = icmp sge i32 %58, 0
  br i1 %59, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %60 = load i32, i32* %at.addr, align 4
  %61 = trunc i64 %28 to i32
  %62 = icmp slt i32 %60, %61
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %if.then.1 ], [ %62, %land.rhs.4 ]
  br i1 %63, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %64 = load i32, i32* %at.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %30 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %69 = load i32, i32* %h.addr, align 4
  %70 = icmp eq i32 %68, %69
  br label %land.end.3

land.end.3:
  %71 = phi i1 [ false, %land.end.4 ], [ %70, %land.rhs.3 ]
  br i1 %71, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %72 = load i32, i32* %at.addr, align 4
  %73 = trunc i64 %32 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.2

land.end.2:
  %75 = phi i1 [ false, %land.end.3 ], [ %74, %land.rhs.2 ]
  br i1 %75, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %76 = load i32, i32* %at.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = bitcast i8* %34 to float*
  %79 = getelementptr inbounds float, float* %78, i64 %77
  %80 = load float, float* %79, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %81 = fcmp oeq float %80, %key
  %82 = fcmp uno float %80, %80
  %83 = fcmp uno float %key, %key
  %84 = and i1 %82, %83
  %85 = or i1 %81, %84
  br label %land.end.1

land.end.1:
  %86 = phi i1 [ false, %land.end.2 ], [ %85, %land.rhs.1 ]
  br i1 %86, label %if.then.2, label %if.end.2

if.then.2:
  %87 = load i32, i32* %bucket.addr, align 4
  %88 = load i32, i32* %at.addr, align 4
  %89 = tail call i64 @nish.foundAt(i32 %87, i32 %88)
  ret i64 %89

if.end.2:
  br label %if.end.1

if.end.1:
  %90 = load i32, i32* %bucket.addr, align 4
  %91 = add nsw i32 %90, 1
  %92 = and i32 %91, %mask
  store i32 %92, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.11 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$f32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to float*
  %40 = getelementptr inbounds float, float* %39, i64 %38
  %41 = load float, float* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %42 = bitcast i8* %10 to float*
  %43 = getelementptr inbounds float, float* %42, i64 %36
  store float %41, float* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to float*
  %60 = getelementptr inbounds float, float* %59, i64 %56
  %61 = load float, float* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Set$f32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !2, i64 40}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!"Map$f32$i32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !2, i64 48}
!20 = !{!19, !2, i64 0}
!21 = !{!19, !2, i64 16}
!22 = !{!19, !2, i64 20}
!23 = !{!19, !2, i64 48}
!24 = !{!19, !3, i64 8}
!25 = !{!19, !3, i64 24}
!26 = !{!19, !3, i64 32}
!27 = !{!19, !3, i64 40}
!28 = !{!"element float", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!4, !2, i64 16}
!31 = !{!4, !2, i64 20}
!32 = !{!4, !2, i64 40}
!33 = !{!4, !3, i64 8}
!34 = !{!4, !3, i64 24}
!35 = !{!4, !3, i64 32}
