%struct.Setup = type { i1, i8* }
%struct.Style = type { i8* }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"three\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"no\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"NISH_KEPT_MEMORY_UNSET\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noundef i32 @relabel(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  store i8* %2, i8** %s.addr, align 8
  br label %if.end

if.end:
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @fixed(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ %2, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.false ]
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef i32 @scoped(i32 noundef %n) #0 {
entry:
  %a.addr = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %2 = icmp sgt i32 %n, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = call i8* @nish_str_from_i32(i32 %n)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %s.addr, align 8
  br label %if.end

if.end:
  %5 = load i8*, i8** %s.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  call void @nish_arena_release(i64 %1)
  ret i32 %8
}

define internal noundef i32 @pick(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = srem i32 %n, 3
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  %6 = load i1, i1* %5, align 1
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8** %9, align 8
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ -1, %res.alt ]
  ret i32 %15
}

define internal noundef i32 @outer(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @relabel(i32 %n)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tally(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %4 = call i8* @nish_str_from_i32(i32 %n)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  store i8* %4, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  ret i32 %19
}

define internal void @prepare(%struct.Setup* noundef nonnull align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !18
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 0
  store i1 true, i1* %2, align 1, !tbaa !18
  %3 = call i32 @tally(i32 3)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 1
  store i8* %4, i8** %5, align 8, !tbaa !19
  ret void
}

define internal noundef nonnull align 8 i8* @Style.get(%struct.Style* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #1 {
entry:
  %known.addr = alloca i8*, align 8
  %v.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !21
  store i8* %1, i8** %known.addr, align 8
  %2 = load i8*, i8** %known.addr, align 8
  %3 = icmp ne i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i8*, i8** %known.addr, align 8
  ret i8* %4

if.end:
  %5 = call i32 @tally(i32 %n)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  store i8* %6, i8** %v.addr, align 8
  %7 = load i8*, i8** %v.addr, align 8
  %8 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  store i8* %7, i8** %8, align 8, !tbaa !21
  %9 = load i8*, i8** %v.addr, align 8
  ret i8* %9
}

define internal noundef zeroext i1 @isNo(i8* noundef nonnull noalias readonly align 8 nocapture %value) #2 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %value, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = call zeroext i1 @nish_str_eq(i8* %value, i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @saysNo(i8* noundef noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp ne i8* %value, null
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = call i1 @isNo(i8* %value)
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @envSaysNo(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %0 = call i8* @nish_getenv(i8* %name)
  %1 = call i1 @saysNo(i8* %0)
  ret i1 %1
}

define void @nish_main() #0 {
entry:
  %setup.addr = alloca %struct.Setup*, align 8
  %Setup.obj = alloca %struct.Setup, align 8
  %style.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Setup, %struct.Setup* %Setup.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !18
  %1 = getelementptr inbounds %struct.Setup, %struct.Setup* %Setup.obj, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.5 to i8*), i8** %1, align 8, !tbaa !19
  store %struct.Setup* %Setup.obj, %struct.Setup** %setup.addr, align 8
  %2 = getelementptr inbounds %struct.Style, %struct.Style* %Style.obj, i32 0, i32 0
  store i8* null, i8** %2, align 8, !tbaa !21
  store %struct.Style* %Style.obj, %struct.Style** %style.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 1000
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i32 @fixed(i32 %9)
  %11 = load i32, i32* %i.addr, align 4
  %12 = call i32 @scoped(i32 %11)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = load i32, i32* %i.addr, align 4
  %17 = call i32 @pick(i32 %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %21 = load i32, i32* %i.addr, align 4
  %22 = call i32 @outer(i32 %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = call i8* @nish_str_from_i32(i32 %24)
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = icmp eq i64 %28, %30
  br i1 %31, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %28
  store i8* %26, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = add i64 %28, 1
  store i64 %36, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  %38 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  call void @prepare(%struct.Setup* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %40 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %41 = load i32, i32* %i.addr, align 4
  %42 = call i8* @Style.get(%struct.Style* %40, i32 %41)
  %43 = call i1 @envSaysNo(i8* bitcast ({ i64, [23 x i8] }* @.str.6 to i8*))
  br i1 %43, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %44 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %42, i8* %45)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %39, i64 8)
  br label %push.store.1

push.store.1:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i8**
  %55 = getelementptr inbounds i8*, i8** %54, i64 %48
  store i8* %46, i8** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = trunc i64 %56 to i32
  br label %for.inc

for.inc:
  %58 = load i32, i32* %i.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %60 = load i32, i32* %i.addr.1, align 4
  %61 = icmp slt i32 %60, 1000
  br i1 %61, label %for.body.1, label %for.end.1

for.body.1:
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %63 = load i8*, i8** %62, align 8
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %65 = load i64, i64* %64, align 8
  %66 = load i32, i32* %total.addr, align 4
  %67 = load i32, i32* %i.addr.1, align 4
  %68 = call i32 @relabel(i32 %67)
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %70, i32* %total.addr, align 4
  %72 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %73 = load i8*, i8** %72, align 8
  %74 = icmp eq i8* %73, %63
  br i1 %74, label %pass.rewind, label %pass.free

pass.rewind:
  %75 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %65, i64* %75, align 8
  br label %pass.done

pass.free:
  %76 = ptrtoint i8* %63 to i64
  %77 = add i64 %76, %65
  call void @nish_arena_release(i64 %77)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %78 = load i32, i32* %i.addr.1, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %80 = load i32, i32* %i.addr.2, align 4
  %81 = icmp slt i32 %80, 1000
  br i1 %81, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %n.addr, align 4
  %82 = call i64 @nish_arena_mark()
  store i64 %82, i64* %a.addr, align 8
  %83 = load i64, i64* %a.addr, align 8
  %84 = load i32, i32* %i.addr.2, align 4
  %85 = call i32 @relabel(i32 %84)
  store i32 %85, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %83)
  %86 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %87 = load i32, i32* %n.addr, align 4
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 1
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = icmp eq i64 %90, %92
  br i1 %93, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %86, i64 8)
  br label %push.store.2

push.store.2:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* %95 to i8**
  %97 = getelementptr inbounds i8*, i8** %96, i64 %90
  store i8* %88, i8** %97, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %98 = add i64 %90, 1
  store i64 %98, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = trunc i64 %98 to i32
  br label %for.inc.2

for.inc.2:
  %100 = load i32, i32* %i.addr.2, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %102 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  %104 = load i64, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = trunc i64 %104 to i32
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* %106, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %108 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = icmp ult i64 1998, %110
  br i1 %111, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1998, i64 %110)
  unreachable

bounds.ok:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = bitcast i8* %113 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 1998
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = call i8* @nish_str_concat(i8* %107, i8* %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %119 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = icmp ult i64 2999, %121
  br i1 %122, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2999, i64 %121)
  unreachable

bounds.ok.1:
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %124 = load i8*, i8** %123, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %125 = bitcast i8* %124 to i8**
  %126 = getelementptr inbounds i8*, i8** %125, i64 2999
  %127 = load i8*, i8** %126, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %128 = call i8* @nish_str_concat(i8* %118, i8* %127)
  %129 = call i8* @nish_str_concat(i8* %128, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %130 = load i32, i32* %total.addr, align 4
  %131 = call i8* @nish_str_from_i32(i32 %130)
  %132 = call i8* @nish_str_concat(i8* %129, i8* %131)
  %133 = call i8* @nish_str_concat(i8* %132, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %134 = call i32 @relabel(i32 7)
  %135 = call i8* @nish_str_from_i32(i32 %134)
  %136 = call i8* @nish_str_concat(i8* %133, i8* %135)
  %137 = call i8* @nish_str_concat(i8* %136, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %138 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  %139 = getelementptr inbounds %struct.Setup, %struct.Setup* %138, i32 0, i32 1
  %140 = load i8*, i8** %139, align 8, !tbaa !19
  %141 = call i8* @nish_str_concat(i8* %137, i8* %140)
  call void @nish_print(i8* %141)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
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
!15 = !{!"i1", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Setup", !15, i64 0, !16, i64 8}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 8}
!20 = !{!"Style", !16, i64 0}
!21 = !{!20, !16, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
