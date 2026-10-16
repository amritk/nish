%struct.Tally = type { i32 }
%struct.Rng = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" of \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @nish.Rng.constructor(%struct.Rng* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.Rng.nextI32(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture) #1
declare noundef double @nish.Rng.nextF64(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture) #1
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow4(i32 noundef) #0
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef i32 @darts(i32 noundef %seed, i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %hits.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca double, align 8
  %y.addr = alloca double, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 %seed)
  store %struct.Rng* %Rng.obj, %struct.Rng** %r.addr, align 8
  store i32 0, i32* %hits.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %3 = call double @nish.Rng.nextF64(%struct.Rng* %2)
  store double %3, double* %x.addr, align 8
  %4 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %5 = call double @nish.Rng.nextF64(%struct.Rng* %4)
  store double %5, double* %y.addr, align 8
  %6 = load double, double* %x.addr, align 8
  %7 = load double, double* %x.addr, align 8
  %8 = fmul double %6, %7
  %9 = load double, double* %y.addr, align 8
  %10 = load double, double* %y.addr, align 8
  %11 = fmul double %9, %10
  %12 = fadd double %8, %11
  %13 = fcmp olt double %12, 0x3FF0000000000000
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load i32, i32* %hits.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %hits.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i32, i32* %hits.addr, align 4
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @throwInto(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %seed, i32 noundef %n) #0 {
entry:
  %hits.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %0 = call i32 @darts(i32 %seed, i32 %n)
  store i32 %0, i32* %hits.addr, align 4
  %1 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %tally)
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %2, i32 0, i32 1
  %4 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %4, i32 0, i32 0
  %6 = load %struct.Tally*, %struct.Tally** %5, align 8, !tbaa !5
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 0
  %9 = load %struct.Tally*, %struct.Tally** %8, align 8, !tbaa !5
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !7
  %12 = load i32, i32* %hits.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = getelementptr inbounds %struct.Tally, %struct.Tally* %6, i32 0, i32 0
  store i32 %14, i32* %16, align 4, !tbaa !7
  store atomic i32 0, i32* %3 release, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %z.addr = alloca %struct.Rng*, align 8
  %Rng.obj.1 = alloca %struct.Rng, align 8
  %a.addr = alloca %struct.Rng*, align 8
  %Rng.obj.2 = alloca %struct.Rng, align 8
  %b.addr = alloca %struct.Rng*, align 8
  %Rng.obj.3 = alloca %struct.Rng, align 8
  %tally.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %n.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %draws.addr = alloca %struct.nish_array*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 42)
  store %struct.Rng* %Rng.obj, %struct.Rng** %r.addr, align 8
  %0 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %1 = call i32 @nish.Rng.nextI32(%struct.Rng* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %5 = call i32 @nish.Rng.nextI32(%struct.Rng* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %10 = call i32 @nish.Rng.nextI32(%struct.Rng* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %15 = call double @nish.Rng.nextF64(%struct.Rng* %14)
  %16 = call i8* @nish_str_from_f64(double %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  call void @nish_print(i8* %17)
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.1, i32 0)
  store %struct.Rng* %Rng.obj.1, %struct.Rng** %z.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.2, i32 -7)
  store %struct.Rng* %Rng.obj.2, %struct.Rng** %a.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.3, i32 -7)
  store %struct.Rng* %Rng.obj.3, %struct.Rng** %b.addr, align 8
  %18 = load %struct.Rng*, %struct.Rng** %z.addr, align 8
  %19 = call i32 @nish.Rng.nextI32(%struct.Rng* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load %struct.Rng*, %struct.Rng** %a.addr, align 8
  %23 = call i32 @nish.Rng.nextI32(%struct.Rng* %22)
  %24 = load %struct.Rng*, %struct.Rng** %b.addr, align 8
  %25 = call i32 @nish.Rng.nextI32(%struct.Rng* %24)
  %26 = icmp eq i32 %23, %25
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %28 = call i8* @nish_str_concat(i8* %21, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %31 = call i32 @nish.Rng.nextI32(%struct.Rng* %30)
  %32 = lshr i32 %31, 1
  %33 = srem i32 %32, 6
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %29, i8* %34)
  call void @nish_print(i8* %35)
  %36 = call i8* @nish_alloc_struct(i64 4)
  %37 = bitcast i8* %36 to %struct.Tally*
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %37, i32 0, i32 0
  store i32 0, i32* %38, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %37)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %tally.addr, align 8
  store i32 2000, i32* %n.addr, align 4
  %39 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %39, %struct.ThreadScope** %s.addr, align 8
  %40 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %41 = bitcast %struct.ThreadScope* %40 to i8*
  %42 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %43 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %44 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* %42, %struct.Mutex$$Tally* %43, i32 %44)
  %45 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %46 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %47 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* %45, %struct.Mutex$$Tally* %46, i32 %47)
  %48 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %49 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %50 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* %48, %struct.Mutex$$Tally* %49, i32 %50)
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3(%struct.ThreadScope* %51, %struct.Mutex$$Tally* %52, i32 %53)
  call void @nish_scope_join(i8* %41)
  %54 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow4(i32 6)
  store %struct.nish_array* %54, %struct.nish_array** %draws.addr, align 8
  %55 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %56 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %55)
  store %struct.MutexGuard$$Tally* %56, %struct.MutexGuard$$Tally** %g.addr, align 8
  %57 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %58 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %57, i32 0, i32 1
  %59 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %60 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %59, i32 0, i32 0
  %61 = load %struct.Tally*, %struct.Tally** %60, align 8, !tbaa !5
  %62 = getelementptr inbounds %struct.Tally, %struct.Tally* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4, !tbaa !7
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %66 = load i32, i32* %n.addr, align 4
  %67 = mul nsw i32 4, %66
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %65, i8* %68)
  call void @nish_print(i8* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %73 = icmp ult i64 0, %72
  br i1 %73, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %72)
  unreachable

bounds.ok:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  %78 = load i32, i32* %77, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %81 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %84 = icmp ult i64 1, %83
  br i1 %84, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %83)
  unreachable

bounds.ok.1:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 1
  %89 = load i32, i32* %88, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %80, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %93 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %96 = icmp ult i64 5, %95
  br i1 %96, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 5, i64 %95)
  unreachable

bounds.ok.2:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 5
  %101 = load i32, i32* %100, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %92, i8* %102)
  call void @nish_print(i8* %103)
  store atomic i32 0, i32* %58 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden void @nish_main$arrow0(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 1, i32 %n)
  ret void
}

define hidden void @nish_main$arrow1(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 2, i32 %n)
  ret void
}

define hidden void @nish_main$arrow2(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 3, i32 %n)
  ret void
}

define hidden void @nish_main$arrow3(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 4, i32 %n)
  ret void
}

define hidden noundef i32 @nish_main$arrow4(i32 noundef %i) #0 {
entry:
  %own.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 %1)
  store %struct.Rng* %Rng.obj, %struct.Rng** %own.addr, align 8
  %3 = load %struct.Rng*, %struct.Rng** %own.addr, align 8
  %4 = call i32 @nish.Rng.nextI32(%struct.Rng* %3)
  %5 = lshr i32 %4, 8
  ret i32 %5

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"MutexGuard$$Tally", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!"Tally", !3, i64 0}
!7 = !{!6, !3, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !14, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
