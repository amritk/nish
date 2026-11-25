%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/test/file_read_at.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"streamed a window at a time\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"wrote: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"fileOpen \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"size: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"last: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"read: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"closed: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare noundef i64 @nish_file_size(i32 noundef) #0
declare noundef i32 @nish_file_close(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #4

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

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %text.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %fd.addr = alloca i32, align 4
  %window.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %pos.addr = alloca i64, align 8
  %pieces.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %n.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  store i8* bitcast ({ i64, [28 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  store i8* bitcast ({ i64, [29 x i8] }* @.str.1 to i8*), i8** %text.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i8*, i8** %text.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = icmp slt i32 %3, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %10 = load i8*, i8** %text.addr, align 8
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %10, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = trunc i32 %16 to i8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 1)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 %19
  store i8 %17, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load i8*, i8** %path.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %33 = call i32 @nish_write_file_bytes(i8* %31, %struct.nish_array* %32)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %34)
  call void @nish_print(i8* %35)
  %36 = load i8*, i8** %path.addr, align 8
  %37 = call i32 @nish_file_open(i8* %36)
  store i32 %37, i32* %fd.addr, align 4
  %38 = load i32, i32* %fd.addr, align 4
  %39 = icmp slt i32 %38, 0
  br i1 %39, label %if.then, label %if.end

if.then:
  %40 = load i32, i32* %fd.addr, align 4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8* %41)
  call void @nish_print(i8* %42)
  ret i32 1

if.end:
  %43 = load i32, i32* %fd.addr, align 4
  %44 = call i64 @nish_file_size(i32 %43)
  %45 = call i8* @nish_str_from_i64(i64 %44)
  %46 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %45)
  call void @nish_print(i8* %46)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast [4 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %49, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %window.addr, align 8
  store i64 0, i64* %pos.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %pieces.addr, align 8
  %54 = load i32, i32* %fd.addr, align 4
  %55 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %56 = load i64, i64* %pos.addr, align 8
  %57 = call i32 @nish_file_read_at(i32 %54, %struct.nish_array* %55, i64 0, i64 4, i64 %56)
  store i32 %57, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %58 = load i32, i32* %n.addr, align 4
  %59 = icmp sgt i32 %58, 0
  br i1 %59, label %while.body, label %while.end

while.body:
  %60 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %61 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %62 = load i32, i32* %n.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ule i64 0, %63
  %67 = icmp ule i64 %63, %65
  %68 = and i1 %66, %67
  br i1 %68, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %63, i64 %65)
  unreachable

bytes.ok:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = getelementptr inbounds i8, i8* %70, i64 0
  %72 = sub i64 %63, 0
  %73 = call i8* @nish_str_new(i8* %71, i64 %72)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = icmp eq i64 %75, %77
  br i1 %78, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %60, i64 8)
  br label %push.store.1

push.store.1:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i8**
  %82 = getelementptr inbounds i8*, i8** %81, i64 %75
  store i8* %73, i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %83 = add i64 %75, 1
  store i64 %83, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = load i64, i64* %pos.addr, align 8
  %86 = load i32, i32* %n.addr, align 4
  %87 = sext i32 %86 to i64
  %88 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %85, i64 %87)
  %89 = extractvalue { i64, i1 } %88, 0
  %90 = extractvalue { i64, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %89, i64* %pos.addr, align 8
  %91 = load i32, i32* %fd.addr, align 4
  %92 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %93 = load i64, i64* %pos.addr, align 8
  %94 = add i64 0, 4
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %96 = load i64, i64* %95, align 8
  %97 = icmp ule i64 0, %94
  %98 = icmp ule i64 %94, %96
  %99 = and i1 %97, %98
  br i1 %99, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %94, i64 %96)
  unreachable

net.ok:
  %100 = call i32 @nish_file_read_at(i32 %91, %struct.nish_array* %92, i64 0, i64 4, i64 %93)
  store i32 %100, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %101 = load i32, i32* %n.addr, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), i8* %102)
  call void @nish_print(i8* %103)
  %104 = load i64, i64* %pos.addr, align 8
  %105 = call i8* @nish_str_from_i64(i64 %104)
  %106 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*), i8* %105)
  %107 = call i8* @nish_str_concat(i8* %106, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  call void @nish_print(i8* %107)
  %108 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*) to i64*
  %112 = load i64, i64* %111, align 8
  %113 = sub i64 %110, 1
  %114 = mul i64 %112, %113
  %115 = icmp eq i64 %110, 0
  %116 = select i1 %115, i64 0, i64 %114
  store i64 %116, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %117 = load i64, i64* %join.at, align 8
  %118 = icmp ult i64 %117, %110
  br i1 %118, label %join.sum.body, label %join.copy

join.sum.body:
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to i8**
  %122 = getelementptr inbounds i8*, i8** %121, i64 %117
  %123 = load i8*, i8** %122, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %124 = load i64, i64* %join.total, align 8
  %125 = bitcast i8* %123 to i64*
  %126 = load i64, i64* %125, align 8
  %127 = add i64 %124, %126
  store i64 %127, i64* %join.total, align 8
  %128 = add i64 %117, 1
  store i64 %128, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %129 = load i64, i64* %join.total, align 8
  %130 = icmp ugt i64 %129, 2147483647
  %131 = add i64 %129, 9
  %132 = select i1 %130, i64 4611686018427387904, i64 %131
  %133 = call i8* @nish_alloc_struct(i64 %132)
  %134 = bitcast i8* %133 to i64*
  store i64 %129, i64* %134, align 8
  %135 = getelementptr inbounds i8, i8* %133, i64 8
  store i8* %135, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %136 = load i64, i64* %join.at, align 8
  %137 = icmp ult i64 %136, %110
  br i1 %137, label %join.part, label %join.end

join.part:
  %138 = load i8*, i8** %join.p, align 8
  %139 = icmp eq i64 %136, 0
  %140 = select i1 %139, i64 0, i64 %112
  %141 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %138, i8* %141, i64 %140, i1 false)
  %142 = getelementptr inbounds i8, i8* %138, i64 %140
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = bitcast i8* %144 to i8**
  %146 = getelementptr inbounds i8*, i8** %145, i64 %136
  %147 = load i8*, i8** %146, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %148 = bitcast i8* %147 to i64*
  %149 = load i64, i64* %148, align 8
  %150 = getelementptr inbounds i8, i8* %147, i64 8
  %151 = icmp eq i64 %149, 1
  br i1 %151, label %join.byte, label %join.bulk

join.byte:
  %152 = load i8, i8* %150, align 1
  store i8 %152, i8* %142, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %142, i8* %150, i64 %149, i1 false)
  br label %join.next

join.next:
  %153 = getelementptr inbounds i8, i8* %142, i64 %149
  store i8* %153, i8** %join.p, align 8
  %154 = add i64 %136, 1
  store i64 %154, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %155 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %155, align 1
  call void @nish_print(i8* %133)
  %156 = load i32, i32* %fd.addr, align 4
  %157 = call i32 @nish_file_close(i32 %156)
  %158 = call i8* @nish_str_from_i32(i32 %157)
  %159 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.9 to i8*), i8* %158)
  call void @nish_print(i8* %159)
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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
