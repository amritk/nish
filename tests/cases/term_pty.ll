%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"probe\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"raw \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"panic\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"deadline\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"ready\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"timed \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"hold\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"early\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare noundef i32 @nish_read_stdin(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare zeroext i1 @nish_wait_stdin(i32 noundef) #0
declare zeroext i1 @nish_is_terminal(i32 noundef) #1
declare noalias noundef nonnull align 8 %struct.nish_array* @nish_terminal_size() #1
declare noundef i32 @nish_set_raw_mode(i1 noundef zeroext) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noundef i32 @probe() #0 {
entry:
  %size.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish_terminal_size()
  store %struct.nish_array* %0, %struct.nish_array** %size.addr, align 8
  %1 = call zeroext i1 @nish_is_terminal(i32 0)
  %2 = select i1 %1, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %4 = call zeroext i1 @nish_is_terminal(i32 1)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %6 = call i8* @nish_str_concat(i8* %3, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %8 = load %struct.nish_array*, %struct.nish_array** %size.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 0, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = icmp sge i32 %16, 0
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %19 = call i8* @nish_str_concat(i8* %7, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %21 = load %struct.nish_array*, %struct.nish_array** %size.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 1, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 1
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = icmp sge i32 %29, 0
  %31 = select i1 %30, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %32 = call i8* @nish_str_concat(i8* %20, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @nish_set_raw_mode(i1 zeroext true)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %36 = call i32 @nish_set_raw_mode(i1 zeroext true)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %35, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %40 = call i32 @nish_set_raw_mode(i1 zeroext false)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %39, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %44 = call i32 @nish_set_raw_mode(i1 zeroext false)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  call void @nish_print(i8* %46)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @nish_main() #0 {
entry:
  %mode.addr = alloca i8*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [16 x i8], align 8
  %buf.addr.1 = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [16 x i8], align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %14 = phi i8* [ %13, %bounds.ok ], [ bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), %cond.false ]
  store i8* %14, i8** %mode.addr, align 8
  %15 = load i8*, i8** %mode.addr, align 8
  %16 = call zeroext i1 @nish_str_eq(i8* %15, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  br i1 %16, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  %17 = tail call i32 @probe()
  ret i32 %17

if.end:
  %18 = load i8*, i8** %mode.addr, align 8
  %19 = call zeroext i1 @nish_str_eq(i8* %18, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = call zeroext i1 @nish_is_terminal(i32 0)
  %21 = select i1 %20, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %23 = call i32 @nish_set_raw_mode(i1 zeroext true)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  call void @nish_print(i8* %25)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end.1:
  %26 = call i32 @nish_set_raw_mode(i1 zeroext true)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %27)
  call void @nish_print(i8* %28)
  %29 = load i8*, i8** %mode.addr, align 8
  %30 = call zeroext i1 @nish_str_eq(i8* %29, i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*))
  br i1 %30, label %if.then.2, label %if.end.2

if.then.2:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %33 = bitcast [3 x i32]* %arr.data to i8*
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %33 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 0
  store i32 1, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = getelementptr inbounds i32, i32* %35, i64 1
  store i32 2, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = getelementptr inbounds i32, i32* %35, i64 2
  store i32 3, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = trunc i64 %42 to i32
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 4)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  %47 = sext i32 %45 to i64
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = icmp ult i64 %47, %49
  br i1 %50, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %47, i64 %49)
  unreachable

bounds.ok.1:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 %47
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %56 = call i8* @nish_str_from_i32(i32 %55)
  call void @nish_print(i8* %56)
  br label %if.end.2

if.end.2:
  %57 = load i8*, i8** %mode.addr, align 8
  %58 = call zeroext i1 @nish_str_eq(i8* %57, i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*))
  br i1 %58, label %if.then.3, label %if.end.3

if.then.3:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 16, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 16, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %61 = bitcast [16 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %61, i8 0, i64 16, i1 false), !alias.scope !4, !noalias !3
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %61, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %buf.addr, align 8
  br label %while.cond

while.cond:
  %63 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %64 = add i64 0, 16
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %66 = load i64, i64* %65, align 8
  %67 = icmp ule i64 0, %64
  %68 = icmp ule i64 %64, %66
  %69 = and i1 %67, %68
  br i1 %69, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %64, i64 %66)
  unreachable

net.ok:
  %70 = call i32 @nish_read_stdin(%struct.nish_array* %63, i64 0, i64 16)
  %71 = icmp sgt i32 %70, 0
  br i1 %71, label %while.body, label %while.end

while.body:
  br label %while.cond

while.end:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*))
  %72 = call zeroext i1 @nish_wait_stdin(i32 2000)
  %73 = select i1 %72, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %74 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.9 to i8*), i8* %73)
  call void @nish_print(i8* %74)
  br label %if.end.3

if.end.3:
  %75 = load i8*, i8** %mode.addr, align 8
  %76 = call zeroext i1 @nish_str_eq(i8* %75, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*))
  br i1 %76, label %if.then.4, label %if.end.4

if.then.4:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*))
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 16, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 16, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %79 = bitcast [16 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %79, i8 0, i64 16, i1 false), !alias.scope !4, !noalias !3
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %79, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %buf.addr.1, align 8
  store i32 -11, i32* %n.addr, align 4
  br label %while.cond.1

while.cond.1:
  %81 = load i32, i32* %n.addr, align 4
  %82 = icmp sgt i32 %81, 0
  br i1 %82, label %lor.end, label %lor.rhs

lor.rhs:
  %83 = load i32, i32* %n.addr, align 4
  %84 = icmp eq i32 %83, -11
  br label %lor.end

lor.end:
  %85 = phi i1 [ true, %while.cond.1 ], [ %84, %lor.rhs ]
  br i1 %85, label %while.body.1, label %while.end.1

while.body.1:
  %86 = call zeroext i1 @nish_wait_stdin(i32 600000)
  br i1 %86, label %if.then.5, label %if.else

if.then.5:
  %87 = load %struct.nish_array*, %struct.nish_array** %buf.addr.1, align 8
  %88 = add i64 0, 16
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %90 = load i64, i64* %89, align 8
  %91 = icmp ule i64 0, %88
  %92 = icmp ule i64 %88, %90
  %93 = and i1 %91, %92
  br i1 %93, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %88, i64 %90)
  unreachable

net.ok.1:
  %94 = call i32 @nish_read_stdin(%struct.nish_array* %87, i64 0, i64 16)
  store i32 %94, i32* %n.addr, align 4
  br label %if.end.5

if.else:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*))
  br label %if.end.5

if.end.5:
  br label %while.cond.1

while.end.1:
  br label %if.end.4

if.end.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element ptr", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
