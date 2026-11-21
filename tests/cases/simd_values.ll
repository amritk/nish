%struct.Particle = type { i32, <2 x double>, <2 x double> }
%struct.Map$i32$vec.i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.2 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal void @nish.int.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_int_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.2 to i8*))
  unreachable
mark:
  %r0 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r0.s1 = lshr i64 %r0, 30
  %r0.x1 = xor i64 %r0, %r0.s1
  %r0.m1 = mul i64 %r0.x1, -4658895280553007687
  %r0.s2 = lshr i64 %r0.m1, 27
  %r0.x2 = xor i64 %r0.m1, %r0.s2
  %r0.m2 = mul i64 %r0.x2, -7723592293110705685
  %r0.s3 = lshr i64 %r0.m2, 31
  %r0.x3 = xor i64 %r0.m2, %r0.s3
  store i64 %r0.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %r1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %r1.s1 = lshr i64 %r1, 30
  %r1.x1 = xor i64 %r1, %r1.s1
  %r1.m1 = mul i64 %r1.x1, -4658895280553007687
  %r1.s2 = lshr i64 %r1.m1, 27
  %r1.x2 = xor i64 %r1.m1, %r1.s2
  %r1.m2 = mul i64 %r1.x2, -7723592293110705685
  %r1.s3 = lshr i64 %r1.m2, 31
  %r1.x3 = xor i64 %r1.m2, %r1.s3
  store i64 %r1.x3, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

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

define internal void @Particle.constructor(%struct.Particle* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, i32 noundef %id, <2 x double> noundef %pos, <2 x double> noundef %vel) #0 {
entry:
  %0 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 1
  store <2 x double> %pos, <2 x double>* %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 2
  store <2 x double> %vel, <2 x double>* %2, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @sum4(<4 x i32> noundef %v) #1 {
entry:
  %0 = extractelement <4 x i32> %v, i32 0
  %1 = extractelement <4 x i32> %v, i32 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = extractelement <4 x i32> %v, i32 2
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = extractelement <4 x i32> %v, i32 3
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef <4 x i32> @bump(<4 x i32> noundef %v) #1 {
entry:
  %0 = extractelement <4 x i32> %v, i32 0
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = insertelement <4 x i32> %v, i32 %2, i32 0
  ret <4 x i32> %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %r.addr = alloca <4 x i32>, align 8
  %forof.idx = alloca i64, align 8
  %p.addr = alloca %struct.Particle*, align 8
  %Particle.obj = alloca %struct.Particle, align 8
  %v.addr = alloca <4 x i32>, align 8
  %kept.addr = alloca <4 x i32>, align 8
  %named.addr = alloca %struct.Map$i32$vec.i32*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = insertelement <4 x i32> undef, i32 %6, i32 0
  %8 = load i32, i32* %i.addr, align 4
  %9 = mul nsw i32 %8, 2
  %10 = insertelement <4 x i32> %7, i32 %9, i32 1
  %11 = load i32, i32* %i.addr, align 4
  %12 = mul nsw i32 %11, 3
  %13 = insertelement <4 x i32> %10, i32 %12, i32 2
  %14 = load i32, i32* %i.addr, align 4
  %15 = mul nsw i32 %14, 4
  %16 = insertelement <4 x i32> %13, i32 %15, i32 3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 16)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %24 = bitcast i8* %23 to <4 x i32>*
  %25 = getelementptr inbounds <4 x i32>, <4 x i32>* %24, i64 %18
  store <4 x i32> %16, <4 x i32>* %25, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %27 = trunc i64 %26 to i32
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %34 = icmp ult i64 1, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %37 = bitcast i8* %36 to <4 x i32>*
  %38 = getelementptr inbounds <4 x i32>, <4 x i32>* %37, i64 1
  %39 = load <4 x i32>, <4 x i32>* %38, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %40 = call <4 x i32> @bump(<4 x i32> %39)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %43 = bitcast i8* %42 to <4 x i32>*
  %44 = getelementptr inbounds <4 x i32>, <4 x i32>* %43, i64 1
  store <4 x i32> %40, <4 x i32>* %44, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store i32 0, i32* %total.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %46 = load i64, i64* %forof.idx, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %49 = icmp ult i64 %46, %48
  br i1 %49, label %forof.body, label %forof.end

forof.body:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %52 = bitcast i8* %51 to <4 x i32>*
  %53 = getelementptr inbounds <4 x i32>, <4 x i32>* %52, i64 %46
  %54 = load <4 x i32>, <4 x i32>* %53, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store <4 x i32> %54, <4 x i32>* %r.addr, align 8
  %55 = load i32, i32* %total.addr, align 4
  %56 = load <4 x i32>, <4 x i32>* %r.addr, align 8
  %57 = call i32 @sum4(<4 x i32> %56)
  %58 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %55, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %59, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %61 = load i64, i64* %forof.idx, align 8
  %62 = add i64 %61, 1
  store i64 %62, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %63 = load i32, i32* %total.addr, align 4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  call void @nish_print(i8* %64)
  %65 = insertelement <2 x double> undef, double 0x3FE0000000000000, i32 0
  %66 = insertelement <2 x double> %65, double 0x3FF8000000000000, i32 1
  %67 = insertelement <2 x double> undef, double 0x3FD0000000000000, i32 0
  %68 = fneg double 0x3FD0000000000000
  %69 = insertelement <2 x double> %67, double %68, i32 1
  call void @Particle.constructor(%struct.Particle* %Particle.obj, i32 1, <2 x double> %66, <2 x double> %69)
  store %struct.Particle* %Particle.obj, %struct.Particle** %p.addr, align 8
  %70 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %71 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %72 = getelementptr inbounds %struct.Particle, %struct.Particle* %71, i32 0, i32 1
  %73 = load <2 x double>, <2 x double>* %72, align 8, !tbaa !6
  %74 = extractelement <2 x double> %73, i32 0
  %75 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %76 = getelementptr inbounds %struct.Particle, %struct.Particle* %75, i32 0, i32 2
  %77 = load <2 x double>, <2 x double>* %76, align 8, !tbaa !7
  %78 = extractelement <2 x double> %77, i32 0
  %79 = fadd double %74, %78
  %80 = insertelement <2 x double> undef, double %79, i32 0
  %81 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %82 = getelementptr inbounds %struct.Particle, %struct.Particle* %81, i32 0, i32 1
  %83 = load <2 x double>, <2 x double>* %82, align 8, !tbaa !6
  %84 = extractelement <2 x double> %83, i32 1
  %85 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %86 = getelementptr inbounds %struct.Particle, %struct.Particle* %85, i32 0, i32 2
  %87 = load <2 x double>, <2 x double>* %86, align 8, !tbaa !7
  %88 = extractelement <2 x double> %87, i32 1
  %89 = fadd double %84, %88
  %90 = insertelement <2 x double> %80, double %89, i32 1
  %91 = getelementptr inbounds %struct.Particle, %struct.Particle* %70, i32 0, i32 1
  store <2 x double> %90, <2 x double>* %91, align 8, !tbaa !6
  %92 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %93 = getelementptr inbounds %struct.Particle, %struct.Particle* %92, i32 0, i32 1
  %94 = load <2 x double>, <2 x double>* %93, align 8, !tbaa !6
  %95 = extractelement <2 x double> %94, i32 0
  %96 = call i8* @nish_str_from_f64(double %95)
  call void @nish_print(i8* %96)
  %97 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %98 = getelementptr inbounds %struct.Particle, %struct.Particle* %97, i32 0, i32 1
  %99 = load <2 x double>, <2 x double>* %98, align 8, !tbaa !6
  %100 = extractelement <2 x double> %99, i32 1
  %101 = call i8* @nish_str_from_f64(double %100)
  call void @nish_print(i8* %101)
  %102 = insertelement <4 x i32> undef, i32 9, i32 0
  %103 = shufflevector <4 x i32> %102, <4 x i32> undef, <4 x i32> zeroinitializer
  store <4 x i32> %103, <4 x i32>* %v.addr, align 8
  %104 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  store <4 x i32> %104, <4 x i32>* %kept.addr, align 8
  %105 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %106 = call <4 x i32> @bump(<4 x i32> %105)
  store <4 x i32> %106, <4 x i32>* %v.addr, align 8
  %107 = load <4 x i32>, <4 x i32>* %kept.addr, align 8
  %108 = call i32 @sum4(<4 x i32> %107)
  %109 = call i8* @nish_str_from_i32(i32 %108)
  call void @nish_print(i8* %109)
  %110 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %111 = call i32 @sum4(<4 x i32> %110)
  %112 = call i8* @nish_str_from_i32(i32 %111)
  call void @nish_print(i8* %112)
  %113 = call i8* @nish_alloc_struct(i64 56)
  %114 = bitcast i8* %113 to %struct.Map$i32$vec.i32*
  call void @nish.Map$i32$vec.i32.constructor(%struct.Map$i32$vec.i32* %114)
  store %struct.Map$i32$vec.i32* %114, %struct.Map$i32$vec.i32** %named.addr, align 8
  %115 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %116 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %117 = call %struct.Map$i32$vec.i32* @nish.Map$i32$vec.i32.set(%struct.Map$i32$vec.i32* %115, i32 7, <4 x i32> %116)
  %118 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %119 = call i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* %118, i32 7)
  %120 = icmp sge i64 %119, 0
  br i1 %120, label %get.found, label %get.end

get.found:
  %121 = trunc i64 %119 to i32
  %122 = call <4 x i32> @nish.Map$i32$vec.i32.valueAt(%struct.Map$i32$vec.i32* %118, i32 %121, <4 x i32> zeroinitializer)
  br label %get.end

get.end:
  %123 = phi <4 x i32> [ %122, %get.found ], [ zeroinitializer, %forof.end ]
  br i1 %120, label %if.then, label %if.end

if.then:
  %124 = call i32 @sum4(<4 x i32> %123)
  %125 = call i8* @nish_str_from_i32(i32 %124)
  call void @nish_print(i8* %125)
  br label %if.end

if.end:
  %126 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %127 = call i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* %126, i32 8)
  %128 = icmp sge i64 %127, 0
  %129 = xor i1 %128, true
  %130 = select i1 %129, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %130)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %b.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %b.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %6 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add i32 %24, 1
  %26 = load i32, i32* %low.addr, align 4
  %27 = and i32 %25, %26
  store i32 %27, i32* %bucket.addr, align 4
  %28 = load i32, i32* %bucket.addr, align 4
  store i32 %28, i32* %b.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  %12 = load i32, i32* %11, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  store i32 %24, i32* %26, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  %32 = load i64, i64* %31, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %38 = trunc i64 %37 to i32
  %39 = icmp sgt i32 %38, 0
  br label %land.end.2

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %43 = sub i64 %42, 1
  store i64 %43, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  %48 = load i32, i32* %47, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %9, 32768
  br label %land.end

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = mul nsw i32 %12, 2
  %14 = trunc i32 %13 to i16
  %15 = zext i16 %14 to i64
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %15, i64* %18, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %15, i64* %19, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %20 = mul i64 %15, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !12, !noalias !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  ret %struct.nish_array* %17

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #0 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %times
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 0, i32* %16, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %18 = trunc i64 %17 to i32
  br label %for.inc.1

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  %15 = load i32, i32* %14, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  store i32 0, i32* %10, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %size.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = mul nsw i64 %7, 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = mul nsw i64 %10, 3
  %12 = icmp sgt i64 %8, %11
  br i1 %12, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4
  %16 = icmp sge i32 %bucket, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %18 = load i32, i32* %used.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = sext i32 %bucket to i64
  %21 = load i32, i32* %used.addr, align 4
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %23
  %28 = load i32, i32* %27, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %29 = load i32, i32* %used.addr, align 4
  %30 = sub nsw i32 %29, 1
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %20
  store i32 %31, i32* %35, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$i32$vec.i32.constructor(%struct.Map$i32$vec.i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !25
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !26
  %2 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !27
  %3 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !28
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !12, !noalias !11
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %11 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !29
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %17 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !30
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %23 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !31
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %29 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !32
  ret void
}

define internal noundef i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !29
  %2 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !26
  %4 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !32
  %6 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !30
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i32$vec.i32* @nish.Map$i32$vec.i32.set(%struct.Map$i32$vec.i32* noundef nonnull align 8 dereferenceable(56) %this, i32 noundef %key, <4 x i32> noundef %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* %this, i32 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i32$vec.i32.setValueAt(%struct.Map$i32$vec.i32* %this, i32 %4, <4 x i32> %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i32$vec.i32.insertAt(%struct.Map$i32$vec.i32* %this, i64 %5, i32 %key, <4 x i32> %value)
  br label %if.end

if.end:
  ret %struct.Map$i32$vec.i32* %this
}

define internal noundef <4 x i32> @nish.Map$i32$vec.i32.valueAt(%struct.Map$i32$vec.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, <4 x i32> noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !31
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !31
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = bitcast i8* %12 to <4 x i32>*
  %14 = getelementptr inbounds <4 x i32>, <4 x i32>* %13, i64 %10
  %15 = load <4 x i32>, <4 x i32>* %14, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  ret <4 x i32> %15

if.end:
  ret <4 x i32> %none
}

define internal void @nish.Map$i32$vec.i32.setValueAt(%struct.Map$i32$vec.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, <4 x i32> noundef %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !31
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !31
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = bitcast i8* %12 to <4 x i32>*
  %14 = getelementptr inbounds <4 x i32>, <4 x i32>* %13, i64 %10
  store <4 x i32> %value, <4 x i32>* %14, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$vec.i32.insertAt(%struct.Map$i32$vec.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i32 noundef %key, <4 x i32> noundef %value) #1 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !30
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %key, i32* %11, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !31
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 16)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %23 = bitcast i8* %22 to <4 x i32>*
  %24 = getelementptr inbounds <4 x i32>, <4 x i32>* %23, i64 %17
  store <4 x i32> %value, <4 x i32>* %24, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !32
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %41 = trunc i64 %40 to i32
  call void @nish.Map$i32$vec.i32.addOne(%struct.Map$i32$vec.i32* %this)
  %42 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !29
  %44 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !26
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !32
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$i32$vec.i32.rebuild(%struct.Map$i32$vec.i32* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i32$vec.i32.addOne(%struct.Map$i32$vec.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !27
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !27
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !25
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !25
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$i32$vec.i32.rebuild(%struct.Map$i32$vec.i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !30
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !28
  %7 = icmp ugt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !29
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !27
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
  %19 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !27
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !30
  %26 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !32
  call void @nish.compactEntries$i32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !31
  %30 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !32
  call void @nish.compactEntries$vec.i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !32
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !29
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !26
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !32
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = zext i32 %key to i64
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %2 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %3 = mul i64 %0, %1
  %4 = add i64 %3, %2
  %5 = lshr i64 %4, 32
  %6 = trunc i64 %5 to i32
  %7 = icmp eq i32 %6, 0
  %8 = select i1 %7, i32 1, i32 %6
  store i32 %8, i32* %h.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %9 = load i32, i32* %h.addr, align 4
  %10 = load i32, i32* %low.addr, align 4
  %11 = xor i32 %10, -1
  %12 = and i32 %9, %11
  store i32 %12, i32* %fingerprint.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = call i32 @nish.homeBucket(i32 %13, i32 %mask)
  store i32 %14, i32* %bucket.addr, align 4
  %15 = load i32, i32* %bucket.addr, align 4
  store i32 %15, i32* %b.addr, align 4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  br label %while.cond

while.cond:
  %28 = load i32, i32* %b.addr, align 4
  %29 = icmp sge i32 %28, 0
  br i1 %29, label %land.rhs, label %land.end

land.rhs:
  %30 = load i32, i32* %b.addr, align 4
  %31 = trunc i64 %17 to i32
  %32 = icmp slt i32 %30, %31
  br label %land.end

land.end:
  %33 = phi i1 [ false, %while.cond ], [ %32, %land.rhs ]
  br i1 %33, label %while.body, label %while.end

while.body:
  %34 = load i32, i32* %b.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %19 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %35
  %38 = load i32, i32* %37, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  store i32 %38, i32* %word.addr, align 4
  %39 = load i32, i32* %word.addr, align 4
  %40 = icmp eq i32 %39, 0
  br i1 %40, label %if.then, label %if.end

if.then:
  %41 = load i32, i32* %b.addr, align 4
  %42 = load i32, i32* %h.addr, align 4
  %43 = tail call i64 @nish.absentAt(i32 %41, i32 %42)
  ret i64 %43

if.end:
  %44 = load i32, i32* %word.addr, align 4
  %45 = load i32, i32* %low.addr, align 4
  %46 = xor i32 %45, -1
  %47 = and i32 %44, %46
  %48 = load i32, i32* %fingerprint.addr, align 4
  %49 = icmp eq i32 %47, %48
  br i1 %49, label %if.then.1, label %if.end.1

if.then.1:
  %50 = load i32, i32* %word.addr, align 4
  %51 = load i32, i32* %low.addr, align 4
  %52 = and i32 %50, %51
  %53 = sub i32 %52, 1
  store i32 %53, i32* %at.addr, align 4
  %54 = load i32, i32* %at.addr, align 4
  %55 = icmp sge i32 %54, 0
  br i1 %55, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4
  %57 = trunc i64 %21 to i32
  %58 = icmp slt i32 %56, %57
  br label %land.end.4

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ]
  br i1 %59, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = bitcast i8* %23 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %61
  %64 = load i32, i32* %63, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %65 = load i32, i32* %h.addr, align 4
  %66 = icmp eq i32 %64, %65
  br label %land.end.3

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ]
  br i1 %67, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4
  %69 = trunc i64 %25 to i32
  %70 = icmp slt i32 %68, %69
  br label %land.end.2

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ]
  br i1 %71, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = bitcast i8* %27 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %73
  %76 = load i32, i32* %75, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %77 = icmp eq i32 %76, %key
  br label %land.end.1

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ]
  br i1 %78, label %if.then.2, label %if.end.2

if.then.2:
  %79 = load i32, i32* %b.addr, align 4
  %80 = load i32, i32* %at.addr, align 4
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80)
  ret i64 %81

if.end.2:
  br label %if.end.1

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = add i32 %82, 1
  %84 = load i32, i32* %low.addr, align 4
  %85 = and i32 %83, %84
  store i32 %85, i32* %bucket.addr, align 4
  %86 = load i32, i32* %bucket.addr, align 4
  store i32 %86, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %89 = trunc i64 %88 to i32
  %90 = load i32, i32* %h.addr, align 4
  %91 = tail call i64 @nish.absentAt(i32 %89, i32 %90)
  ret i64 %91
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  %22 = load i32, i32* %21, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  %41 = load i32, i32* %40, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  %49 = load i64, i64* %48, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %60
  %65 = load i32, i32* %64, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$vec.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  %22 = load i32, i32* %21, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  %39 = bitcast i8* %10 to <4 x i32>*
  %40 = getelementptr inbounds <4 x i32>, <4 x i32>* %39, i64 %38
  %41 = load <4 x i32>, <4 x i32>* %40, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %42 = bitcast i8* %10 to <4 x i32>*
  %43 = getelementptr inbounds <4 x i32>, <4 x i32>* %42, i64 %36
  store <4 x i32> %41, <4 x i32>* %43, align 8, !alias.scope !12, !noalias !11, !tbaa !20
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
  %49 = load i64, i64* %48, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %63 = bitcast i8* %62 to <4 x i32>*
  %64 = getelementptr inbounds <4 x i32>, <4 x i32>* %63, i64 %60
  %65 = load <4 x i32>, <4 x i32>* %64, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!33, !34, !35, !36, !37}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"<2 x double>", !1, i64 0}
!4 = !{!"Particle", !2, i64 0, !3, i64 16, !3, i64 32}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 16}
!7 = !{!4, !3, i64 32}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"element <4 x i32>", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"ptr", !1, i64 0}
!24 = !{!"Map$i32$vec.i32", !2, i64 0, !23, i64 8, !2, i64 16, !2, i64 20, !23, i64 24, !23, i64 32, !23, i64 40, !2, i64 48}
!25 = !{!24, !2, i64 0}
!26 = !{!24, !2, i64 16}
!27 = !{!24, !2, i64 20}
!28 = !{!24, !2, i64 48}
!29 = !{!24, !23, i64 8}
!30 = !{!24, !23, i64 24}
!31 = !{!24, !23, i64 32}
!32 = !{!24, !23, i64 40}
!33 = !{i32 8, !"cf-protection-branch", i32 1}
!34 = !{i32 8, !"cf-protection-return", i32 1}
!35 = !{i32 8, !"branch-target-enforcement", i32 1}
!36 = !{i32 8, !"sign-return-address", i32 1}
!37 = !{i32 4, !"probe-stack", !"inline-asm"}
