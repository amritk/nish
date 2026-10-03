%struct.Pair = type { i32, i32 }
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.Secret$$Pair = type { %struct.Pair* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytes(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
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
  %19 = add nsw i32 %18, 1
  %20 = trunc i32 %19 to i8
  %21 = bitcast i8* %12 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %17
  store i8 %20, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !14
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

define hidden noundef i32 @length(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define hidden noundef i32 @total(%struct.Pair* noundef nonnull readonly align 4 dereferenceable(8) nocapture %p) #1 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define internal noundef nonnull align 4 dereferenceable(8) %struct.Pair* @pairOf(i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %lo, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %hi, i32* %3, align 4
  store %struct.Pair* %1, %struct.Pair** %p.addr, align 8
  %4 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  ret %struct.Pair* %4
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @make(i32 noundef %n) #0 {
entry:
  %0 = call %struct.nish_array* @bytes(i32 %n)
  %1 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %0)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef align 8 %struct.Secret$arr.u8* @maybe(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call %struct.Secret$arr.u8* @make(i32 %n)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi %struct.Secret$arr.u8* [ %1, %cond.true ], [ null, %cond.false ]
  ret %struct.Secret$arr.u8* %2
}

define internal noundef i32 @branch(i32 noundef %n) #0 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %big.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Secret$arr.u8* @make(i32 %n)
  store %struct.Secret$arr.u8* %0, %struct.Secret$arr.u8** %k.addr, align 8
  %1 = icmp sgt i32 %n, 2
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %3 = call i32 @nish.expose$arr.u8$i32$fn.6.length(%struct.Secret$arr.u8* %2)
  store i32 %3, i32* %big.addr, align 4
  %4 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %4)
  %5 = load i32, i32* %big.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %5

if.end:
  %6 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Secret$arr.u8*, align 8
  %seen.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %k.addr.1 = alloca %struct.Secret$arr.u8*, align 8
  %j.addr = alloca %struct.Secret$arr.u8*, align 8
  %raw.addr = alloca %struct.nish_array*, align 8
  %moved.addr = alloca %struct.Secret$arr.u8*, align 8
  %pair.addr = alloca %struct.Secret$$Pair*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @branch(i32 4)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @branch(i32 1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call %struct.Secret$arr.u8* @maybe(i32 0)
  store %struct.Secret$arr.u8* %4, %struct.Secret$arr.u8** %m.addr, align 8
  %5 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %m.addr, align 8
  %6 = icmp eq %struct.Secret$arr.u8* %5, null
  br i1 %6, label %if.then, label %if.else

if.then:
  call void @nish_print(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  br label %if.end

if.else:
  %7 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %m.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %7)
  br label %if.end

if.end:
  store i32 0, i32* %seen.addr, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, 4
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = call %struct.Secret$arr.u8* @make(i32 %10)
  store %struct.Secret$arr.u8* %11, %struct.Secret$arr.u8** %k.addr, align 8
  %12 = load i32, i32* %seen.addr, align 4
  %13 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %14 = call i32 @nish.expose$arr.u8$i32$fn.6.length(%struct.Secret$arr.u8* %13)
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %seen.addr, align 4
  %18 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %18)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load i32, i32* %seen.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = call %struct.Secret$arr.u8* @make(i32 2)
  store %struct.Secret$arr.u8* %23, %struct.Secret$arr.u8** %k.addr.1, align 8
  %24 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr.1, align 8
  store %struct.Secret$arr.u8* %24, %struct.Secret$arr.u8** %j.addr, align 8
  %25 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %j.addr, align 8
  %26 = call i32 @nish.expose$arr.u8$i32$fn.6.length(%struct.Secret$arr.u8* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %j.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %28)
  %29 = call %struct.nish_array* @bytes(i32 3)
  store %struct.nish_array* %29, %struct.nish_array** %raw.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %raw.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = icmp ult i64 0, %32
  br i1 %33, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %32)
  unreachable

bounds.ok:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 0
  store i8 9, i8* %37, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = load %struct.nish_array*, %struct.nish_array** %raw.addr, align 8
  %39 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %38)
  store %struct.Secret$arr.u8* %39, %struct.Secret$arr.u8** %moved.addr, align 8
  %40 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %moved.addr, align 8
  %41 = call i32 @nish.expose$arr.u8$i32$fn.6.length(%struct.Secret$arr.u8* %40)
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %moved.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %43)
  %44 = call %struct.Pair* @pairOf(i32 2, i32 40)
  %45 = call %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* %44)
  store %struct.Secret$$Pair* %45, %struct.Secret$$Pair** %pair.addr, align 8
  %46 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %pair.addr, align 8
  %47 = call i32 @nish.expose$$Pair$u32$fn.5.total(%struct.Secret$$Pair* %46)
  %48 = zext i32 %47 to i64
  %49 = call i8* @nish_str_from_u64(i64 %48)
  call void @nish_print(i8* %49)
  %50 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %pair.addr, align 8
  call void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* %50)
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

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !17
  ret void
}

define internal void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Pair* noundef nonnull align 4 dereferenceable(8) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %this, i32 0, i32 0
  store %struct.Pair* %value, %struct.Pair** %0, align 8, !tbaa !19
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.6.length(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = call i32 @length(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* noundef nonnull align 4 dereferenceable(8) %value) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$$Pair*
  call void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* %1, %struct.Pair* %value)
  ret %struct.Secret$$Pair* %1
}

define internal noundef i32 @nish.expose$$Pair$u32$fn.5.total(%struct.Secret$$Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %s, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8, !tbaa !19
  %2 = call i32 @total(%struct.Pair* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %_target, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8
  %2 = bitcast %struct.Pair* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* %2, i8 0, i64 8, i1 true)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Secret$arr.u8", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"Secret$$Pair", !15, i64 0}
!19 = !{!18, !15, i64 0}
