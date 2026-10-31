%struct.Map$i64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@nish_int_hash_key = linkonce_odr global [2 x i64] zeroinitializer, align 8
@.str.6 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.int.hash.seed, i8* null }]
@.str.7 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1

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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.6 to i8*))
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

define internal noundef i64 @pack(i32 noundef %hi, i32 noundef %lo) #0 {
entry:
  %0 = sext i32 %hi to i64
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4040000000000000)
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = sext i32 %lo to i64
  %5 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %3, i64 %4)
  %6 = extractvalue { i64, i1 } %5, 0
  %7 = extractvalue { i64, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %grid.addr = alloca %struct.Map$i64$f64*, align 8
  %cell.addr = alloca double, align 8
  %y.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %swapped.addr = alloca double, align 8
  %corner.addr = alloca double, align 8
  %absent.addr = alloca double, align 8
  %walked.addr = alloca i32, align 4
  %last.addr = alloca i64, align 8
  %key.addr = alloca i64, align 8
  %walk.idx = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$i64$f64*
  call void @nish.Map$i64$f64.constructor(%struct.Map$i64$f64* %1)
  store %struct.Map$i64$f64* %1, %struct.Map$i64$f64** %grid.addr, align 8
  store double 0x0000000000000000, double* %cell.addr, align 8
  store i32 -2, i32* %y.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %y.addr, align 4
  %3 = icmp sle i32 %2, 2
  br i1 %3, label %for.body, label %for.end

for.body:
  store i32 -2, i32* %x.addr, align 4
  br label %for.cond.1

for.cond.1:
  %4 = load i32, i32* %x.addr, align 4
  %5 = icmp sle i32 %4, 2
  br i1 %5, label %for.body.1, label %for.end.1

for.body.1:
  %6 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %7 = load i32, i32* %y.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = call i64 @pack(i32 %7, i32 %8)
  %10 = load double, double* %cell.addr, align 8
  %11 = call %struct.Map$i64$f64* @nish.Map$i64$f64.set(%struct.Map$i64$f64* %6, i64 %9, double %10)
  %12 = load double, double* %cell.addr, align 8
  %13 = fadd double %12, 0x3FF0000000000000
  store double %13, double* %cell.addr, align 8
  br label %for.inc.1

for.inc.1:
  %14 = load i32, i32* %x.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %x.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %16 = load i32, i32* %y.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %y.addr, align 4
  br label %for.cond

for.end:
  %18 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %19 = call i64 @pack(i32 -1, i32 -1)
  %20 = call %struct.Map$i64$f64* @nish.Map$i64$f64.set(%struct.Map$i64$f64* %18, i64 %19, double 0x4058C00000000000)
  %21 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %22 = call i64 @pack(i32 2147483647, i32 -2147483648)
  %23 = call %struct.Map$i64$f64* @nish.Map$i64$f64.set(%struct.Map$i64$f64* %21, i64 %22, double 0x401C000000000000)
  %24 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %25 = call i64 @pack(i32 -2147483648, i32 2147483647)
  %26 = call %struct.Map$i64$f64* @nish.Map$i64$f64.set(%struct.Map$i64$f64* %24, i64 %25, double 0x4020000000000000)
  %27 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %28 = call i64 @pack(i32 1, i32 -2)
  %29 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %27, i64 %28)
  %30 = icmp sge i64 %29, 0
  br i1 %30, label %nullish.value, label %nullish.default

nullish.value:
  %31 = trunc i64 %29 to i32
  %32 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %27, i32 %31)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %33 = phi double [ %32, %nullish.value ], [ 0x0000000000000000, %nullish.default ]
  store double %33, double* %swapped.addr, align 8
  %34 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %35 = call i64 @pack(i32 -2, i32 1)
  %36 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %34, i64 %35)
  %37 = icmp sge i64 %36, 0
  br i1 %37, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %38 = trunc i64 %36 to i32
  %39 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %34, i32 %38)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %40 = phi double [ %39, %nullish.value.1 ], [ 0x0000000000000000, %nullish.default.1 ]
  store double %40, double* %corner.addr, align 8
  %41 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %42 = call i64 @pack(i32 3, i32 0)
  %43 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %41, i64 %42)
  %44 = icmp sge i64 %43, 0
  br i1 %44, label %nullish.value.2, label %nullish.default.2

nullish.value.2:
  %45 = trunc i64 %43 to i32
  %46 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %41, i32 %45)
  br label %nullish.end.2

nullish.default.2:
  %47 = fneg double 0x3FF0000000000000
  br label %nullish.end.2

nullish.end.2:
  %48 = phi double [ %46, %nullish.value.2 ], [ %47, %nullish.default.2 ]
  store double %48, double* %absent.addr, align 8
  %49 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %50 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %49, i32 0, i32 0
  %51 = load double, double* %50, align 8, !tbaa !6
  %52 = call i8* @nish_str_from_f64(double %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %54 = load double, double* %swapped.addr, align 8
  %55 = call i8* @nish_str_from_f64(double %54)
  %56 = call i8* @nish_str_concat(i8* %53, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = load double, double* %corner.addr, align 8
  %59 = call i8* @nish_str_from_f64(double %58)
  %60 = call i8* @nish_str_concat(i8* %57, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %62 = load double, double* %absent.addr, align 8
  %63 = call i8* @nish_str_from_f64(double %62)
  %64 = call i8* @nish_str_concat(i8* %61, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %66 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %67 = call i64 @pack(i32 -1, i32 -1)
  %68 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %66, i64 %67)
  %69 = icmp sge i64 %68, 0
  br i1 %69, label %nullish.value.3, label %nullish.default.3

nullish.value.3:
  %70 = trunc i64 %68 to i32
  %71 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %66, i32 %70)
  br label %nullish.end.3

nullish.default.3:
  br label %nullish.end.3

nullish.end.3:
  %72 = phi double [ %71, %nullish.value.3 ], [ 0x0000000000000000, %nullish.default.3 ]
  %73 = call i8* @nish_str_from_f64(double %72)
  %74 = call i8* @nish_str_concat(i8* %65, i8* %73)
  call void @nish_print(i8* %74)
  %75 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %76 = call i64 @pack(i32 0, i32 -1)
  %77 = call i1 @nish.Map$i64$f64.has(%struct.Map$i64$f64* %75, i64 %76)
  %78 = select i1 %77, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %80 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %81 = call i64 @pack(i32 -1, i32 0)
  %82 = call i1 @nish.Map$i64$f64.has(%struct.Map$i64$f64* %80, i64 %81)
  %83 = select i1 %82, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %84 = call i8* @nish_str_concat(i8* %79, i8* %83)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %86 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %87 = call i64 @pack(i32 0, i32 4)
  %88 = call i1 @nish.Map$i64$f64.has(%struct.Map$i64$f64* %86, i64 %87)
  %89 = select i1 %88, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %90 = call i8* @nish_str_concat(i8* %85, i8* %89)
  call void @nish_print(i8* %90)
  %91 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %92 = call i64 @pack(i32 0, i32 0)
  %93 = call i1 @nish.Map$i64$f64.delete(%struct.Map$i64$f64* %91, i64 %92)
  store i32 0, i32* %walked.addr, align 4
  %94 = call i64 @llvm.fptosi.sat.i64.f64(double 0x0000000000000000)
  store i64 %94, i64* %last.addr, align 8
  %95 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  call void @nish.Map$i64$f64.walkOpen(%struct.Map$i64$f64* %95)
  %96 = call i32 @nish.Map$i64$f64.walkNext(%struct.Map$i64$f64* %95, i32 0)
  store i32 %96, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %97 = load i32, i32* %walk.idx, align 4
  %98 = icmp sge i32 %97, 0
  br i1 %98, label %walk.body, label %walk.end

walk.body:
  %99 = call i64 @nish.Map$i64$f64.keyAt(%struct.Map$i64$f64* %95, i32 %97)
  store i64 %99, i64* %key.addr, align 8
  %100 = load i32, i32* %walked.addr, align 4
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %100, i32 1)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %102, i32* %walked.addr, align 4
  %104 = load i64, i64* %key.addr, align 8
  store i64 %104, i64* %last.addr, align 8
  br label %walk.inc

walk.inc:
  %105 = add i32 %97, 1
  %106 = call i32 @nish.Map$i64$f64.walkNext(%struct.Map$i64$f64* %95, i32 %105)
  store i32 %106, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$i64$f64.walkClose(%struct.Map$i64$f64* %95)
  %107 = load i32, i32* %walked.addr, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %110 = load i64, i64* %last.addr, align 8
  %111 = call i8* @nish_str_from_i64(i64 %110)
  %112 = call i8* @nish_str_concat(i8* %109, i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %114 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %115 = call i64 @pack(i32 2147483647, i32 -2147483648)
  %116 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %114, i64 %115)
  %117 = icmp sge i64 %116, 0
  br i1 %117, label %nullish.value.4, label %nullish.default.4

nullish.value.4:
  %118 = trunc i64 %116 to i32
  %119 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %114, i32 %118)
  br label %nullish.end.4

nullish.default.4:
  br label %nullish.end.4

nullish.end.4:
  %120 = phi double [ %119, %nullish.value.4 ], [ 0x0000000000000000, %nullish.default.4 ]
  %121 = call i8* @nish_str_from_f64(double %120)
  %122 = call i8* @nish_str_concat(i8* %113, i8* %121)
  %123 = call i8* @nish_str_concat(i8* %122, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %124 = load %struct.Map$i64$f64*, %struct.Map$i64$f64** %grid.addr, align 8
  %125 = load i64, i64* %last.addr, align 8
  %126 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %124, i64 %125)
  %127 = icmp sge i64 %126, 0
  br i1 %127, label %nullish.value.5, label %nullish.default.5

nullish.value.5:
  %128 = trunc i64 %126 to i32
  %129 = call double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* %124, i32 %128)
  br label %nullish.end.5

nullish.default.5:
  br label %nullish.end.5

nullish.end.5:
  %130 = phi double [ %129, %nullish.value.5 ], [ 0x0000000000000000, %nullish.default.5 ]
  %131 = call i8* @nish_str_from_f64(double %130)
  %132 = call i8* @nish_str_concat(i8* %123, i8* %131)
  call void @nish_print(i8* %132)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

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

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
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

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #0 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %0)
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %1, i64 %5)
  %7 = extractvalue { i64, i1 } %6, 0
  %8 = extractvalue { i64, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %7

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = sitofp i64 %3 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  %11 = icmp slt i32 %8, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %bucket.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %5 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add nsw i32 %24, 1
  %26 = and i32 %25, %mask
  store i32 %26, i32* %bucket.addr, align 4
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
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %6 = load i32, i32* %from.addr, align 4
  %7 = load i32, i32* %used.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %to.addr, align 4
  %17 = icmp sge i32 %16, 0
  br label %land.end.1

land.end.1:
  %18 = phi i1 [ false, %for.body ], [ %17, %land.rhs.1 ]
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %to.addr, align 4
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp slt i32 %19, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i32, i32* %to.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %h.addr, align 4
  %26 = bitcast i8* %5 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %24
  store i32 %25, i32* %27, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %28 = load i32, i32* %to.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %from.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = icmp slt i32 %5, %used
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %8 = load i32, i32* %n.addr, align 4
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 2)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = sext i32 %10 to i64
  %13 = icmp ule i64 %12, 9007199254740992
  br i1 %13, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*))
  unreachable

len.ok:
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 %12, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 %12, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %18 = mul i64 %12, 4
  %19 = call i8* @nish_alloc_struct(i64 %18)
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !11, !noalias !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret %struct.nish_array* %15

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = icmp ne i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %mask.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %20, i32 %21, i32 %22)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #2 {
entry:
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = trunc i64 %found to i32
  store i32 %0, i32* %at.addr, align 4
  %1 = ashr i64 %found, 32
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %bucket.addr, align 4
  %3 = load i32, i32* %bucket.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %bucket.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = sitofp i64 %7 to double
  %9 = call i32 @llvm.fptosi.sat.i32.f64(double %8)
  %10 = icmp slt i32 %5, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %entry ], [ %10, %land.rhs ]
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  store i32 16777216, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end

if.end:
  %18 = load i32, i32* %at.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %20 = load i32, i32* %at.addr, align 4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %23 = sitofp i64 %22 to double
  %24 = call i32 @llvm.fptosi.sat.i32.f64(double %23)
  %25 = icmp slt i32 %20, %24
  br label %land.end.1

land.end.1:
  %26 = phi i1 [ false, %if.end ], [ %25, %land.rhs.1 ]
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  %27 = load i32, i32* %at.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %28
  store i32 0, i32* %32, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sitofp i64 %1 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %4, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sitofp i64 %1 to double
  %8 = call i32 @llvm.fptosi.sat.i32.f64(double %7)
  %9 = icmp slt i32 %6, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.cond ], [ %9, %land.rhs ]
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %16 = icmp ne i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  ret i32 %17

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
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
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  %5 = icmp slt i32 %bucket, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = sext i32 %bucket to i64
  %8 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i32 @nish.slotWord(i32 %h, i32 %9)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %7
  store i32 %11, i32* %15, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end

if.else:
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %17)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i64$f64.constructor(%struct.Map$i64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !20
  %2 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !22
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*))
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !11, !noalias !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %13 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !23
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %19 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !24
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %25 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !25
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %31 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !26
  ret void
}

define internal noundef i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i64 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !26
  %6 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = call i64 @nish.probeTable$i64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i64 %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$i64$f64.has(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i64 noundef %key) #0 {
entry:
  %0 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %this, i64 %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$i64$f64* @nish.Map$i64$f64.set(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) %this, i64 noundef %key, double noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$i64$f64.setValueAt(%struct.Map$i64$f64* %this, i32 %4, double %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$i64$f64.insertAt(%struct.Map$i64$f64* %this, i64 %5, i64 %key, double %value)
  br label %if.end

if.end:
  ret %struct.Map$i64$f64* %this
}

define internal noundef zeroext i1 @nish.Map$i64$f64.delete(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$i64$f64.probe(%struct.Map$i64$f64* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !23
  %5 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !26
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !21
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  store i32 %11, i32* %13, align 4, !tbaa !21
  %14 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 0
  %15 = load double, double* %14, align 8, !tbaa !6
  %16 = fsub double %15, 0x3FF0000000000000
  %17 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 0
  store double %16, double* %17, align 8, !tbaa !6
  ret i1 true

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$i64$f64.walkOpen(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !22
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$i64$f64.walkNext(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$i64$f64.walkClose(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !22
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$i64$f64.keyAt(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*))
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to i64*
  %15 = getelementptr inbounds i64, i64* %14, i64 %11
  %16 = load i64, i64* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  ret i64 %16
}

define internal noundef double @nish.Map$i64$f64.valueAt(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*))
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16
}

define internal void @nish.Map$i64$f64.setValueAt(%struct.Map$i64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$i64$f64.insertAt(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i64 noundef %key, double noundef %value) #0 {
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
  %6 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !21
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !22
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

if.end.1:
  call void @nish.Map$i64$f64.rebuild(%struct.Map$i64$f64* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !24
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = bitcast i8* %28 to i64*
  %30 = getelementptr inbounds i64, i64* %29, i64 %23
  store i64 %key, i64* %30, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %32 = sitofp i64 %31 to double
  %33 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !25
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %42 = bitcast i8* %41 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %36
  store double %value, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %45 = sitofp i64 %44 to double
  %46 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !26
  %48 = load i32, i32* %h.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store.2

push.store.2:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  store i32 %48, i32* %57, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %58 = add i64 %50, 1
  store i64 %58, i64* %49, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = sitofp i64 %58 to double
  %60 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  %61 = load i32, i32* %60, align 4, !tbaa !21
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 1)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  %65 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  store i32 %63, i32* %65, align 4, !tbaa !21
  %66 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 0
  %67 = load double, double* %66, align 8, !tbaa !6
  %68 = fadd double %67, 0x3FF0000000000000
  %69 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 0
  store double %68, double* %69, align 8, !tbaa !6
  %70 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !24
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %74 = sitofp i64 %73 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %80 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !23
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %84 = sitofp i64 %83 to double
  %85 = call i32 @llvm.fptosi.sat.i32.f64(double %84)
  %86 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %85, i32 3)
  %87 = extractvalue { i32, i1 } %86, 0
  %88 = extractvalue { i32, i1 } %86, 1
  br i1 %88, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %89 = icmp sgt i32 %78, %87
  br i1 %89, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$i64$f64.rebuild(%struct.Map$i64$f64* %this)
  br label %if.end.2

if.else:
  %90 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  %91 = load %struct.nish_array*, %struct.nish_array** %90, align 8, !tbaa !23
  %92 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 2
  %93 = load i32, i32* %92, align 4, !tbaa !20
  %94 = load i32, i32* %bucket.addr, align 4
  %95 = load i32, i32* %h.addr, align 4
  %96 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %91, i32 %93, i32 %94, i32 %95, i32 %96)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$i64$f64.rebuild(%struct.Map$i64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !22
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !23
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !21
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !21
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !24
  %27 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !26
  call void @nish.compactEntries$i64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !25
  %31 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !26
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !26
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !23
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !20
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$i64$f64, %struct.Map$i64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !26
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal noundef i64 @nish.probeTable$i64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i64 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 0), align 8
  %1 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_int_hash_key, i64 0, i64 1), align 8
  %2 = xor i64 %key, %0
  %3 = zext i64 %2 to i128
  %4 = zext i64 %1 to i128
  %5 = mul i128 %3, %4
  %6 = trunc i128 %5 to i64
  %7 = lshr i128 %5, 64
  %8 = trunc i128 %7 to i64
  %9 = xor i64 %6, %8
  %10 = lshr i64 %9, 32
  %11 = trunc i64 %10 to i32
  %12 = trunc i64 %9 to i32
  %13 = xor i32 %12, %11
  %14 = icmp eq i32 %13, 0
  %15 = select i1 %14, i32 1, i32 %13
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = lshr i32 %16, 24
  store i32 %17, i32* %fingerprint.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = call i32 @nish.homeBucket(i32 %18, i32 %mask)
  store i32 %19, i32* %bucket.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %bucket.addr, align 4
  %35 = sitofp i64 %21 to double
  %36 = call i32 @llvm.fptosi.sat.i32.f64(double %35)
  %37 = icmp slt i32 %34, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %while.cond ], [ %37, %land.rhs ]
  br i1 %38, label %while.body, label %while.end

while.body:
  %39 = load i32, i32* %bucket.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %23 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %40
  %43 = load i32, i32* %42, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %43, i32* %word.addr, align 4
  %44 = load i32, i32* %word.addr, align 4
  %45 = icmp eq i32 %44, 0
  br i1 %45, label %if.then, label %if.end

if.then:
  %46 = load i32, i32* %bucket.addr, align 4
  %47 = load i32, i32* %h.addr, align 4
  %48 = tail call i64 @nish.absentAt(i32 %46, i32 %47)
  ret i64 %48

if.end:
  %49 = load i32, i32* %word.addr, align 4
  %50 = lshr i32 %49, 24
  %51 = load i32, i32* %fingerprint.addr, align 4
  %52 = icmp eq i32 %50, %51
  br i1 %52, label %if.then.1, label %if.end.1

if.then.1:
  %53 = load i32, i32* %word.addr, align 4
  %54 = and i32 %53, 16777215
  %55 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %54, i32 1)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %56, i32* %at.addr, align 4
  %58 = load i32, i32* %at.addr, align 4
  %59 = icmp sge i32 %58, 0
  br i1 %59, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %60 = load i32, i32* %at.addr, align 4
  %61 = sitofp i64 %25 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  %63 = icmp slt i32 %60, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %ovf.ok ], [ %63, %land.rhs.4 ]
  br i1 %64, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %65 = load i32, i32* %at.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %27 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %66
  %69 = load i32, i32* %68, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %70 = load i32, i32* %h.addr, align 4
  %71 = icmp eq i32 %69, %70
  br label %land.end.3

land.end.3:
  %72 = phi i1 [ false, %land.end.4 ], [ %71, %land.rhs.3 ]
  br i1 %72, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %73 = load i32, i32* %at.addr, align 4
  %74 = sitofp i64 %29 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  %76 = icmp slt i32 %73, %75
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %land.end.3 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %78 = load i32, i32* %at.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = bitcast i8* %31 to i64*
  %81 = getelementptr inbounds i64, i64* %80, i64 %79
  %82 = load i64, i64* %81, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %83 = icmp eq i64 %82, %key
  br label %land.end.1

land.end.1:
  %84 = phi i1 [ false, %land.end.2 ], [ %83, %land.rhs.1 ]
  br i1 %84, label %if.then.2, label %if.end.2

if.then.2:
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = load i32, i32* %at.addr, align 4
  %87 = tail call i64 @nish.foundAt(i32 %85, i32 %86)
  ret i64 %87

if.end.2:
  br label %if.end.1

if.end.1:
  %88 = load i32, i32* %bucket.addr, align 4
  %89 = add nsw i32 %88, 1
  %90 = and i32 %89, %mask
  store i32 %90, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*))
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$i64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 %41
  %44 = load i64, i64* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %45 = bitcast i8* %11 to i64*
  %46 = getelementptr inbounds i64, i64* %45, i64 %39
  store i64 %44, i64* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %63 = bitcast i8* %62 to i64*
  %64 = getelementptr inbounds i64, i64* %63, i64 %60
  %65 = load i64, i64* %64, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!31, !32, !33, !34, !35}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Map$i64$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!14, !12, i64 8}
!20 = !{!5, !4, i64 16}
!21 = !{!5, !4, i64 20}
!22 = !{!5, !4, i64 48}
!23 = !{!5, !3, i64 8}
!24 = !{!5, !3, i64 24}
!25 = !{!5, !3, i64 32}
!26 = !{!5, !3, i64 40}
!27 = !{!"element i64", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{!"element double", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{i32 8, !"cf-protection-branch", i32 1}
!32 = !{i32 8, !"cf-protection-return", i32 1}
!33 = !{i32 8, !"branch-target-enforcement", i32 1}
!34 = !{i32 8, !"sign-return-address", i32 1}
!35 = !{i32 4, !"probe-stack", !"inline-asm"}
