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
  %57 = add i64 0, 4
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %59 = load i64, i64* %58, align 8
  %60 = icmp ule i64 0, %57
  %61 = icmp ule i64 %57, %59
  %62 = and i1 %60, %61
  br i1 %62, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %57, i64 %59)
  unreachable

net.ok:
  %63 = call i32 @nish_file_read_at(i32 %54, %struct.nish_array* %55, i64 0, i64 4, i64 %56)
  store i32 %63, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %64 = load i32, i32* %n.addr, align 4
  %65 = icmp sgt i32 %64, 0
  br i1 %65, label %while.body, label %while.end

while.body:
  %66 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %67 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %68 = load i32, i32* %n.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = icmp ule i64 0, %69
  %73 = icmp ule i64 %69, %71
  %74 = and i1 %72, %73
  br i1 %74, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %69, i64 %71)
  unreachable

bytes.ok:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = getelementptr inbounds i8, i8* %76, i64 0
  %78 = sub i64 %69, 0
  %79 = call i8* @nish_str_new(i8* %77, i64 %78)
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 1
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %84 = icmp eq i64 %81, %83
  br i1 %84, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %66, i64 8)
  br label %push.store.1

push.store.1:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i8**
  %88 = getelementptr inbounds i8*, i8** %87, i64 %81
  store i8* %79, i8** %88, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %89 = add i64 %81, 1
  store i64 %89, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = trunc i64 %89 to i32
  %91 = load i64, i64* %pos.addr, align 8
  %92 = load i32, i32* %n.addr, align 4
  %93 = sext i32 %92 to i64
  %94 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %91, i64 %93)
  %95 = extractvalue { i64, i1 } %94, 0
  %96 = extractvalue { i64, i1 } %94, 1
  br i1 %96, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %95, i64* %pos.addr, align 8
  %97 = load i32, i32* %fd.addr, align 4
  %98 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %99 = load i64, i64* %pos.addr, align 8
  %100 = add i64 0, 4
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %102 = load i64, i64* %101, align 8
  %103 = icmp ule i64 0, %100
  %104 = icmp ule i64 %100, %102
  %105 = and i1 %103, %104
  br i1 %105, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %100, i64 %102)
  unreachable

net.ok.1:
  %106 = call i32 @nish_file_read_at(i32 %97, %struct.nish_array* %98, i64 0, i64 4, i64 %99)
  store i32 %106, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %107 = load i32, i32* %n.addr, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), i8* %108)
  call void @nish_print(i8* %109)
  %110 = load i64, i64* %pos.addr, align 8
  %111 = call i8* @nish_str_from_i64(i64 %110)
  %112 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*), i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  call void @nish_print(i8* %113)
  %114 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %117 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*) to i64*
  %118 = load i64, i64* %117, align 8
  %119 = sub i64 %116, 1
  %120 = mul i64 %118, %119
  %121 = icmp eq i64 %116, 0
  %122 = select i1 %121, i64 0, i64 %120
  store i64 %122, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %123 = load i64, i64* %join.at, align 8
  %124 = icmp ult i64 %123, %116
  br i1 %124, label %join.sum.body, label %join.copy

join.sum.body:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %127 = bitcast i8* %126 to i8**
  %128 = getelementptr inbounds i8*, i8** %127, i64 %123
  %129 = load i8*, i8** %128, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %130 = load i64, i64* %join.total, align 8
  %131 = bitcast i8* %129 to i64*
  %132 = load i64, i64* %131, align 8
  %133 = add i64 %130, %132
  store i64 %133, i64* %join.total, align 8
  %134 = add i64 %123, 1
  store i64 %134, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %135 = load i64, i64* %join.total, align 8
  %136 = icmp ugt i64 %135, 2147483647
  %137 = add i64 %135, 9
  %138 = select i1 %136, i64 4611686018427387904, i64 %137
  %139 = call i8* @nish_alloc_struct(i64 %138)
  %140 = bitcast i8* %139 to i64*
  store i64 %135, i64* %140, align 8
  %141 = getelementptr inbounds i8, i8* %139, i64 8
  store i8* %141, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %142 = load i64, i64* %join.at, align 8
  %143 = icmp ult i64 %142, %116
  br i1 %143, label %join.part, label %join.end

join.part:
  %144 = load i8*, i8** %join.p, align 8
  %145 = icmp eq i64 %142, 0
  %146 = select i1 %145, i64 0, i64 %118
  %147 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %144, i8* %147, i64 %146, i1 false)
  %148 = getelementptr inbounds i8, i8* %144, i64 %146
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %150 = load i8*, i8** %149, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %151 = bitcast i8* %150 to i8**
  %152 = getelementptr inbounds i8*, i8** %151, i64 %142
  %153 = load i8*, i8** %152, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %154 = bitcast i8* %153 to i64*
  %155 = load i64, i64* %154, align 8
  %156 = getelementptr inbounds i8, i8* %153, i64 8
  %157 = icmp eq i64 %155, 1
  br i1 %157, label %join.byte, label %join.bulk

join.byte:
  %158 = load i8, i8* %156, align 1
  store i8 %158, i8* %148, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %148, i8* %156, i64 %155, i1 false)
  br label %join.next

join.next:
  %159 = getelementptr inbounds i8, i8* %148, i64 %155
  store i8* %159, i8** %join.p, align 8
  %160 = add i64 %142, 1
  store i64 %160, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %161 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %161, align 1
  call void @nish_print(i8* %139)
  %162 = load i32, i32* %fd.addr, align 4
  %163 = call i32 @nish_file_close(i32 %162)
  %164 = call i8* @nish_str_from_i32(i32 %163)
  %165 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.9 to i8*), i8* %164)
  call void @nish_print(i8* %165)
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
