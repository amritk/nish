%struct.Person = type { i8*, i32 }
%struct.Text = type { i8* }
%struct.Log = type { i8*, i32 }
%struct.Job = type { %struct.Mutex$$Log*, i32 }
%struct.Mutex$$Log = type { %struct.MutexGuard$$Log* }
%struct.MutexGuard$$Log = type { %struct.Log*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [49 x i8] } { i64 48, [49 x i8] c"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"person-\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"job-\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"given-\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"] [\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$str$fn.5.label(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$str$fn.6.nameOf(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Text$str$fn.4.echo(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Text* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$str$fn.6.middle(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$str$fn.4.tail(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.5.first(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Job$str$fn.6.record(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Mutex$$Log.constructor(%struct.Mutex$$Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Log* noundef nonnull align 8 dereferenceable(16)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Log.constructor(%struct.MutexGuard$$Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Log* noundef nonnull align 8 dereferenceable(16)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare noundef nonnull i8* @nish_guard_keep(i8* noundef, i8* noundef nonnull) #0
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [49 x i8] }* @.str.0 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @label$(i32 noundef %n) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* %8, i8** %17, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %26 = load i64, i64* %25, align 8
  %27 = sub i64 %24, 1
  %28 = mul i64 %26, %27
  %29 = icmp eq i64 %24, 0
  %30 = select i1 %29, i64 0, i64 %28
  store i64 %30, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %31 = load i64, i64* %join.at, align 8
  %32 = icmp ult i64 %31, %24
  br i1 %32, label %join.sum.body, label %join.copy

join.sum.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %31
  %37 = load i8*, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = load i64, i64* %join.total, align 8
  %39 = bitcast i8* %37 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = add i64 %38, %40
  store i64 %41, i64* %join.total, align 8
  %42 = add i64 %31, 1
  store i64 %42, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %43 = load i64, i64* %join.total, align 8
  %44 = icmp ugt i64 %43, 2147483647
  %45 = add i64 %43, 9
  %46 = select i1 %44, i64 4611686018427387904, i64 %45
  %47 = call i8* @nish_alloc_struct(i64 %46)
  %48 = bitcast i8* %47 to i64*
  store i64 %43, i64* %48, align 8
  %49 = getelementptr inbounds i8, i8* %47, i64 8
  store i8* %49, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %50 = load i64, i64* %join.at, align 8
  %51 = icmp ult i64 %50, %24
  br i1 %51, label %join.part, label %join.end

join.part:
  %52 = load i8*, i8** %join.p, align 8
  %53 = icmp eq i64 %50, 0
  %54 = select i1 %53, i64 0, i64 %26
  %55 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %52, i8* %55, i64 %54, i1 false)
  %56 = getelementptr inbounds i8, i8* %52, i64 %54
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %50
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = bitcast i8* %61 to i64*
  %63 = load i64, i64* %62, align 8
  %64 = getelementptr inbounds i8, i8* %61, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %56, i8* %64, i64 %63, i1 false)
  %65 = getelementptr inbounds i8, i8* %56, i64 %63
  store i8* %65, i8** %join.p, align 8
  %66 = add i64 %50, 1
  store i64 %66, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %67 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %67, align 1
  %68 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*))
  ret i8* %68
}

define internal void @Person.constructor(%struct.Person* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name, i32 noundef %age) #1 {
entry:
  %0 = getelementptr inbounds %struct.Person, %struct.Person* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8, !tbaa !18
  %1 = getelementptr inbounds %struct.Person, %struct.Person* %this, i32 0, i32 1
  store i32 %age, i32* %1, align 4, !tbaa !19
  ret void
}

define hidden noundef nonnull align 8 i8* @nameOf$(i32 noundef %n) #0 {
entry:
  %p.addr = alloca %struct.Person*, align 8
  %Person.obj = alloca %struct.Person, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i8* %0)
  call void @Person.constructor(%struct.Person* %Person.obj, i8* %1, i32 %n)
  store %struct.Person* %Person.obj, %struct.Person** %p.addr, align 8
  %2 = load %struct.Person*, %struct.Person** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Person, %struct.Person* %2, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !18
  ret i8* %4
}

define internal void @Text.constructor(%struct.Text* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %body) #1 {
entry:
  %0 = getelementptr inbounds %struct.Text, %struct.Text* %this, i32 0, i32 0
  store i8* %body, i8** %0, align 8, !tbaa !21
  ret void
}

define hidden noundef nonnull align 8 i8* @echo$(%struct.Text* noundef nonnull readonly align 8 dereferenceable(8) nocapture %t) #2 {
entry:
  %0 = getelementptr inbounds %struct.Text, %struct.Text* %t, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !21
  ret i8* %1
}

define hidden noundef nonnull align 8 i8* @middle$(i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @label$(i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = call i64 @llvm.smin.i64(i64 2, i64 %4)
  %6 = call i64 @llvm.smax.i64(i64 %5, i64 0)
  %7 = call i64 @llvm.smin.i64(i64 8, i64 %4)
  %8 = call i64 @llvm.smax.i64(i64 %7, i64 0)
  %9 = call i64 @llvm.smin.i64(i64 %6, i64 %8)
  %10 = call i64 @llvm.smax.i64(i64 %6, i64 %8)
  %11 = sub i64 %10, %9
  %12 = getelementptr inbounds i8, i8* %2, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %9
  %14 = call i8* @nish_str_new(i8* %13, i64 %11)
  ret i8* %14
}

define hidden noundef nonnull align 8 i8* @tail$(i32 noundef %n) #0 {
entry:
  %t.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @label$(i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %t.addr, align 8
  %3 = load i8*, i8** %t.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = load i8*, i8** %t.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = sub nsw i32 %9, 4
  %11 = sext i32 %10 to i64
  %12 = load i8*, i8** %t.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = sext i32 %15 to i64
  %17 = icmp ule i64 %11, %16
  %18 = icmp ule i64 %16, %5
  %19 = and i1 %17, %18
  br i1 %19, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %11, i64 %16, i64 %5)
  unreachable

slice.ok:
  %20 = sub i64 %16, %11
  %21 = getelementptr inbounds i8, i8* %3, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 %11
  %23 = call i8* @nish_str_new(i8* %22, i64 %20)
  ret i8* %23
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @squares$(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  store i32 %11, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %26

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @halves$(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store double 0x0000000000000000, double* %x.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load double, double* %x.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to double*
  %17 = getelementptr inbounds double, double* %16, i64 %10
  store double %8, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !25
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = load double, double* %x.addr, align 8
  %21 = fadd double %20, 0x3FE0000000000000
  store double %21, double* %x.addr, align 8
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %24
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @evens$(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %10 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = load i32, i32* %i.addr, align 4
  %19 = srem i32 %18, 2
  %20 = icmp eq i32 %19, 0
  %21 = bitcast i8* %12 to i1*
  %22 = getelementptr inbounds i1, i1* %21, i64 %17
  store i1 %20, i1* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !27
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @build(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = bitcast i8* %13 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %18
  store i32 %21, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %27

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef i32 @first$(i32 noundef %n) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @build(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %10 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %11 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = sext i32 %12 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  %ovf.op = phi i32 [ 1, %bounds.ok ], [ 0, %bounds.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %0, align 8, !tbaa !29
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !30
  ret void
}

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Mutex$$Log* noundef nonnull align 8 dereferenceable(8) %m, i32 noundef %id) #1 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store %struct.Mutex$$Log* %m, %struct.Mutex$$Log** %0, align 8, !tbaa !32
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store i32 %id, i32* %1, align 4, !tbaa !33
  ret void
}

define hidden noundef nonnull align 8 i8* @record$(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %job) #0 {
entry:
  %mine.addr = alloca i8*, align 8
  %g.addr = alloca %struct.MutexGuard$$Log*, align 8
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !33
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %2)
  store i8* %3, i8** %mine.addr, align 8
  %4 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %5 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %4, align 8, !tbaa !32
  %6 = call %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* %5)
  store %struct.MutexGuard$$Log* %6, %struct.MutexGuard$$Log** %g.addr, align 8
  %7 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %7, i32 0, i32 1
  %9 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %10 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %9, i32 0, i32 0
  %11 = load %struct.Log*, %struct.Log** %10, align 8, !tbaa !35
  %12 = load i8*, i8** %mine.addr, align 8
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %11, i32 0, i32 0
  %14 = load i8*, i8** %13, align 8, !tbaa !29
  %15 = call i8* @nish_guard_keep(i8* %14, i8* %12)
  %16 = getelementptr inbounds %struct.Log, %struct.Log* %11, i32 0, i32 0
  store i8* %15, i8** %16, align 8, !tbaa !29
  %17 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %18 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %17, i32 0, i32 0
  %19 = load %struct.Log*, %struct.Log** %18, align 8, !tbaa !35
  %20 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %21 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %20, i32 0, i32 0
  %22 = load %struct.Log*, %struct.Log** %21, align 8, !tbaa !35
  %23 = getelementptr inbounds %struct.Log, %struct.Log* %22, i32 0, i32 1
  %24 = load i32, i32* %23, align 4, !tbaa !30
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  %28 = getelementptr inbounds %struct.Log, %struct.Log* %19, i32 0, i32 1
  store i32 %26, i32* %28, align 4, !tbaa !30
  store atomic i32 0, i32* %8 release, align 4
  %29 = load i8*, i8** %mine.addr, align 8
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  ret i8* %30

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %sq.addr = alloca %struct.nish_array*, align 8
  %hv.addr = alloca %struct.nish_array*, align 8
  %ev.addr = alloca %struct.nish_array*, align 8
  %firsts.addr = alloca %struct.nish_array*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %m.addr = alloca %struct.Mutex$$Log*, align 8
  %given.addr = alloca %struct.Text*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %last.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Log*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 64)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %6, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %6, i64 3
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8*, i8** %6, i64 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8*, i8** %6, i64 5
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8*, i8** %6, i64 6
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i8*, i8** %6, i64 7
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %names.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 2, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 2, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = call i8* @nish_alloc_struct(i64 16)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %29 to %struct.nish_array**
  %32 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %31, i64 0
  store %struct.nish_array* %16, %struct.nish_array** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %31, i64 1
  store %struct.nish_array* %21, %struct.nish_array** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %26, %struct.nish_array** %sq.addr, align 8
  %34 = call i8* @nish_alloc_struct(i64 24)
  %35 = bitcast i8* %34 to %struct.nish_array*
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  store i64 0, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1
  store i64 0, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  store i8* null, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = call i8* @nish_alloc_struct(i64 24)
  %40 = bitcast i8* %39 to %struct.nish_array*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  store i64 1, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 1
  store i64 1, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = call i8* @nish_alloc_struct(i64 8)
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %43 to %struct.nish_array**
  %46 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %45, i64 0
  store %struct.nish_array* %35, %struct.nish_array** %46, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %40, %struct.nish_array** %hv.addr, align 8
  %47 = call i8* @nish_alloc_struct(i64 24)
  %48 = bitcast i8* %47 to %struct.nish_array*
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  store i64 0, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  store i64 0, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  store i8* null, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = call i8* @nish_alloc_struct(i64 24)
  %53 = bitcast i8* %52 to %struct.nish_array*
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  store i64 1, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 1
  store i64 1, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = call i8* @nish_alloc_struct(i64 8)
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  store i8* %56, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %56 to %struct.nish_array**
  %59 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %58, i64 0
  store %struct.nish_array* %48, %struct.nish_array** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %53, %struct.nish_array** %ev.addr, align 8
  %60 = call i8* @nish_alloc_struct(i64 24)
  %61 = bitcast i8* %60 to %struct.nish_array*
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  store i64 1, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 1
  store i64 1, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %64 = call i8* @nish_alloc_struct(i64 4)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  store i8* %64, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %64 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 0
  store i32 0, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  store %struct.nish_array* %61, %struct.nish_array** %firsts.addr, align 8
  %68 = call i8* @nish_alloc_struct(i64 24)
  %69 = bitcast i8* %68 to %struct.nish_array*
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  store i64 4, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 1
  store i64 4, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = call i8* @nish_alloc_struct(i64 32)
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  store i8* %72, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %72 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %76 = getelementptr inbounds i8*, i8** %74, i64 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %77 = getelementptr inbounds i8*, i8** %74, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = getelementptr inbounds i8*, i8** %74, i64 3
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %69, %struct.nish_array** %done.addr, align 8
  %79 = call i8* @nish_alloc_struct(i64 8)
  %80 = bitcast i8* %79 to %struct.Mutex$$Log*
  %81 = call i8* @nish_alloc_struct(i64 16)
  %82 = bitcast i8* %81 to %struct.Log*
  call void @Log.constructor(%struct.Log* %82)
  call void @nish.Mutex$$Log.constructor(%struct.Mutex$$Log* %80, %struct.Log* %82)
  store %struct.Mutex$$Log* %80, %struct.Mutex$$Log** %m.addr, align 8
  %83 = call i8* @nish_alloc_struct(i64 8)
  %84 = bitcast i8* %83 to %struct.Text*
  %85 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = trunc i64 %87 to i32
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*), i8* %89)
  call void @Text.constructor(%struct.Text* %84, i8* %90)
  store %struct.Text* %84, %struct.Text** %given.addr, align 8
  %91 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %91, %struct.ThreadScope** %s.addr, align 8
  %92 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %93 = bitcast %struct.ThreadScope* %92 to i8*
  %94 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %95 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.5.label(%struct.ThreadScope* %94, i32 5, %struct.nish_array* %95, i32 0)
  %96 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %97 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.5.label(%struct.ThreadScope* %96, i32 300, %struct.nish_array* %97, i32 1)
  %98 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %99 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.6.nameOf(%struct.ThreadScope* %98, i32 7, %struct.nish_array* %99, i32 2)
  %100 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %101 = load %struct.Text*, %struct.Text** %given.addr, align 8
  %102 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$$Text$str$fn.4.echo(%struct.ThreadScope* %100, %struct.Text* %101, %struct.nish_array* %102, i32 3)
  %103 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %104 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.6.middle(%struct.ThreadScope* %103, i32 9, %struct.nish_array* %104, i32 4)
  %105 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %106 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.4.tail(%struct.ThreadScope* %105, i32 12, %struct.nish_array* %106, i32 5)
  %107 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %108 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @nish.ThreadScope.spawn$i32$str$fn.5.label(%struct.ThreadScope* %107, i32 0, %struct.nish_array* %108, i32 6)
  %109 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %110 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  call void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares(%struct.ThreadScope* %109, i32 6, %struct.nish_array* %110, i32 0)
  %111 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %112 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  call void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares(%struct.ThreadScope* %111, i32 2000, %struct.nish_array* %112, i32 1)
  %113 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %114 = load %struct.nish_array*, %struct.nish_array** %hv.addr, align 8
  call void @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves(%struct.ThreadScope* %113, i32 5, %struct.nish_array* %114, i32 0)
  %115 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %ev.addr, align 8
  call void @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens(%struct.ThreadScope* %115, i32 5, %struct.nish_array* %116, i32 0)
  %117 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %firsts.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.first(%struct.ThreadScope* %117, i32 9, %struct.nish_array* %118, i32 0)
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %119 = load i32, i32* %i.addr, align 4
  %120 = icmp slt i32 %119, 4
  br i1 %120, label %for.body, label %for.end

for.body:
  %121 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %122 = call i8* @nish_alloc_struct(i64 16)
  %123 = bitcast i8* %122 to %struct.Job*
  %124 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %m.addr, align 8
  %125 = load i32, i32* %i.addr, align 4
  call void @Job.constructor(%struct.Job* %123, %struct.Mutex$$Log* %124, i32 %125)
  %126 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %127 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$str$fn.6.record(%struct.ThreadScope* %121, %struct.Job* %123, %struct.nish_array* %126, i32 %127)
  br label %for.inc

for.inc:
  %128 = load i32, i32* %i.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %93)
  %130 = call i32 @churn()
  store i32 %130, i32* %c.addr, align 4
  %131 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %133 = load i64, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = icmp ult i64 0, %133
  br i1 %134, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %133)
  unreachable

bounds.ok:
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = bitcast i8* %136 to i8**
  %138 = getelementptr inbounds i8*, i8** %137, i64 0
  %139 = load i8*, i8** %138, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_print(i8* %139)
  %140 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %143 = icmp ult i64 1, %142
  br i1 %143, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %142)
  unreachable

bounds.ok.1:
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %146 = bitcast i8* %145 to i8**
  %147 = getelementptr inbounds i8*, i8** %146, i64 1
  %148 = load i8*, i8** %147, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %149 = bitcast i8* %148 to i64*
  %150 = load i64, i64* %149, align 8
  %151 = trunc i64 %150 to i32
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %154 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %157 = bitcast i8* %156 to i8**
  %158 = getelementptr inbounds i8*, i8** %157, i64 1
  %159 = load i8*, i8** %158, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %160 = bitcast i8* %159 to i64*
  %161 = load i64, i64* %160, align 8
  %162 = call i64 @llvm.smin.i64(i64 12, i64 %161)
  %163 = call i64 @llvm.smax.i64(i64 %162, i64 0)
  %164 = call i64 @llvm.smin.i64(i64 0, i64 %163)
  %165 = call i64 @llvm.smax.i64(i64 0, i64 %163)
  %166 = sub i64 %165, %164
  %167 = getelementptr inbounds i8, i8* %159, i64 8
  %168 = getelementptr inbounds i8, i8* %167, i64 %164
  %169 = call i8* @nish_str_new(i8* %168, i64 %166)
  %170 = call i8* @nish_str_concat(i8* %153, i8* %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %172 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = icmp ult i64 2, %174
  br i1 %175, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %174)
  unreachable

bounds.ok.2:
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 2
  %177 = load i8*, i8** %176, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %178 = bitcast i8* %177 to i8**
  %179 = getelementptr inbounds i8*, i8** %178, i64 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %181 = call i8* @nish_str_concat(i8* %171, i8* %180)
  %182 = call i8* @nish_str_concat(i8* %181, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %183 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = icmp ult i64 3, %185
  br i1 %186, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %185)
  unreachable

bounds.ok.3:
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %188 = load i8*, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %189 = bitcast i8* %188 to i8**
  %190 = getelementptr inbounds i8*, i8** %189, i64 3
  %191 = load i8*, i8** %190, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %192 = call i8* @nish_str_concat(i8* %182, i8* %191)
  call void @nish_print(i8* %192)
  %193 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %193, i64 0, i32 0
  %195 = load i64, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %196 = icmp ult i64 4, %195
  br i1 %196, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 4, i64 %195)
  unreachable

bounds.ok.4:
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %193, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %199 = bitcast i8* %198 to i8**
  %200 = getelementptr inbounds i8*, i8** %199, i64 4
  %201 = load i8*, i8** %200, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %202 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*), i8* %201)
  %203 = call i8* @nish_str_concat(i8* %202, i8* bitcast ({ i64, [4 x i8] }* @.str.10 to i8*))
  %204 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 0
  %206 = load i64, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %207 = icmp ult i64 5, %206
  br i1 %207, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 5, i64 %206)
  unreachable

bounds.ok.5:
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 2
  %209 = load i8*, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %210 = bitcast i8* %209 to i8**
  %211 = getelementptr inbounds i8*, i8** %210, i64 5
  %212 = load i8*, i8** %211, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %213 = call i8* @nish_str_concat(i8* %203, i8* %212)
  %214 = call i8* @nish_str_concat(i8* %213, i8* bitcast ({ i64, [4 x i8] }* @.str.10 to i8*))
  %215 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %216 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 0
  %217 = load i64, i64* %216, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %218 = icmp ult i64 6, %217
  br i1 %218, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 6, i64 %217)
  unreachable

bounds.ok.6:
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 2
  %220 = load i8*, i8** %219, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %221 = bitcast i8* %220 to i8**
  %222 = getelementptr inbounds i8*, i8** %221, i64 6
  %223 = load i8*, i8** %222, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %224 = call i8* @nish_str_concat(i8* %214, i8* %223)
  %225 = call i8* @nish_str_concat(i8* %224, i8* bitcast ({ i64, [3 x i8] }* @.str.11 to i8*))
  %226 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %227 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %226, i64 0, i32 0
  %228 = load i64, i64* %227, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %229 = icmp ult i64 7, %228
  br i1 %229, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 7, i64 %228)
  unreachable

bounds.ok.7:
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %226, i64 0, i32 2
  %231 = load i8*, i8** %230, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %232 = bitcast i8* %231 to i8**
  %233 = getelementptr inbounds i8*, i8** %232, i64 7
  %234 = load i8*, i8** %233, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %235 = bitcast i8* %234 to i64*
  %236 = load i64, i64* %235, align 8
  %237 = trunc i64 %236 to i32
  %238 = call i8* @nish_str_from_i32(i32 %237)
  %239 = call i8* @nish_str_concat(i8* %225, i8* %238)
  call void @nish_print(i8* %239)
  %240 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 0
  %242 = load i64, i64* %241, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %243 = icmp ult i64 0, %242
  br i1 %243, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 0, i64 %242)
  unreachable

bounds.ok.8:
  %244 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 2
  %245 = load i8*, i8** %244, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %246 = bitcast i8* %245 to %struct.nish_array**
  %247 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %246, i64 0
  %248 = load %struct.nish_array*, %struct.nish_array** %247, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %248, i64 0, i32 0
  %250 = load i64, i64* %249, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %251 = icmp ult i64 5, %250
  br i1 %251, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 5, i64 %250)
  unreachable

bounds.ok.9:
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %248, i64 0, i32 2
  %253 = load i8*, i8** %252, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %254 = bitcast i8* %253 to i32*
  %255 = getelementptr inbounds i32, i32* %254, i64 5
  %256 = load i32, i32* %255, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %257 = call i8* @nish_str_from_i32(i32 %256)
  %258 = call i8* @nish_str_concat(i8* %257, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %259 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %259, i64 0, i32 2
  %261 = load i8*, i8** %260, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %262 = bitcast i8* %261 to %struct.nish_array**
  %263 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %262, i64 0
  %264 = load %struct.nish_array*, %struct.nish_array** %263, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %264, i64 0, i32 0
  %266 = load i64, i64* %265, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %267 = trunc i64 %266 to i32
  %268 = call i8* @nish_str_from_i32(i32 %267)
  %269 = call i8* @nish_str_concat(i8* %258, i8* %268)
  %270 = call i8* @nish_str_concat(i8* %269, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %271 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %271, i64 0, i32 0
  %273 = load i64, i64* %272, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %274 = icmp ult i64 1, %273
  br i1 %274, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 1, i64 %273)
  unreachable

bounds.ok.10:
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %271, i64 0, i32 2
  %276 = load i8*, i8** %275, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %277 = bitcast i8* %276 to %struct.nish_array**
  %278 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %277, i64 1
  %279 = load %struct.nish_array*, %struct.nish_array** %278, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %280 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %279, i64 0, i32 0
  %281 = load i64, i64* %280, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %282 = trunc i64 %281 to i32
  %283 = call i8* @nish_str_from_i32(i32 %282)
  %284 = call i8* @nish_str_concat(i8* %270, i8* %283)
  %285 = call i8* @nish_str_concat(i8* %284, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %286 = load %struct.nish_array*, %struct.nish_array** %sq.addr, align 8
  %287 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %286, i64 0, i32 2
  %288 = load i8*, i8** %287, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %289 = bitcast i8* %288 to %struct.nish_array**
  %290 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %289, i64 1
  %291 = load %struct.nish_array*, %struct.nish_array** %290, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %292 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %291, i64 0, i32 0
  %293 = load i64, i64* %292, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %294 = icmp ult i64 1999, %293
  br i1 %294, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 1999, i64 %293)
  unreachable

bounds.ok.11:
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %291, i64 0, i32 2
  %296 = load i8*, i8** %295, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %297 = bitcast i8* %296 to i32*
  %298 = getelementptr inbounds i32, i32* %297, i64 1999
  %299 = load i32, i32* %298, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %300 = call i8* @nish_str_from_i32(i32 %299)
  %301 = call i8* @nish_str_concat(i8* %285, i8* %300)
  call void @nish_print(i8* %301)
  %302 = load %struct.nish_array*, %struct.nish_array** %hv.addr, align 8
  %303 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 0
  %304 = load i64, i64* %303, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %305 = icmp ult i64 0, %304
  br i1 %305, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 0, i64 %304)
  unreachable

bounds.ok.12:
  %306 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 2
  %307 = load i8*, i8** %306, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %308 = bitcast i8* %307 to %struct.nish_array**
  %309 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %308, i64 0
  %310 = load %struct.nish_array*, %struct.nish_array** %309, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %311 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %310, i64 0, i32 0
  %312 = load i64, i64* %311, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %313 = icmp ult i64 3, %312
  br i1 %313, label %bounds.ok.13, label %bounds.fail.13

bounds.fail.13:
  call void @nish_panic_index(i64 3, i64 %312)
  unreachable

bounds.ok.13:
  %314 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %310, i64 0, i32 2
  %315 = load i8*, i8** %314, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %316 = bitcast i8* %315 to double*
  %317 = getelementptr inbounds double, double* %316, i64 3
  %318 = load double, double* %317, align 8, !alias.scope !4, !noalias !3, !tbaa !25
  %319 = call i8* @nish_str_from_f64(double %318)
  %320 = call i8* @nish_str_concat(i8* %319, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %321 = load %struct.nish_array*, %struct.nish_array** %hv.addr, align 8
  %322 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 2
  %323 = load i8*, i8** %322, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %324 = bitcast i8* %323 to %struct.nish_array**
  %325 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %324, i64 0
  %326 = load %struct.nish_array*, %struct.nish_array** %325, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %327 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %326, i64 0, i32 0
  %328 = load i64, i64* %327, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %329 = trunc i64 %328 to i32
  %330 = call i8* @nish_str_from_i32(i32 %329)
  %331 = call i8* @nish_str_concat(i8* %320, i8* %330)
  %332 = call i8* @nish_str_concat(i8* %331, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %333 = load %struct.nish_array*, %struct.nish_array** %ev.addr, align 8
  %334 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %333, i64 0, i32 0
  %335 = load i64, i64* %334, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %336 = icmp ult i64 0, %335
  br i1 %336, label %bounds.ok.14, label %bounds.fail.14

bounds.fail.14:
  call void @nish_panic_index(i64 0, i64 %335)
  unreachable

bounds.ok.14:
  %337 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %333, i64 0, i32 2
  %338 = load i8*, i8** %337, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %339 = bitcast i8* %338 to %struct.nish_array**
  %340 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %339, i64 0
  %341 = load %struct.nish_array*, %struct.nish_array** %340, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %342 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %341, i64 0, i32 0
  %343 = load i64, i64* %342, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %344 = icmp ult i64 2, %343
  br i1 %344, label %bounds.ok.15, label %bounds.fail.15

bounds.fail.15:
  call void @nish_panic_index(i64 2, i64 %343)
  unreachable

bounds.ok.15:
  %345 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %341, i64 0, i32 2
  %346 = load i8*, i8** %345, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %347 = bitcast i8* %346 to i1*
  %348 = getelementptr inbounds i1, i1* %347, i64 2
  %349 = load i1, i1* %348, align 1, !alias.scope !4, !noalias !3, !tbaa !27
  %350 = select i1 %349, i8* bitcast ({ i64, [5 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.13 to i8*)
  %351 = call i8* @nish_str_concat(i8* %332, i8* %350)
  %352 = call i8* @nish_str_concat(i8* %351, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %353 = load %struct.nish_array*, %struct.nish_array** %ev.addr, align 8
  %354 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %353, i64 0, i32 2
  %355 = load i8*, i8** %354, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %356 = bitcast i8* %355 to %struct.nish_array**
  %357 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %356, i64 0
  %358 = load %struct.nish_array*, %struct.nish_array** %357, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %359 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %358, i64 0, i32 0
  %360 = load i64, i64* %359, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %361 = icmp ult i64 3, %360
  br i1 %361, label %bounds.ok.16, label %bounds.fail.16

bounds.fail.16:
  call void @nish_panic_index(i64 3, i64 %360)
  unreachable

bounds.ok.16:
  %362 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %358, i64 0, i32 2
  %363 = load i8*, i8** %362, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %364 = bitcast i8* %363 to i1*
  %365 = getelementptr inbounds i1, i1* %364, i64 3
  %366 = load i1, i1* %365, align 1, !alias.scope !4, !noalias !3, !tbaa !27
  %367 = select i1 %366, i8* bitcast ({ i64, [5 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.13 to i8*)
  %368 = call i8* @nish_str_concat(i8* %352, i8* %367)
  %369 = call i8* @nish_str_concat(i8* %368, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %370 = load %struct.nish_array*, %struct.nish_array** %ev.addr, align 8
  %371 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %370, i64 0, i32 2
  %372 = load i8*, i8** %371, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %373 = bitcast i8* %372 to %struct.nish_array**
  %374 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %373, i64 0
  %375 = load %struct.nish_array*, %struct.nish_array** %374, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %376 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %375, i64 0, i32 0
  %377 = load i64, i64* %376, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %378 = trunc i64 %377 to i32
  %379 = call i8* @nish_str_from_i32(i32 %378)
  %380 = call i8* @nish_str_concat(i8* %369, i8* %379)
  %381 = call i8* @nish_str_concat(i8* %380, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %382 = load %struct.nish_array*, %struct.nish_array** %firsts.addr, align 8
  %383 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %382, i64 0, i32 0
  %384 = load i64, i64* %383, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %385 = icmp ult i64 0, %384
  br i1 %385, label %bounds.ok.17, label %bounds.fail.17

bounds.fail.17:
  call void @nish_panic_index(i64 0, i64 %384)
  unreachable

bounds.ok.17:
  %386 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %382, i64 0, i32 2
  %387 = load i8*, i8** %386, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %388 = bitcast i8* %387 to i32*
  %389 = getelementptr inbounds i32, i32* %388, i64 0
  %390 = load i32, i32* %389, align 4, !alias.scope !4, !noalias !3, !tbaa !23
  %391 = call i8* @nish_str_from_i32(i32 %390)
  %392 = call i8* @nish_str_concat(i8* %381, i8* %391)
  call void @nish_print(i8* %392)
  %393 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %394 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %393, i64 0, i32 0
  %395 = load i64, i64* %394, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %396 = icmp ult i64 0, %395
  br i1 %396, label %bounds.ok.18, label %bounds.fail.18

bounds.fail.18:
  call void @nish_panic_index(i64 0, i64 %395)
  unreachable

bounds.ok.18:
  %397 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %393, i64 0, i32 2
  %398 = load i8*, i8** %397, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %399 = bitcast i8* %398 to i8**
  %400 = getelementptr inbounds i8*, i8** %399, i64 0
  %401 = load i8*, i8** %400, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %402 = call i8* @nish_str_concat(i8* %401, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %403 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %404 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %403, i64 0, i32 0
  %405 = load i64, i64* %404, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %406 = icmp ult i64 1, %405
  br i1 %406, label %bounds.ok.19, label %bounds.fail.19

bounds.fail.19:
  call void @nish_panic_index(i64 1, i64 %405)
  unreachable

bounds.ok.19:
  %407 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %403, i64 0, i32 2
  %408 = load i8*, i8** %407, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %409 = bitcast i8* %408 to i8**
  %410 = getelementptr inbounds i8*, i8** %409, i64 1
  %411 = load i8*, i8** %410, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %412 = call i8* @nish_str_concat(i8* %402, i8* %411)
  %413 = call i8* @nish_str_concat(i8* %412, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %414 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %415 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %414, i64 0, i32 0
  %416 = load i64, i64* %415, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %417 = icmp ult i64 2, %416
  br i1 %417, label %bounds.ok.20, label %bounds.fail.20

bounds.fail.20:
  call void @nish_panic_index(i64 2, i64 %416)
  unreachable

bounds.ok.20:
  %418 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %414, i64 0, i32 2
  %419 = load i8*, i8** %418, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %420 = bitcast i8* %419 to i8**
  %421 = getelementptr inbounds i8*, i8** %420, i64 2
  %422 = load i8*, i8** %421, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %423 = call i8* @nish_str_concat(i8* %413, i8* %422)
  %424 = call i8* @nish_str_concat(i8* %423, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %425 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %426 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %425, i64 0, i32 0
  %427 = load i64, i64* %426, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %428 = icmp ult i64 3, %427
  br i1 %428, label %bounds.ok.21, label %bounds.fail.21

bounds.fail.21:
  call void @nish_panic_index(i64 3, i64 %427)
  unreachable

bounds.ok.21:
  %429 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %425, i64 0, i32 2
  %430 = load i8*, i8** %429, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %431 = bitcast i8* %430 to i8**
  %432 = getelementptr inbounds i8*, i8** %431, i64 3
  %433 = load i8*, i8** %432, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %434 = call i8* @nish_str_concat(i8* %424, i8* %433)
  %435 = call i8* @nish_str_concat(i8* %434, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %436 = load i32, i32* %c.addr, align 4
  %437 = call i8* @nish_str_from_i32(i32 %436)
  %438 = call i8* @nish_str_concat(i8* %435, i8* %437)
  call void @nish_print(i8* %438)
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %last.addr, align 4
  %439 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %m.addr, align 8
  %440 = call %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* %439)
  store %struct.MutexGuard$$Log* %440, %struct.MutexGuard$$Log** %g.addr, align 8
  %441 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %442 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %441, i32 0, i32 1
  %443 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %444 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %443, i32 0, i32 0
  %445 = load %struct.Log*, %struct.Log** %444, align 8, !tbaa !35
  %446 = getelementptr inbounds %struct.Log, %struct.Log* %445, i32 0, i32 1
  %447 = load i32, i32* %446, align 4, !tbaa !30
  store i32 %447, i32* %count.addr, align 4
  %448 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %449 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %448, i32 0, i32 0
  %450 = load %struct.Log*, %struct.Log** %449, align 8, !tbaa !35
  %451 = getelementptr inbounds %struct.Log, %struct.Log* %450, i32 0, i32 0
  %452 = load i8*, i8** %451, align 8, !tbaa !29
  %453 = getelementptr inbounds i8, i8* %452, i64 8
  %454 = bitcast i8* %452 to i64*
  %455 = load i64, i64* %454, align 8
  %456 = call i8* @nish_str_new(i8* %453, i64 %455)
  %457 = bitcast i8* %456 to i64*
  %458 = load i64, i64* %457, align 8
  %459 = trunc i64 %458 to i32
  store i32 %459, i32* %last.addr, align 4
  store atomic i32 0, i32* %442 release, align 4
  %460 = load i32, i32* %count.addr, align 4
  %461 = call i8* @nish_str_from_i32(i32 %460)
  %462 = call i8* @nish_str_concat(i8* %461, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %463 = load i32, i32* %last.addr, align 4
  %464 = call i8* @nish_str_from_i32(i32 %463)
  %465 = call i8* @nish_str_concat(i8* %462, i8* %464)
  call void @nish_print(i8* %465)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"i32", !6, i64 0}
!17 = !{!"Person", !15, i64 0, !16, i64 8}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 8}
!20 = !{!"Text", !15, i64 0}
!21 = !{!20, !15, i64 0}
!22 = !{!"element i32", !6, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!"element double", !6, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!"element i1", !6, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{!"Log", !15, i64 0, !16, i64 8}
!29 = !{!28, !15, i64 0}
!30 = !{!28, !16, i64 8}
!31 = !{!"Job", !15, i64 0, !16, i64 8}
!32 = !{!31, !15, i64 0}
!33 = !{!31, !16, i64 8}
!34 = !{!"MutexGuard$$Log", !15, i64 0, !16, i64 8}
!35 = !{!34, !15, i64 0}
