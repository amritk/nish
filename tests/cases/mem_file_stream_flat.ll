%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"build/test/mem_file_stream_flat.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"fileOpen \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"sum: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"grows: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"closed: \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_file_read_at(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_file_close(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %window.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %fd.addr = alloca i32, align 4
  %before.addr = alloca i64, align 8
  %sum.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %grown.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [36 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
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
  %4 = icmp slt i32 %3, 256
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i32 %6 to i8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 1)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %9
  store i8 %7, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load i8*, i8** %path.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %23 = call i32 @nish_write_file_bytes(i8* %21, %struct.nish_array* %22)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %26, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %window.addr, align 8
  %28 = load i8*, i8** %path.addr, align 8
  %29 = call i32 @nish_file_open(i8* %28)
  store i32 %29, i32* %fd.addr, align 4
  %30 = load i32, i32* %fd.addr, align 4
  %31 = icmp slt i32 %30, 0
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %fd.addr, align 4
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %33)
  call void @nish_print(i8* %34)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %35 = call i64 @nish_arena_used()
  store i64 %35, i64* %before.addr, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %41 = load i32, i32* %i.addr.1, align 4
  %42 = icmp slt i32 %41, 10000
  br i1 %42, label %for.body.1, label %for.end.1

for.body.1:
  %43 = load i32, i32* %fd.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %window.addr, align 8
  %45 = load i32, i32* %i.addr.1, align 4
  %46 = srem i32 %45, 4
  %47 = sext i32 %46 to i64
  %48 = sext i32 64 to i64
  %49 = mul nsw i64 %47, %48
  %50 = add i64 0, 64
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %52 = load i64, i64* %51, align 8
  %53 = icmp ule i64 0, %50
  %54 = icmp ule i64 %50, %52
  %55 = and i1 %53, %54
  br i1 %55, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %50, i64 %52)
  unreachable

net.ok:
  %56 = call i32 @nish_file_read_at(i32 %43, %struct.nish_array* %44, i64 0, i64 64, i64 %49)
  store i32 %56, i32* %n.addr, align 4
  %57 = load i32, i32* %sum.addr, align 4
  %58 = load i32, i32* %n.addr, align 4
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok

ovf.ok:
  %62 = load i32, i32* %n.addr, align 4
  %63 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %62, i32 1)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %66 = sext i32 %64 to i64
  %67 = icmp ult i64 %66, %38
  br i1 %67, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %66, i64 %38)
  unreachable

bounds.ok:
  %68 = bitcast i8* %40 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 %66
  %70 = load i8, i8* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = zext i8 %70 to i32
  %72 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 %71)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %73, i32* %sum.addr, align 4
  br label %for.inc.1

for.inc.1:
  %75 = load i32, i32* %i.addr.1, align 4
  %76 = add nsw i32 %75, 1
  store i32 %76, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %77 = call i64 @nish_arena_used()
  %78 = load i64, i64* %before.addr, align 8
  %79 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %77, i64 %78)
  %80 = extractvalue { i64, i1 } %79, 0
  %81 = extractvalue { i64, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i64 %80, i64* %grown.addr, align 8
  %82 = load i32, i32* %sum.addr, align 4
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %83)
  call void @nish_print(i8* %84)
  %85 = load i64, i64* %grown.addr, align 8
  %86 = sext i32 0 to i64
  %87 = icmp eq i64 %85, %86
  br i1 %87, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %88 = load i64, i64* %grown.addr, align 8
  %89 = call i8* @nish_str_from_i64(i64 %88)
  %90 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %89)
  br label %cond.end

cond.end:
  %91 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), %cond.true ], [ %90, %cond.false ]
  call void @nish_print(i8* %91)
  %92 = load i32, i32* %fd.addr, align 4
  %93 = call i32 @nish_file_close(i32 %92)
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %94)
  call void @nish_print(i8* %95)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 0, %net.ok ], [ 1, %ovf.ok ], [ 0, %bounds.ok ], [ 1, %for.end.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
