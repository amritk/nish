%struct.Row = type { i32, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pear\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"fig\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"apple\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kiwi\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"date\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"banana\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define hidden noundef i32 @byKey$(%struct.Row* noundef nonnull readonly align 4 dereferenceable(12) nocapture %a, %struct.Row* noundef nonnull readonly align 4 dereferenceable(12) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Row, %struct.Row* %a, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Row, %struct.Row* %b, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define hidden noundef i32 @byLength$(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #1 {
entry:
  %0 = bitcast i8* %a to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = bitcast i8* %b to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = sub nsw i32 %2, %5
  ret i32 %6
}

define void @nish_main() #0 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %Row.obj = alloca %struct.Row, align 8
  %same.addr = alloca i1, align 1
  %stable.addr = alloca i1, align 1
  %i.addr.1 = alloca i32, align 4
  %a.addr = alloca %struct.Row*, align 8
  %b.addr = alloca %struct.Row*, align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 200
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = mul nsw i32 %6, 37
  %8 = srem i32 %7, 7
  %9 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 0
  store i32 %8, i32* %9, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = mul nsw i32 %12, 3
  %14 = add nsw i32 %13, 1
  %15 = getelementptr inbounds %struct.Row, %struct.Row* %Row.obj, i32 0, i32 2
  store i32 %14, i32* %15, align 4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 12)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to %struct.Row*
  %24 = getelementptr inbounds %struct.Row, %struct.Row* %23, i64 %17
  %25 = bitcast %struct.Row* %24 to i8*
  %26 = bitcast %struct.Row* %Row.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %25, i8* align 4 %26, i64 12, i1 false), !alias.scope !4, !noalias !3
  %27 = add i64 %17, 1
  store i64 %27, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %32 = call %struct.nish_array* @nish.sortWith$$Row$fn.5.byKey(%struct.nish_array* %31)
  %33 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %34 = icmp eq %struct.nish_array* %32, %33
  store i1 %34, i1* %same.addr, align 1
  store i1 true, i1* %stable.addr, align 1
  store i32 1, i32* %i.addr.1, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %40 = load i32, i32* %i.addr.1, align 4
  %41 = trunc i64 %37 to i32
  %42 = icmp slt i32 %40, %41
  br i1 %42, label %for.body.1, label %for.end.1

for.body.1:
  %43 = load i32, i32* %i.addr.1, align 4
  %44 = sub nsw i32 %43, 1
  %45 = sext i32 %44 to i64
  %46 = icmp ult i64 %45, %37
  br i1 %46, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %45, i64 %37)
  unreachable

bounds.ok:
  %47 = bitcast i8* %39 to %struct.Row*
  %48 = getelementptr inbounds %struct.Row, %struct.Row* %47, i64 %45
  store %struct.Row* %48, %struct.Row** %a.addr, align 8
  %49 = load i32, i32* %i.addr.1, align 4
  %50 = sext i32 %49 to i64
  %51 = bitcast i8* %39 to %struct.Row*
  %52 = getelementptr inbounds %struct.Row, %struct.Row* %51, i64 %50
  store %struct.Row* %52, %struct.Row** %b.addr, align 8
  %53 = load %struct.Row*, %struct.Row** %a.addr, align 8
  %54 = getelementptr inbounds %struct.Row, %struct.Row* %53, i32 0, i32 0
  %55 = load i32, i32* %54, align 4
  %56 = load %struct.Row*, %struct.Row** %b.addr, align 8
  %57 = getelementptr inbounds %struct.Row, %struct.Row* %56, i32 0, i32 0
  %58 = load i32, i32* %57, align 4
  %59 = icmp sgt i32 %55, %58
  br i1 %59, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %60 = load %struct.Row*, %struct.Row** %a.addr, align 8
  %61 = getelementptr inbounds %struct.Row, %struct.Row* %60, i32 0, i32 0
  %62 = load i32, i32* %61, align 4
  %63 = load %struct.Row*, %struct.Row** %b.addr, align 8
  %64 = getelementptr inbounds %struct.Row, %struct.Row* %63, i32 0, i32 0
  %65 = load i32, i32* %64, align 4
  %66 = icmp eq i32 %62, %65
  br i1 %66, label %land.rhs, label %land.end

land.rhs:
  %67 = load %struct.Row*, %struct.Row** %a.addr, align 8
  %68 = getelementptr inbounds %struct.Row, %struct.Row* %67, i32 0, i32 1
  %69 = load i32, i32* %68, align 4
  %70 = load %struct.Row*, %struct.Row** %b.addr, align 8
  %71 = getelementptr inbounds %struct.Row, %struct.Row* %70, i32 0, i32 1
  %72 = load i32, i32* %71, align 4
  %73 = icmp sge i32 %69, %72
  br label %land.end

land.end:
  %74 = phi i1 [ false, %lor.rhs.1 ], [ %73, %land.rhs ]
  br label %lor.end.1

lor.end.1:
  %75 = phi i1 [ true, %bounds.ok ], [ %74, %land.end ]
  br i1 %75, label %lor.end, label %lor.rhs

lor.rhs:
  %76 = load %struct.Row*, %struct.Row** %b.addr, align 8
  %77 = getelementptr inbounds %struct.Row, %struct.Row* %76, i32 0, i32 2
  %78 = load i32, i32* %77, align 4
  %79 = load %struct.Row*, %struct.Row** %b.addr, align 8
  %80 = getelementptr inbounds %struct.Row, %struct.Row* %79, i32 0, i32 1
  %81 = load i32, i32* %80, align 4
  %82 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %81, i32 3)
  %83 = extractvalue { i32, i1 } %82, 0
  %84 = extractvalue { i32, i1 } %82, 1
  br i1 %84, label %ovf.fail, label %ovf.ok

ovf.ok:
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %83, i32 1)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %88 = icmp ne i32 %78, %86
  br label %lor.end

lor.end:
  %89 = phi i1 [ true, %lor.end.1 ], [ %88, %ovf.ok.1 ]
  br i1 %89, label %if.then, label %if.end

if.then:
  store i1 false, i1* %stable.addr, align 1
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %90 = load i32, i32* %i.addr.1, align 4
  %91 = add nsw i32 %90, 1
  store i32 %91, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %92 = load i1, i1* %same.addr, align 1
  %93 = select i1 %92, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %95 = load i1, i1* %stable.addr, align 1
  %96 = select i1 %95, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %97 = call i8* @nish_str_concat(i8* %94, i8* %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %99 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp ult i64 0, %101
  br i1 %102, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %101)
  unreachable

bounds.ok.1:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to %struct.Row*
  %106 = getelementptr inbounds %struct.Row, %struct.Row* %105, i64 0
  %107 = getelementptr inbounds %struct.Row, %struct.Row* %106, i32 0, i32 1
  %108 = load i32, i32* %107, align 4
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = call i8* @nish_str_concat(i8* %98, i8* %109)
  %111 = call i8* @nish_str_concat(i8* %110, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %112 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = icmp ult i64 1, %114
  br i1 %115, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %114)
  unreachable

bounds.ok.2:
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 2
  %117 = load i8*, i8** %116, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %118 = bitcast i8* %117 to %struct.Row*
  %119 = getelementptr inbounds %struct.Row, %struct.Row* %118, i64 1
  %120 = getelementptr inbounds %struct.Row, %struct.Row* %119, i32 0, i32 1
  %121 = load i32, i32* %120, align 4
  %122 = call i8* @nish_str_from_i32(i32 %121)
  %123 = call i8* @nish_str_concat(i8* %111, i8* %122)
  %124 = call i8* @nish_str_concat(i8* %123, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %125 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = icmp ult i64 199, %127
  br i1 %128, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 199, i64 %127)
  unreachable

bounds.ok.3:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %131 = bitcast i8* %130 to %struct.Row*
  %132 = getelementptr inbounds %struct.Row, %struct.Row* %131, i64 199
  %133 = getelementptr inbounds %struct.Row, %struct.Row* %132, i32 0, i32 0
  %134 = load i32, i32* %133, align 4
  %135 = call i8* @nish_str_from_i32(i32 %134)
  %136 = call i8* @nish_str_concat(i8* %124, i8* %135)
  %137 = call i8* @nish_str_concat(i8* %136, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %138 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %138, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to %struct.Row*
  %142 = getelementptr inbounds %struct.Row, %struct.Row* %141, i64 199
  %143 = getelementptr inbounds %struct.Row, %struct.Row* %142, i32 0, i32 1
  %144 = load i32, i32* %143, align 4
  %145 = call i8* @nish_str_from_i32(i32 %144)
  %146 = call i8* @nish_str_concat(i8* %137, i8* %145)
  call void @nish_print(i8* %146)
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 7, i64* %147, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 7, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %149 = bitcast [7 x i8*]* %arr.data to i8*
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %149, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %151 = bitcast i8* %149 to i8**
  %152 = getelementptr inbounds i8*, i8** %151, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %152, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %153 = getelementptr inbounds i8*, i8** %151, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %153, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %154 = getelementptr inbounds i8*, i8** %151, i64 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8** %154, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %155 = getelementptr inbounds i8*, i8** %151, i64 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8** %155, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %156 = getelementptr inbounds i8*, i8** %151, i64 4
  store i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i8** %156, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %157 = getelementptr inbounds i8*, i8** %151, i64 5
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %157, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %158 = getelementptr inbounds i8*, i8** %151, i64 6
  store i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*), i8** %158, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %160 = call %struct.nish_array* @nish.sortWith$str$fn.8.byLength(%struct.nish_array* %159)
  %161 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %165 = load i64, i64* %164, align 8
  %166 = sub i64 %163, 1
  %167 = mul i64 %165, %166
  %168 = icmp eq i64 %163, 0
  %169 = select i1 %168, i64 0, i64 %167
  store i64 %169, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %170 = load i64, i64* %join.at, align 8
  %171 = icmp ult i64 %170, %163
  br i1 %171, label %join.sum.body, label %join.copy

join.sum.body:
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %173 = load i8*, i8** %172, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %174 = bitcast i8* %173 to i8**
  %175 = getelementptr inbounds i8*, i8** %174, i64 %170
  %176 = load i8*, i8** %175, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %177 = load i64, i64* %join.total, align 8
  %178 = bitcast i8* %176 to i64*
  %179 = load i64, i64* %178, align 8
  %180 = add i64 %177, %179
  store i64 %180, i64* %join.total, align 8
  %181 = add i64 %170, 1
  store i64 %181, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %182 = load i64, i64* %join.total, align 8
  %183 = icmp ugt i64 %182, 2147483647
  %184 = add i64 %182, 9
  %185 = select i1 %183, i64 4611686018427387904, i64 %184
  %186 = call i8* @nish_alloc_struct(i64 %185)
  %187 = bitcast i8* %186 to i64*
  store i64 %182, i64* %187, align 8
  %188 = getelementptr inbounds i8, i8* %186, i64 8
  store i8* %188, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %189 = load i64, i64* %join.at, align 8
  %190 = icmp ult i64 %189, %163
  br i1 %190, label %join.part, label %join.end

join.part:
  %191 = load i8*, i8** %join.p, align 8
  %192 = icmp eq i64 %189, 0
  %193 = select i1 %192, i64 0, i64 %165
  %194 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %191, i8* %194, i64 %193, i1 false)
  %195 = getelementptr inbounds i8, i8* %191, i64 %193
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %197 = load i8*, i8** %196, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %198 = bitcast i8* %197 to i8**
  %199 = getelementptr inbounds i8*, i8** %198, i64 %189
  %200 = load i8*, i8** %199, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %201 = bitcast i8* %200 to i64*
  %202 = load i64, i64* %201, align 8
  %203 = getelementptr inbounds i8, i8* %200, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %195, i8* %203, i64 %202, i1 false)
  %204 = getelementptr inbounds i8, i8* %195, i64 %202
  store i8* %204, i8** %join.p, align 8
  %205 = add i64 %189, 1
  store i64 %205, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %206 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %206, align 1
  call void @nish_print(i8* %186)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %lor.rhs ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.stepTo(i32 noundef %lo, i32 noundef %step, i32 noundef %n) #2 {
entry:
  %0 = sub i32 %n, %lo
  %1 = icmp sgt i32 %0, %step
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = add i32 %lo, %step
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %n, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$$Row$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca %struct.Row*, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = icmp slt i32 %3, 2
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.Row*
  %15 = getelementptr inbounds %struct.Row, %struct.Row* %14, i64 %8
  store %struct.Row* %15, %struct.Row** %x.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %17 = load %struct.Row*, %struct.Row** %x.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %16, i64 12)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to %struct.Row*
  %26 = getelementptr inbounds %struct.Row, %struct.Row* %25, i64 %19
  %27 = bitcast %struct.Row* %26 to i8*
  %28 = bitcast %struct.Row* %17 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %27, i8* align 4 %28, i64 12, i1 false), !alias.scope !4, !noalias !3
  %29 = add i64 %19, 1
  store i64 %29, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %33 = load i32, i32* %lo.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %lo.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %35, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %while.cond ], [ %37, %land.rhs ]
  br i1 %38, label %while.body, label %while.end

while.body:
  %39 = load i32, i32* %lo.addr, align 4
  %40 = load i32, i32* %n.addr, align 4
  %41 = call i32 @nish.stepTo(i32 %39, i32 32, i32 %40)
  store i32 %41, i32* %hi.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %43 = load i32, i32* %lo.addr, align 4
  %44 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$$Row$fn.5.byKey(%struct.nish_array* %42, %struct.nish_array* %xs, i32 %43, i32 %44)
  %45 = load i32, i32* %hi.addr, align 4
  store i32 %45, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %46 = load i32, i32* %width.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %48 = load i32, i32* %width.addr, align 4
  %49 = load i32, i32* %n.addr, align 4
  %50 = icmp slt i32 %48, %49
  br label %land.end.1

land.end.1:
  %51 = phi i1 [ false, %while.cond.1 ], [ %50, %land.rhs.1 ]
  br i1 %51, label %while.body.1, label %while.end.1

while.body.1:
  %52 = load i1, i1* %inTmp.addr, align 1
  br i1 %52, label %if.then.1, label %if.else

if.then.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %54 = load i32, i32* %n.addr, align 4
  %55 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$$Row$fn.5.byKey(%struct.nish_array* %53, %struct.nish_array* %xs, i32 %54, i32 %55)
  br label %if.end.1

if.else:
  %56 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %57 = load i32, i32* %n.addr, align 4
  %58 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$$Row$fn.5.byKey(%struct.nish_array* %xs, %struct.nish_array* %56, i32 %57, i32 %58)
  br label %if.end.1

if.end.1:
  %59 = load i1, i1* %inTmp.addr, align 1
  %60 = xor i1 %59, true
  store i1 %60, i1* %inTmp.addr, align 1
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %width.addr, align 4
  %63 = load i32, i32* %n.addr, align 4
  %64 = call i32 @nish.stepTo(i32 %61, i32 %62, i32 %63)
  store i32 %64, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %65 = load i1, i1* %inTmp.addr, align 1
  br i1 %65, label %if.then.2, label %if.end.2

if.then.2:
  %66 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %67 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$$Row(%struct.nish_array* %66, %struct.nish_array* %xs, i32 0, i32 %67)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$str$fn.8.byLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = icmp slt i32 %3, 2
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %8
  %16 = load i8*, i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %16, i8** %x.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %18 = load i8*, i8** %x.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  store i8* %18, i8** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %forof.inc

forof.inc:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = add i64 %30, 1
  store i64 %31, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %32 = load i32, i32* %lo.addr, align 4
  %33 = icmp sge i32 %32, 0
  br i1 %33, label %land.rhs, label %land.end

land.rhs:
  %34 = load i32, i32* %lo.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %lo.addr, align 4
  %39 = load i32, i32* %n.addr, align 4
  %40 = call i32 @nish.stepTo(i32 %38, i32 32, i32 %39)
  store i32 %40, i32* %hi.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %42 = load i32, i32* %lo.addr, align 4
  %43 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$str$fn.8.byLength(%struct.nish_array* %41, %struct.nish_array* %xs, i32 %42, i32 %43)
  %44 = load i32, i32* %hi.addr, align 4
  store i32 %44, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %45 = load i32, i32* %width.addr, align 4
  %46 = icmp sgt i32 %45, 0
  br i1 %46, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %47 = load i32, i32* %width.addr, align 4
  %48 = load i32, i32* %n.addr, align 4
  %49 = icmp slt i32 %47, %48
  br label %land.end.1

land.end.1:
  %50 = phi i1 [ false, %while.cond.1 ], [ %49, %land.rhs.1 ]
  br i1 %50, label %while.body.1, label %while.end.1

while.body.1:
  %51 = load i1, i1* %inTmp.addr, align 1
  br i1 %51, label %if.then.1, label %if.else

if.then.1:
  %52 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  %54 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.8.byLength(%struct.nish_array* %52, %struct.nish_array* %xs, i32 %53, i32 %54)
  br label %if.end.1

if.else:
  %55 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %56 = load i32, i32* %n.addr, align 4
  %57 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$str$fn.8.byLength(%struct.nish_array* %xs, %struct.nish_array* %55, i32 %56, i32 %57)
  br label %if.end.1

if.end.1:
  %58 = load i1, i1* %inTmp.addr, align 1
  %59 = xor i1 %58, true
  store i1 %59, i1* %inTmp.addr, align 1
  %60 = load i32, i32* %width.addr, align 4
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %n.addr, align 4
  %63 = call i32 @nish.stepTo(i32 %60, i32 %61, i32 %62)
  store i32 %63, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %64 = load i1, i1* %inTmp.addr, align 1
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %66 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$str(%struct.nish_array* %65, %struct.nish_array* %xs, i32 0, i32 %66)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal void @nish.insertionRun$$Row$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %d.addr, align 4
  %17 = sub nsw i32 %16, 1
  store i32 %17, i32* %p.addr, align 4
  %18 = load i32, i32* %p.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to %struct.Row*
  %21 = getelementptr inbounds %struct.Row, %struct.Row* %20, i64 %19
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %6 to %struct.Row*
  %25 = getelementptr inbounds %struct.Row, %struct.Row* %24, i64 %23
  %26 = call i32 @byKey$(%struct.Row* %21, %struct.Row* %25)
  %27 = icmp sgt i32 %26, 0
  %28 = xor i1 %27, true
  br i1 %28, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %29 = load i32, i32* %d.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %31 = load i32, i32* %d.addr, align 4
  %32 = icmp sge i32 %31, %hi
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %44 = load i32, i32* %k.addr, align 4
  %45 = icmp sge i32 %44, 0
  br i1 %45, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp slt i32 %46, %hi
  br label %land.end.5

land.end.5:
  %48 = phi i1 [ false, %for.cond ], [ %47, %land.rhs.5 ]
  br i1 %48, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %49 = load i32, i32* %k.addr, align 4
  %50 = trunc i64 %37 to i32
  %51 = icmp slt i32 %49, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = trunc i64 %41 to i32
  %58 = icmp slt i32 %56, %57
  br label %land.end.2

land.end.2:
  %59 = phi i1 [ false, %land.end.3 ], [ %58, %land.rhs.2 ]
  br i1 %59, label %for.body, label %for.end

for.body:
  %60 = load i32, i32* %k.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = load i32, i32* %r.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %43 to %struct.Row*
  %65 = getelementptr inbounds %struct.Row, %struct.Row* %64, i64 %63
  %66 = bitcast i8* %39 to %struct.Row*
  %67 = getelementptr inbounds %struct.Row, %struct.Row* %66, i64 %61
  %68 = bitcast %struct.Row* %67 to i8*
  %69 = bitcast %struct.Row* %65 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %68, i8* align 4 %69, i64 12, i1 false), !alias.scope !4, !noalias !3
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub nsw i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = trunc i64 %89 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end.8

land.end.8:
  %104 = phi i1 [ false, %land.end.9 ], [ %103, %land.rhs.8 ]
  br i1 %104, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %105 = load i32, i32* %i.addr, align 4
  %106 = trunc i64 %93 to i32
  %107 = icmp slt i32 %105, %106
  br label %land.end.7

land.end.7:
  %108 = phi i1 [ false, %land.end.8 ], [ %107, %land.rhs.7 ]
  br i1 %108, label %while.body.1, label %while.end.1

while.body.1:
  %109 = load i32, i32* %j.addr, align 4
  %110 = sub nsw i32 %109, 1
  store i32 %110, i32* %k.addr.1, align 4
  %111 = load i32, i32* %k.addr.1, align 4
  %112 = sext i32 %111 to i64
  %113 = bitcast i8* %91 to %struct.Row*
  %114 = getelementptr inbounds %struct.Row, %struct.Row* %113, i64 %112
  %115 = load i32, i32* %i.addr, align 4
  %116 = sext i32 %115 to i64
  %117 = bitcast i8* %95 to %struct.Row*
  %118 = getelementptr inbounds %struct.Row, %struct.Row* %117, i64 %116
  %119 = call i32 @byKey$(%struct.Row* %114, %struct.Row* %118)
  %120 = icmp sgt i32 %119, 0
  %121 = xor i1 %120, true
  br i1 %121, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %122 = load i32, i32* %k.addr.1, align 4
  %123 = icmp slt i32 %122, 0
  br label %lor.end.2

lor.end.2:
  %124 = phi i1 [ true, %while.body.1 ], [ %123, %lor.rhs.2 ]
  br i1 %124, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %125 = load i32, i32* %k.addr.1, align 4
  %126 = trunc i64 %89 to i32
  %127 = icmp sge i32 %125, %126
  br label %lor.end.1

lor.end.1:
  %128 = phi i1 [ true, %lor.end.2 ], [ %127, %lor.rhs.1 ]
  br i1 %128, label %lor.end, label %lor.rhs

lor.rhs:
  %129 = load i32, i32* %j.addr, align 4
  %130 = trunc i64 %89 to i32
  %131 = icmp sge i32 %129, %130
  br label %lor.end

lor.end:
  %132 = phi i1 [ true, %lor.end.1 ], [ %131, %lor.rhs ]
  br i1 %132, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %133 = load i32, i32* %j.addr, align 4
  %134 = sext i32 %133 to i64
  %135 = load i32, i32* %k.addr.1, align 4
  %136 = sext i32 %135 to i64
  %137 = bitcast i8* %91 to %struct.Row*
  %138 = getelementptr inbounds %struct.Row, %struct.Row* %137, i64 %136
  %139 = bitcast i8* %91 to %struct.Row*
  %140 = getelementptr inbounds %struct.Row, %struct.Row* %139, i64 %134
  %141 = bitcast %struct.Row* %140 to i8*
  %142 = bitcast %struct.Row* %138 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %141, i8* align 4 %142, i64 12, i1 false), !alias.scope !4, !noalias !3
  %143 = load i32, i32* %k.addr.1, align 4
  store i32 %143, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %144 = load i32, i32* %i.addr, align 4
  %145 = trunc i64 %79 to i32
  %146 = icmp slt i32 %144, %145
  br i1 %146, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %147 = load i32, i32* %j.addr, align 4
  %148 = icmp sge i32 %147, 0
  br label %land.end.11

land.end.11:
  %149 = phi i1 [ false, %while.end.1 ], [ %148, %land.rhs.11 ]
  br i1 %149, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %150 = load i32, i32* %j.addr, align 4
  %151 = trunc i64 %75 to i32
  %152 = icmp slt i32 %150, %151
  br label %land.end.10

land.end.10:
  %153 = phi i1 [ false, %land.end.11 ], [ %152, %land.rhs.10 ]
  br i1 %153, label %if.then.3, label %if.end.3

if.then.3:
  %154 = load i32, i32* %j.addr, align 4
  %155 = sext i32 %154 to i64
  %156 = load i32, i32* %i.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = bitcast i8* %81 to %struct.Row*
  %159 = getelementptr inbounds %struct.Row, %struct.Row* %158, i64 %157
  %160 = bitcast i8* %77 to %struct.Row*
  %161 = getelementptr inbounds %struct.Row, %struct.Row* %160, i64 %155
  %162 = bitcast %struct.Row* %161 to i8*
  %163 = bitcast %struct.Row* %159 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %162, i8* align 4 %163, i64 12, i1 false), !alias.scope !4, !noalias !3
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %164 = load i32, i32* %i.addr, align 4
  %165 = add nsw i32 %164, 1
  store i32 %165, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$$Row$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$$Row$fn.5.byKey(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$$Row(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %k.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %k.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to %struct.Row*
  %26 = getelementptr inbounds %struct.Row, %struct.Row* %25, i64 %24
  %27 = bitcast i8* %7 to %struct.Row*
  %28 = getelementptr inbounds %struct.Row, %struct.Row* %27, i64 %22
  %29 = bitcast %struct.Row* %28 to i8*
  %30 = bitcast %struct.Row* %26 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %29, i8* align 4 %30, i64 12, i1 false), !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %31 = load i32, i32* %k.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.insertionRun$str$fn.8.byLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = trunc i64 %4 to i32
  %14 = icmp slt i32 %12, %13
  br label %land.end

land.end:
  %15 = phi i1 [ false, %land.end.1 ], [ %14, %land.rhs ]
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %d.addr, align 4
  %17 = sub nsw i32 %16, 1
  store i32 %17, i32* %p.addr, align 4
  %18 = load i32, i32* %p.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %19
  %22 = load i8*, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load i32, i32* %d.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %6 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %24
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = call i32 @byLength$(i8* %22, i8* %27)
  %29 = icmp sgt i32 %28, 0
  %30 = xor i1 %29, true
  br i1 %30, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %31 = load i32, i32* %d.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %d.addr, align 4
  %34 = icmp sge i32 %33, %hi
  br i1 %34, label %if.then.1, label %if.end.1

if.then.1:
  %35 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %46 = load i32, i32* %k.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %48 = load i32, i32* %k.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.5

land.end.5:
  %50 = phi i1 [ false, %for.cond ], [ %49, %land.rhs.5 ]
  br i1 %50, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %51 = load i32, i32* %k.addr, align 4
  %52 = trunc i64 %39 to i32
  %53 = icmp slt i32 %51, %52
  br label %land.end.4

land.end.4:
  %54 = phi i1 [ false, %land.end.5 ], [ %53, %land.rhs.4 ]
  br i1 %54, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %55 = load i32, i32* %r.addr, align 4
  %56 = icmp sge i32 %55, 0
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %land.end.4 ], [ %56, %land.rhs.3 ]
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load i32, i32* %r.addr, align 4
  %59 = trunc i64 %43 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.2

land.end.2:
  %61 = phi i1 [ false, %land.end.3 ], [ %60, %land.rhs.2 ]
  br i1 %61, label %for.body, label %for.end

for.body:
  %62 = load i32, i32* %k.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %r.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %45 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %65
  %68 = load i8*, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = bitcast i8* %41 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 %63
  store i8* %68, i8** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = load i32, i32* %r.addr, align 4
  %72 = sub nsw i32 %71, 1
  store i32 %72, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %83 = load i32, i32* %i.addr, align 4
  %84 = icmp sge i32 %83, 0
  br i1 %84, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %85 = load i32, i32* %i.addr, align 4
  %86 = icmp slt i32 %85, %hi
  br label %land.end.6

land.end.6:
  %87 = phi i1 [ false, %for.cond.1 ], [ %86, %land.rhs.6 ]
  br i1 %87, label %for.body.1, label %for.end.1

for.body.1:
  %88 = load i32, i32* %i.addr, align 4
  store i32 %88, i32* %j.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %97 = load i32, i32* %j.addr, align 4
  %98 = icmp sgt i32 %97, %lo
  br i1 %98, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %99 = load i32, i32* %j.addr, align 4
  %100 = icmp sgt i32 %99, 0
  br label %land.end.9

land.end.9:
  %101 = phi i1 [ false, %while.cond.1 ], [ %100, %land.rhs.9 ]
  br i1 %101, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %102 = load i32, i32* %j.addr, align 4
  %103 = trunc i64 %90 to i32
  %104 = icmp slt i32 %102, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = trunc i64 %94 to i32
  %108 = icmp slt i32 %106, %107
  br label %land.end.7

land.end.7:
  %109 = phi i1 [ false, %land.end.8 ], [ %108, %land.rhs.7 ]
  br i1 %109, label %while.body.1, label %while.end.1

while.body.1:
  %110 = load i32, i32* %j.addr, align 4
  %111 = sub nsw i32 %110, 1
  store i32 %111, i32* %k.addr.1, align 4
  %112 = load i32, i32* %k.addr.1, align 4
  %113 = sext i32 %112 to i64
  %114 = bitcast i8* %92 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %113
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = load i32, i32* %i.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %96 to i8**
  %120 = getelementptr inbounds i8*, i8** %119, i64 %118
  %121 = load i8*, i8** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = call i32 @byLength$(i8* %116, i8* %121)
  %123 = icmp sgt i32 %122, 0
  %124 = xor i1 %123, true
  br i1 %124, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %125 = load i32, i32* %k.addr.1, align 4
  %126 = icmp slt i32 %125, 0
  br label %lor.end.2

lor.end.2:
  %127 = phi i1 [ true, %while.body.1 ], [ %126, %lor.rhs.2 ]
  br i1 %127, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %128 = load i32, i32* %k.addr.1, align 4
  %129 = trunc i64 %90 to i32
  %130 = icmp sge i32 %128, %129
  br label %lor.end.1

lor.end.1:
  %131 = phi i1 [ true, %lor.end.2 ], [ %130, %lor.rhs.1 ]
  br i1 %131, label %lor.end, label %lor.rhs

lor.rhs:
  %132 = load i32, i32* %j.addr, align 4
  %133 = trunc i64 %90 to i32
  %134 = icmp sge i32 %132, %133
  br label %lor.end

lor.end:
  %135 = phi i1 [ true, %lor.end.1 ], [ %134, %lor.rhs ]
  br i1 %135, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %136 = load i32, i32* %j.addr, align 4
  %137 = sext i32 %136 to i64
  %138 = load i32, i32* %k.addr.1, align 4
  %139 = sext i32 %138 to i64
  %140 = bitcast i8* %92 to i8**
  %141 = getelementptr inbounds i8*, i8** %140, i64 %139
  %142 = load i8*, i8** %141, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = bitcast i8* %92 to i8**
  %144 = getelementptr inbounds i8*, i8** %143, i64 %137
  store i8* %142, i8** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %145 = load i32, i32* %k.addr.1, align 4
  store i32 %145, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %80 to i32
  %148 = icmp slt i32 %146, %147
  br i1 %148, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %149 = load i32, i32* %j.addr, align 4
  %150 = icmp sge i32 %149, 0
  br label %land.end.11

land.end.11:
  %151 = phi i1 [ false, %while.end.1 ], [ %150, %land.rhs.11 ]
  br i1 %151, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %152 = load i32, i32* %j.addr, align 4
  %153 = trunc i64 %76 to i32
  %154 = icmp slt i32 %152, %153
  br label %land.end.10

land.end.10:
  %155 = phi i1 [ false, %land.end.11 ], [ %154, %land.rhs.10 ]
  br i1 %155, label %if.then.3, label %if.end.3

if.then.3:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = load i32, i32* %i.addr, align 4
  %159 = sext i32 %158 to i64
  %160 = bitcast i8* %82 to i8**
  %161 = getelementptr inbounds i8*, i8** %160, i64 %159
  %162 = load i8*, i8** %161, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = bitcast i8* %78 to i8**
  %164 = getelementptr inbounds i8*, i8** %163, i64 %157
  store i8* %162, i8** %164, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %165 = load i32, i32* %i.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$str$fn.8.byLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #0 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$str$fn.8.byLength(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %k.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %k.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %24
  %27 = load i8*, i8** %26, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = bitcast i8* %7 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %27, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %30 = load i32, i32* %k.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$$Row$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %mid, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sub nsw i32 %mid, 1
  store i32 %8, i32* %last.addr, align 4
  %9 = load i32, i32* %last.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %9, %12
  br i1 %13, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %14 = load i32, i32* %last.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.Row*
  %19 = getelementptr inbounds %struct.Row, %struct.Row* %18, i64 %15
  %20 = sext i32 %mid to i64
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to %struct.Row*
  %24 = getelementptr inbounds %struct.Row, %struct.Row* %23, i64 %20
  %25 = call i32 @byKey$(%struct.Row* %19, %struct.Row* %24)
  %26 = icmp sgt i32 %25, 0
  %27 = xor i1 %26, true
  br label %land.end.2

land.end.2:
  %28 = phi i1 [ false, %if.then ], [ %27, %land.rhs.2 ]
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$$Row(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %37 = load i32, i32* %k.addr, align 4
  %38 = icmp sge i32 %37, 0
  br i1 %38, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %39 = load i32, i32* %k.addr, align 4
  %40 = icmp slt i32 %39, %hi
  br label %land.end.3

land.end.3:
  %41 = phi i1 [ false, %for.cond ], [ %40, %land.rhs.3 ]
  br i1 %41, label %for.body, label %for.end

for.body:
  %42 = load i32, i32* %i.addr, align 4
  %43 = icmp sge i32 %42, %mid
  store i1 %43, i1* %right.addr, align 1
  %44 = load i1, i1* %right.addr, align 1
  %45 = xor i1 %44, true
  br i1 %45, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %46 = load i32, i32* %j.addr, align 4
  %47 = icmp slt i32 %46, %hi
  br label %land.end.8

land.end.8:
  %48 = phi i1 [ false, %for.body ], [ %47, %land.rhs.8 ]
  br i1 %48, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %49 = load i32, i32* %i.addr, align 4
  %50 = icmp sge i32 %49, 0
  br label %land.end.7

land.end.7:
  %51 = phi i1 [ false, %land.end.8 ], [ %50, %land.rhs.7 ]
  br i1 %51, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %52 = load i32, i32* %i.addr, align 4
  %53 = trunc i64 %30 to i32
  %54 = icmp slt i32 %52, %53
  br label %land.end.6

land.end.6:
  %55 = phi i1 [ false, %land.end.7 ], [ %54, %land.rhs.6 ]
  br i1 %55, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %56 = load i32, i32* %j.addr, align 4
  %57 = icmp sge i32 %56, 0
  br label %land.end.5

land.end.5:
  %58 = phi i1 [ false, %land.end.6 ], [ %57, %land.rhs.5 ]
  br i1 %58, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %59 = load i32, i32* %j.addr, align 4
  %60 = trunc i64 %30 to i32
  %61 = icmp slt i32 %59, %60
  br label %land.end.4

land.end.4:
  %62 = phi i1 [ false, %land.end.5 ], [ %61, %land.rhs.4 ]
  br i1 %62, label %if.then.2, label %if.end.2

if.then.2:
  %63 = load i32, i32* %i.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %32 to %struct.Row*
  %66 = getelementptr inbounds %struct.Row, %struct.Row* %65, i64 %64
  %67 = load i32, i32* %j.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %32 to %struct.Row*
  %70 = getelementptr inbounds %struct.Row, %struct.Row* %69, i64 %68
  %71 = call i32 @byKey$(%struct.Row* %66, %struct.Row* %70)
  %72 = icmp sgt i32 %71, 0
  store i1 %72, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %73 = load i1, i1* %right.addr, align 1
  br i1 %73, label %if.then.3, label %if.else

if.then.3:
  %74 = load i32, i32* %j.addr, align 4
  %75 = icmp sge i32 %74, 0
  br i1 %75, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %76 = load i32, i32* %j.addr, align 4
  %77 = trunc i64 %30 to i32
  %78 = icmp slt i32 %76, %77
  br label %land.end.10

land.end.10:
  %79 = phi i1 [ false, %if.then.3 ], [ %78, %land.rhs.10 ]
  br i1 %79, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %80 = load i32, i32* %k.addr, align 4
  %81 = trunc i64 %34 to i32
  %82 = icmp slt i32 %80, %81
  br label %land.end.9

land.end.9:
  %83 = phi i1 [ false, %land.end.10 ], [ %82, %land.rhs.9 ]
  br i1 %83, label %if.then.4, label %if.end.4

if.then.4:
  %84 = load i32, i32* %k.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = load i32, i32* %j.addr, align 4
  %87 = sext i32 %86 to i64
  %88 = bitcast i8* %32 to %struct.Row*
  %89 = getelementptr inbounds %struct.Row, %struct.Row* %88, i64 %87
  %90 = bitcast i8* %36 to %struct.Row*
  %91 = getelementptr inbounds %struct.Row, %struct.Row* %90, i64 %85
  %92 = bitcast %struct.Row* %91 to i8*
  %93 = bitcast %struct.Row* %89 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %92, i8* align 4 %93, i64 12, i1 false), !alias.scope !4, !noalias !3
  br label %if.end.4

if.end.4:
  %94 = load i32, i32* %j.addr, align 4
  %95 = add i32 %94, 1
  store i32 %95, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %96 = load i32, i32* %i.addr, align 4
  %97 = icmp sge i32 %96, 0
  br i1 %97, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %98 = load i32, i32* %i.addr, align 4
  %99 = trunc i64 %30 to i32
  %100 = icmp slt i32 %98, %99
  br label %land.end.12

land.end.12:
  %101 = phi i1 [ false, %if.else ], [ %100, %land.rhs.12 ]
  br i1 %101, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %102 = load i32, i32* %k.addr, align 4
  %103 = trunc i64 %34 to i32
  %104 = icmp slt i32 %102, %103
  br label %land.end.11

land.end.11:
  %105 = phi i1 [ false, %land.end.12 ], [ %104, %land.rhs.11 ]
  br i1 %105, label %if.then.5, label %if.end.5

if.then.5:
  %106 = load i32, i32* %k.addr, align 4
  %107 = sext i32 %106 to i64
  %108 = load i32, i32* %i.addr, align 4
  %109 = sext i32 %108 to i64
  %110 = bitcast i8* %32 to %struct.Row*
  %111 = getelementptr inbounds %struct.Row, %struct.Row* %110, i64 %109
  %112 = bitcast i8* %36 to %struct.Row*
  %113 = getelementptr inbounds %struct.Row, %struct.Row* %112, i64 %107
  %114 = bitcast %struct.Row* %113 to i8*
  %115 = bitcast %struct.Row* %111 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %114, i8* align 4 %115, i64 12, i1 false), !alias.scope !4, !noalias !3
  br label %if.end.5

if.end.5:
  %116 = load i32, i32* %i.addr, align 4
  %117 = add i32 %116, 1
  store i32 %117, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %118 = load i32, i32* %k.addr, align 4
  %119 = add nsw i32 %118, 1
  store i32 %119, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$str$fn.8.byLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #0 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %mid, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sub nsw i32 %mid, 1
  store i32 %8, i32* %last.addr, align 4
  %9 = load i32, i32* %last.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %9, %12
  br i1 %13, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %14 = load i32, i32* %last.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %15
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = sext i32 %mid to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %21
  %26 = load i8*, i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = call i32 @byLength$(i8* %20, i8* %26)
  %28 = icmp sgt i32 %27, 0
  %29 = xor i1 %28, true
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %if.then ], [ %29, %land.rhs.2 ]
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$str(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %39 = load i32, i32* %k.addr, align 4
  %40 = icmp sge i32 %39, 0
  br i1 %40, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp slt i32 %41, %hi
  br label %land.end.3

land.end.3:
  %43 = phi i1 [ false, %for.cond ], [ %42, %land.rhs.3 ]
  br i1 %43, label %for.body, label %for.end

for.body:
  %44 = load i32, i32* %i.addr, align 4
  %45 = icmp sge i32 %44, %mid
  store i1 %45, i1* %right.addr, align 1
  %46 = load i1, i1* %right.addr, align 1
  %47 = xor i1 %46, true
  br i1 %47, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, %hi
  br label %land.end.8

land.end.8:
  %50 = phi i1 [ false, %for.body ], [ %49, %land.rhs.8 ]
  br i1 %50, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %51 = load i32, i32* %i.addr, align 4
  %52 = icmp sge i32 %51, 0
  br label %land.end.7

land.end.7:
  %53 = phi i1 [ false, %land.end.8 ], [ %52, %land.rhs.7 ]
  br i1 %53, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %54 = load i32, i32* %i.addr, align 4
  %55 = trunc i64 %32 to i32
  %56 = icmp slt i32 %54, %55
  br label %land.end.6

land.end.6:
  %57 = phi i1 [ false, %land.end.7 ], [ %56, %land.rhs.6 ]
  br i1 %57, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %58 = load i32, i32* %j.addr, align 4
  %59 = icmp sge i32 %58, 0
  br label %land.end.5

land.end.5:
  %60 = phi i1 [ false, %land.end.6 ], [ %59, %land.rhs.5 ]
  br i1 %60, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %61 = load i32, i32* %j.addr, align 4
  %62 = trunc i64 %32 to i32
  %63 = icmp slt i32 %61, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %land.end.5 ], [ %63, %land.rhs.4 ]
  br i1 %64, label %if.then.2, label %if.end.2

if.then.2:
  %65 = load i32, i32* %i.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %34 to i8**
  %68 = getelementptr inbounds i8*, i8** %67, i64 %66
  %69 = load i8*, i8** %68, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = load i32, i32* %j.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %34 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %71
  %74 = load i8*, i8** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = call i32 @byLength$(i8* %69, i8* %74)
  %76 = icmp sgt i32 %75, 0
  store i1 %76, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %77 = load i1, i1* %right.addr, align 1
  br i1 %77, label %if.then.3, label %if.else

if.then.3:
  %78 = load i32, i32* %j.addr, align 4
  %79 = icmp sge i32 %78, 0
  br i1 %79, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %80 = load i32, i32* %j.addr, align 4
  %81 = trunc i64 %32 to i32
  %82 = icmp slt i32 %80, %81
  br label %land.end.10

land.end.10:
  %83 = phi i1 [ false, %if.then.3 ], [ %82, %land.rhs.10 ]
  br i1 %83, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %84 = load i32, i32* %k.addr, align 4
  %85 = trunc i64 %36 to i32
  %86 = icmp slt i32 %84, %85
  br label %land.end.9

land.end.9:
  %87 = phi i1 [ false, %land.end.10 ], [ %86, %land.rhs.9 ]
  br i1 %87, label %if.then.4, label %if.end.4

if.then.4:
  %88 = load i32, i32* %k.addr, align 4
  %89 = sext i32 %88 to i64
  %90 = load i32, i32* %j.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = bitcast i8* %34 to i8**
  %93 = getelementptr inbounds i8*, i8** %92, i64 %91
  %94 = load i8*, i8** %93, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = bitcast i8* %38 to i8**
  %96 = getelementptr inbounds i8*, i8** %95, i64 %89
  store i8* %94, i8** %96, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.4

if.end.4:
  %97 = load i32, i32* %j.addr, align 4
  %98 = add i32 %97, 1
  store i32 %98, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %99 = load i32, i32* %i.addr, align 4
  %100 = icmp sge i32 %99, 0
  br i1 %100, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %101 = load i32, i32* %i.addr, align 4
  %102 = trunc i64 %32 to i32
  %103 = icmp slt i32 %101, %102
  br label %land.end.12

land.end.12:
  %104 = phi i1 [ false, %if.else ], [ %103, %land.rhs.12 ]
  br i1 %104, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %105 = load i32, i32* %k.addr, align 4
  %106 = trunc i64 %36 to i32
  %107 = icmp slt i32 %105, %106
  br label %land.end.11

land.end.11:
  %108 = phi i1 [ false, %land.end.12 ], [ %107, %land.rhs.11 ]
  br i1 %108, label %if.then.5, label %if.end.5

if.then.5:
  %109 = load i32, i32* %k.addr, align 4
  %110 = sext i32 %109 to i64
  %111 = load i32, i32* %i.addr, align 4
  %112 = sext i32 %111 to i64
  %113 = bitcast i8* %34 to i8**
  %114 = getelementptr inbounds i8*, i8** %113, i64 %112
  %115 = load i8*, i8** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %116 = bitcast i8* %38 to i8**
  %117 = getelementptr inbounds i8*, i8** %116, i64 %110
  store i8* %115, i8** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end.5

if.end.5:
  %118 = load i32, i32* %i.addr, align 4
  %119 = add i32 %118, 1
  store i32 %119, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %120 = load i32, i32* %k.addr, align 4
  %121 = add nsw i32 %120, 1
  store i32 %121, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
