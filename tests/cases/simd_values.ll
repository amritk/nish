%struct.Particle = type { i32, <2 x double>, <2 x double> }
%struct.Map$i32$vec.i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.5 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@.str.6 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.5 to i8*))
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
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %43 = icmp ult i64 1, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %46 = bitcast i8* %45 to <4 x i32>*
  %47 = getelementptr inbounds <4 x i32>, <4 x i32>* %46, i64 1
  store <4 x i32> %40, <4 x i32>* %47, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store i32 0, i32* %total.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %49 = load i64, i64* %forof.idx, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %forof.body, label %forof.end

forof.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %55 = bitcast i8* %54 to <4 x i32>*
  %56 = getelementptr inbounds <4 x i32>, <4 x i32>* %55, i64 %49
  %57 = load <4 x i32>, <4 x i32>* %56, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store <4 x i32> %57, <4 x i32>* %r.addr, align 8
  %58 = load i32, i32* %total.addr, align 4
  %59 = load <4 x i32>, <4 x i32>* %r.addr, align 8
  %60 = call i32 @sum4(<4 x i32> %59)
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %62, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = add i64 %64, 1
  store i64 %65, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %66 = load i32, i32* %total.addr, align 4
  %67 = call i8* @nish_str_from_i32(i32 %66)
  call void @nish_print(i8* %67)
  %68 = insertelement <2 x double> undef, double 0x3FE0000000000000, i32 0
  %69 = insertelement <2 x double> %68, double 0x3FF8000000000000, i32 1
  %70 = insertelement <2 x double> undef, double 0x3FD0000000000000, i32 0
  %71 = fneg double 0x3FD0000000000000
  %72 = insertelement <2 x double> %70, double %71, i32 1
  call void @Particle.constructor(%struct.Particle* %Particle.obj, i32 1, <2 x double> %69, <2 x double> %72)
  store %struct.Particle* %Particle.obj, %struct.Particle** %p.addr, align 8
  %73 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %74 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %75 = getelementptr inbounds %struct.Particle, %struct.Particle* %74, i32 0, i32 1
  %76 = load <2 x double>, <2 x double>* %75, align 8, !tbaa !6
  %77 = extractelement <2 x double> %76, i32 0
  %78 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %79 = getelementptr inbounds %struct.Particle, %struct.Particle* %78, i32 0, i32 2
  %80 = load <2 x double>, <2 x double>* %79, align 8, !tbaa !7
  %81 = extractelement <2 x double> %80, i32 0
  %82 = fadd double %77, %81
  %83 = insertelement <2 x double> undef, double %82, i32 0
  %84 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %85 = getelementptr inbounds %struct.Particle, %struct.Particle* %84, i32 0, i32 1
  %86 = load <2 x double>, <2 x double>* %85, align 8, !tbaa !6
  %87 = extractelement <2 x double> %86, i32 1
  %88 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %89 = getelementptr inbounds %struct.Particle, %struct.Particle* %88, i32 0, i32 2
  %90 = load <2 x double>, <2 x double>* %89, align 8, !tbaa !7
  %91 = extractelement <2 x double> %90, i32 1
  %92 = fadd double %87, %91
  %93 = insertelement <2 x double> %83, double %92, i32 1
  %94 = getelementptr inbounds %struct.Particle, %struct.Particle* %73, i32 0, i32 1
  store <2 x double> %93, <2 x double>* %94, align 8, !tbaa !6
  %95 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %96 = getelementptr inbounds %struct.Particle, %struct.Particle* %95, i32 0, i32 1
  %97 = load <2 x double>, <2 x double>* %96, align 8, !tbaa !6
  %98 = extractelement <2 x double> %97, i32 0
  %99 = call i8* @nish_str_from_f64(double %98)
  call void @nish_print(i8* %99)
  %100 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %101 = getelementptr inbounds %struct.Particle, %struct.Particle* %100, i32 0, i32 1
  %102 = load <2 x double>, <2 x double>* %101, align 8, !tbaa !6
  %103 = extractelement <2 x double> %102, i32 1
  %104 = call i8* @nish_str_from_f64(double %103)
  call void @nish_print(i8* %104)
  %105 = insertelement <4 x i32> undef, i32 9, i32 0
  %106 = shufflevector <4 x i32> %105, <4 x i32> undef, <4 x i32> zeroinitializer
  store <4 x i32> %106, <4 x i32>* %v.addr, align 8
  %107 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  store <4 x i32> %107, <4 x i32>* %kept.addr, align 8
  %108 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %109 = call <4 x i32> @bump(<4 x i32> %108)
  store <4 x i32> %109, <4 x i32>* %v.addr, align 8
  %110 = load <4 x i32>, <4 x i32>* %kept.addr, align 8
  %111 = call i32 @sum4(<4 x i32> %110)
  %112 = call i8* @nish_str_from_i32(i32 %111)
  call void @nish_print(i8* %112)
  %113 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %114 = call i32 @sum4(<4 x i32> %113)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  call void @nish_print(i8* %115)
  %116 = call i8* @nish_alloc_struct(i64 56)
  %117 = bitcast i8* %116 to %struct.Map$i32$vec.i32*
  call void @nish.Map$i32$vec.i32.constructor(%struct.Map$i32$vec.i32* %117)
  store %struct.Map$i32$vec.i32* %117, %struct.Map$i32$vec.i32** %named.addr, align 8
  %118 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %119 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %120 = call %struct.Map$i32$vec.i32* @nish.Map$i32$vec.i32.set(%struct.Map$i32$vec.i32* %118, i32 7, <4 x i32> %119)
  %121 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %122 = call i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* %121, i32 7)
  %123 = icmp sge i64 %122, 0
  br i1 %123, label %get.found, label %get.end

get.found:
  %124 = trunc i64 %122 to i32
  %125 = call <4 x i32> @nish.Map$i32$vec.i32.valueAt(%struct.Map$i32$vec.i32* %121, i32 %124)
  br label %get.end

get.end:
  %126 = phi <4 x i32> [ %125, %get.found ], [ zeroinitializer, %forof.end ]
  br i1 %123, label %if.then, label %if.end

if.then:
  %127 = call i32 @sum4(<4 x i32> %126)
  %128 = call i8* @nish_str_from_i32(i32 %127)
  call void @nish_print(i8* %128)
  br label %if.end

if.end:
  %129 = load %struct.Map$i32$vec.i32*, %struct.Map$i32$vec.i32** %named.addr, align 8
  %130 = call i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* %129, i32 8)
  %131 = icmp sge i64 %130, 0
  %132 = xor i1 %131, true
  %133 = select i1 %132, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %133)
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !11, !noalias !12, !tbaa !18
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
  %16 = load i32, i32* %15, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*))
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !12, !noalias !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
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

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #1 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i32$vec.i32.constructor(%struct.Map$i32$vec.i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !25
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !26
  %2 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !27
  %3 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !28
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 2147483647
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !12, !noalias !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !29
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %19 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !30
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %25 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !31
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %31 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !32
  ret void
}

define internal noundef i64 @nish.Map$i32$vec.i32.probe(%struct.Map$i32$vec.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %key) #1 {
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

define internal noundef <4 x i32> @nish.Map$i32$vec.i32.valueAt(%struct.Map$i32$vec.i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !31
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*))
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !31
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = bitcast i8* %12 to <4 x i32>*
  %14 = getelementptr inbounds <4 x i32>, <4 x i32>* %13, i64 %10
  %15 = load <4 x i32>, <4 x i32>* %14, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  ret <4 x i32> %15
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
  %6 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !30
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !27
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !28
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$i32$vec.i32.rebuild(%struct.Map$i32$vec.i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !30
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 4)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  store i32 %key, i32* %29, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !31
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 16)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %41 = bitcast i8* %40 to <4 x i32>*
  %42 = getelementptr inbounds <4 x i32>, <4 x i32>* %41, i64 %35
  store <4 x i32> %value, <4 x i32>* %42, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !32
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !27
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !27
  %65 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !25
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !25
  %71 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !30
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !29
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i32$vec.i32.rebuild(%struct.Map$i32$vec.i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !29
  %91 = getelementptr inbounds %struct.Map$i32$vec.i32, %struct.Map$i32$vec.i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !26
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
  %7 = icmp sgt i32 %6, 0
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

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #1 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
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
  %9 = load i32, i32* %h.addr, align 4
  %10 = lshr i32 %9, 24
  store i32 %10, i32* %fingerprint.addr, align 4
  %11 = load i32, i32* %h.addr, align 4
  %12 = call i32 @nish.homeBucket(i32 %11, i32 %mask)
  store i32 %12, i32* %bucket.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  br label %while.cond

while.cond:
  %25 = load i32, i32* %bucket.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs, label %land.end

land.rhs:
  %27 = load i32, i32* %bucket.addr, align 4
  %28 = trunc i64 %14 to i32
  %29 = icmp slt i32 %27, %28
  br label %land.end

land.end:
  %30 = phi i1 [ false, %while.cond ], [ %29, %land.rhs ]
  br i1 %30, label %while.body, label %while.end

while.body:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = bitcast i8* %16 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %32
  %35 = load i32, i32* %34, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  store i32 %35, i32* %word.addr, align 4
  %36 = load i32, i32* %word.addr, align 4
  %37 = icmp eq i32 %36, 0
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = load i32, i32* %h.addr, align 4
  %40 = tail call i64 @nish.absentAt(i32 %38, i32 %39)
  ret i64 %40

if.end:
  %41 = load i32, i32* %word.addr, align 4
  %42 = lshr i32 %41, 24
  %43 = load i32, i32* %fingerprint.addr, align 4
  %44 = icmp eq i32 %42, %43
  br i1 %44, label %if.then.1, label %if.end.1

if.then.1:
  %45 = load i32, i32* %word.addr, align 4
  %46 = and i32 %45, 16777215
  %47 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %46, i32 1)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %48, i32* %at.addr, align 4
  %50 = load i32, i32* %at.addr, align 4
  %51 = icmp sge i32 %50, 0
  br i1 %51, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %52 = load i32, i32* %at.addr, align 4
  %53 = trunc i64 %18 to i32
  %54 = icmp slt i32 %52, %53
  br label %land.end.4

land.end.4:
  %55 = phi i1 [ false, %ovf.ok ], [ %54, %land.rhs.4 ]
  br i1 %55, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %56 = load i32, i32* %at.addr, align 4
  %57 = sext i32 %56 to i64
  %58 = bitcast i8* %20 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %57
  %60 = load i32, i32* %59, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %61 = load i32, i32* %h.addr, align 4
  %62 = icmp eq i32 %60, %61
  br label %land.end.3

land.end.3:
  %63 = phi i1 [ false, %land.end.4 ], [ %62, %land.rhs.3 ]
  br i1 %63, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %64 = load i32, i32* %at.addr, align 4
  %65 = trunc i64 %22 to i32
  %66 = icmp slt i32 %64, %65
  br label %land.end.2

land.end.2:
  %67 = phi i1 [ false, %land.end.3 ], [ %66, %land.rhs.2 ]
  br i1 %67, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %68 = load i32, i32* %at.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = bitcast i8* %24 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %69
  %72 = load i32, i32* %71, align 4, !alias.scope !12, !noalias !11, !tbaa !22
  %73 = icmp eq i32 %72, %key
  br label %land.end.1

land.end.1:
  %74 = phi i1 [ false, %land.end.2 ], [ %73, %land.rhs.1 ]
  br i1 %74, label %if.then.2, label %if.end.2

if.then.2:
  %75 = load i32, i32* %bucket.addr, align 4
  %76 = load i32, i32* %at.addr, align 4
  %77 = tail call i64 @nish.foundAt(i32 %75, i32 %76)
  ret i64 %77

if.end.2:
  br label %if.end.1

if.end.1:
  %78 = load i32, i32* %bucket.addr, align 4
  %79 = add nsw i32 %78, 1
  %80 = and i32 %79, %mask
  store i32 %80, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.6 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !12, !noalias !11, !tbaa !22
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
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %59 = bitcast i8* %58 to <4 x i32>*
  %60 = getelementptr inbounds <4 x i32>, <4 x i32>* %59, i64 %56
  %61 = load <4 x i32>, <4 x i32>* %60, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
