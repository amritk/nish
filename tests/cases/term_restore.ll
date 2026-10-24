%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"\1B[?25h<bye>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"<old>\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"set \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"cleared\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"full\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"full \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"last \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"panic\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"hold\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ready\0A\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef i32 @nish_read_stdin(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare zeroext i1 @nish_wait_stdin(i32 noundef) #0
declare noundef i32 @nish_set_raw_mode(i1 noundef zeroext) #0
declare noundef i32 @nish_set_terminal_restore(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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

define noundef i32 @nish_main() #0 {
entry:
  %mode.addr = alloca i8*, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %full.addr = alloca i8*, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %kept.addr = alloca i32, align 4
  %cleared.addr = alloca i32, align 4
  %old.addr = alloca i32, align 4
  %over.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [16 x i8], align 8
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
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %14 = phi i8* [ %13, %bounds.ok ], [ bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), %cond.false ]
  store i8* %14, i8** %mode.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp slt i32 %18, 4096
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %38 = load i64, i64* %37, align 8
  %39 = sub i64 %36, 1
  %40 = mul i64 %38, %39
  %41 = icmp eq i64 %36, 0
  %42 = select i1 %41, i64 0, i64 %40
  store i64 %42, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %43 = load i64, i64* %join.at, align 8
  %44 = icmp ult i64 %43, %36
  br i1 %44, label %join.sum.body, label %join.copy

join.sum.body:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i8**
  %48 = getelementptr inbounds i8*, i8** %47, i64 %43
  %49 = load i8*, i8** %48, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %50 = load i64, i64* %join.total, align 8
  %51 = bitcast i8* %49 to i64*
  %52 = load i64, i64* %51, align 8
  %53 = add i64 %50, %52
  store i64 %53, i64* %join.total, align 8
  %54 = add i64 %43, 1
  store i64 %54, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %55 = load i64, i64* %join.total, align 8
  %56 = icmp ugt i64 %55, 2147483647
  %57 = add i64 %55, 9
  %58 = select i1 %56, i64 4611686018427387904, i64 %57
  %59 = call i8* @nish_alloc_struct(i64 %58)
  %60 = bitcast i8* %59 to i64*
  store i64 %55, i64* %60, align 8
  %61 = getelementptr inbounds i8, i8* %59, i64 8
  store i8* %61, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %62 = load i64, i64* %join.at, align 8
  %63 = icmp ult i64 %62, %36
  br i1 %63, label %join.part, label %join.end

join.part:
  %64 = load i8*, i8** %join.p, align 8
  %65 = icmp eq i64 %62, 0
  %66 = select i1 %65, i64 0, i64 %38
  %67 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %64, i8* %67, i64 %66, i1 false)
  %68 = getelementptr inbounds i8, i8* %64, i64 %66
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = bitcast i8* %70 to i8**
  %72 = getelementptr inbounds i8*, i8** %71, i64 %62
  %73 = load i8*, i8** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %74 = bitcast i8* %73 to i64*
  %75 = load i64, i64* %74, align 8
  %76 = getelementptr inbounds i8, i8* %73, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %76, i64 %75, i1 false)
  %77 = getelementptr inbounds i8, i8* %68, i64 %75
  store i8* %77, i8** %join.p, align 8
  %78 = add i64 %62, 1
  store i64 %78, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %79 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %79, align 1
  store i8* %59, i8** %full.addr, align 8
  %80 = load i8*, i8** %mode.addr, align 8
  %81 = call zeroext i1 @nish_str_eq(i8* %80, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br i1 %81, label %if.then, label %if.end

if.then:
  %82 = call i32 @nish_set_terminal_restore(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*))
  store i32 %82, i32* %kept.addr, align 4
  %83 = call i32 @nish_set_terminal_restore(i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  store i32 %83, i32* %cleared.addr, align 4
  %84 = load i32, i32* %kept.addr, align 4
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %85, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %87 = load i32, i32* %cleared.addr, align 4
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* %86, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %91 = load i8*, i8** %full.addr, align 8
  %92 = call i32 @nish_set_terminal_restore(i8* %91)
  %93 = call i8* @nish_str_from_i32(i32 %92)
  %94 = call i8* @nish_str_concat(i8* %90, i8* %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %96 = load i8*, i8** %full.addr, align 8
  %97 = call i8* @nish_str_concat(i8* %96, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %98 = call i32 @nish_set_terminal_restore(i8* %97)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %95, i8* %99)
  call void @nish_print(i8* %100)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %101 = call i32 @nish_set_terminal_restore(i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  store i32 %101, i32* %old.addr, align 4
  %102 = load i8*, i8** %full.addr, align 8
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %104 = call i32 @nish_set_terminal_restore(i8* %103)
  store i32 %104, i32* %over.addr, align 4
  %105 = load i32, i32* %old.addr, align 4
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %109 = load i32, i32* %over.addr, align 4
  %110 = call i8* @nish_str_from_i32(i32 %109)
  %111 = call i8* @nish_str_concat(i8* %108, i8* %110)
  %112 = call i8* @nish_str_concat(i8* %111, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %113 = call i32 @nish_set_raw_mode(i1 zeroext true)
  %114 = call i8* @nish_str_from_i32(i32 %113)
  %115 = call i8* @nish_str_concat(i8* %112, i8* %114)
  %116 = call i8* @nish_str_concat(i8* %115, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %117 = call i32 @nish_set_terminal_restore(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*))
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %116, i8* %118)
  call void @nish_print(i8* %119)
  %120 = load i8*, i8** %mode.addr, align 8
  %121 = call zeroext i1 @nish_str_eq(i8* %120, i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*))
  br i1 %121, label %if.then.1, label %if.end.1

if.then.1:
  %122 = call i32 @nish_set_terminal_restore(i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br label %if.end.1

if.end.1:
  %123 = load i8*, i8** %mode.addr, align 8
  %124 = call zeroext i1 @nish_str_eq(i8* %123, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*))
  br i1 %124, label %if.then.2, label %if.end.2

if.then.2:
  %125 = load i8*, i8** %full.addr, align 8
  %126 = call i32 @nish_set_terminal_restore(i8* %125)
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %127)
  call void @nish_print(i8* %128)
  br label %if.end.2

if.end.2:
  %129 = load i8*, i8** %mode.addr, align 8
  %130 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*), i8* %129)
  call void @nish_print(i8* %130)
  %131 = load i8*, i8** %mode.addr, align 8
  %132 = call zeroext i1 @nish_str_eq(i8* %131, i8* bitcast ({ i64, [6 x i8] }* @.str.10 to i8*))
  br i1 %132, label %if.then.3, label %if.end.3

if.then.3:
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %135 = bitcast [3 x i32]* %arr.data to i8*
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %135, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %137 = bitcast i8* %135 to i32*
  %138 = getelementptr inbounds i32, i32* %137, i64 0
  store i32 1, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %139 = getelementptr inbounds i32, i32* %137, i64 1
  store i32 2, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %140 = getelementptr inbounds i32, i32* %137, i64 2
  store i32 3, i32* %140, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %xs.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %142 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = trunc i64 %144 to i32
  %146 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %145, i32 4)
  %147 = extractvalue { i32, i1 } %146, 0
  %148 = extractvalue { i32, i1 } %146, 1
  br i1 %148, label %ovf.fail, label %ovf.ok

ovf.ok:
  %149 = sext i32 %147 to i64
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 0
  %151 = load i64, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %152 = icmp ult i64 %149, %151
  br i1 %152, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %149, i64 %151)
  unreachable

bounds.ok.1:
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %154 = load i8*, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %155 = bitcast i8* %154 to i32*
  %156 = getelementptr inbounds i32, i32* %155, i64 %149
  %157 = load i32, i32* %156, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %158 = call i8* @nish_str_from_i32(i32 %157)
  call void @nish_print(i8* %158)
  br label %if.end.3

if.end.3:
  %159 = load i8*, i8** %mode.addr, align 8
  %160 = call zeroext i1 @nish_str_eq(i8* %159, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*))
  br i1 %160, label %if.then.4, label %if.end.4

if.then.4:
  call void @nish_write(i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*), i32 2, i1 false)
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 16, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 16, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %163 = bitcast [16 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %163, i8 0, i64 16, i1 false), !alias.scope !4, !noalias !3
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %163, i8** %164, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %buf.addr, align 8
  store i32 -11, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %165 = load i32, i32* %n.addr, align 4
  %166 = icmp sgt i32 %165, 0
  br i1 %166, label %lor.end, label %lor.rhs

lor.rhs:
  %167 = load i32, i32* %n.addr, align 4
  %168 = icmp eq i32 %167, -11
  br label %lor.end

lor.end:
  %169 = phi i1 [ true, %while.cond ], [ %168, %lor.rhs ]
  br i1 %169, label %while.body, label %while.end

while.body:
  %170 = call zeroext i1 @nish_wait_stdin(i32 600000)
  br i1 %170, label %if.then.5, label %if.end.5

if.then.5:
  %171 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %172 = add i64 0, 16
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 0
  %174 = load i64, i64* %173, align 8
  %175 = icmp ule i64 0, %172
  %176 = icmp ule i64 %172, %174
  %177 = and i1 %175, %176
  br i1 %177, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %172, i64 %174)
  unreachable

net.ok:
  %178 = call i32 @nish_read_stdin(%struct.nish_array* %171, i64 0, i64 16)
  store i32 %178, i32* %n.addr, align 4
  br label %if.end.5

if.end.5:
  br label %while.cond

while.end:
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
