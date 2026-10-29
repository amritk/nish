%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"build/test/io_write_file_bytes.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"wrote: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"read back: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"truncated: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"length now: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"no directory: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"build/test/io_write_file_bytes_absent/x\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"nul in path: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"build/test/a\00b\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noalias align 8 %struct.nish_array* @nish_read_file_bytes(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %back.addr = alloca %struct.nish_array*, align 8
  %same.addr = alloca i1, align 1
  %i.addr.1 = alloca i32, align 4
  %short.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %again.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [35 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
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
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %24)
  call void @nish_print(i8* %25)
  %26 = load i8*, i8** %path.addr, align 8
  %27 = call %struct.nish_array* @nish_read_file_bytes(i8* %26)
  store %struct.nish_array* %27, %struct.nish_array** %back.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %29 = icmp ne %struct.nish_array* %28, null
  br i1 %29, label %land.rhs, label %land.end

land.rhs:
  %30 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = icmp eq i32 %33, 256
  br label %land.end

land.end:
  %35 = phi i1 [ false, %for.end ], [ %34, %land.rhs ]
  store i1 %35, i1* %same.addr, align 1
  %36 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %37 = icmp ne %struct.nish_array* %36, null
  br i1 %37, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %38 = load i1, i1* %same.addr, align 1
  br label %land.end.1

land.end.1:
  %39 = phi i1 [ false, %land.end ], [ %38, %land.rhs.1 ]
  br i1 %39, label %if.then, label %if.end

if.then:
  store i32 0, i32* %i.addr.1, align 4
  %40 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %45 = load i32, i32* %i.addr.1, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = trunc i64 %48 to i32
  %50 = icmp slt i32 %45, %49
  br i1 %50, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = trunc i64 %42 to i32
  %53 = icmp slt i32 %51, %52
  br label %land.end.2

land.end.2:
  %54 = phi i1 [ false, %for.cond.1 ], [ %53, %land.rhs.2 ]
  br i1 %54, label %for.body.1, label %for.end.1

for.body.1:
  %55 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = sext i32 %56 to i64
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = icmp ult i64 %57, %59
  br i1 %60, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %57, i64 %59)
  unreachable

bounds.ok:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i8*
  %64 = getelementptr inbounds i8, i8* %63, i64 %57
  %65 = load i8, i8* %64, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %66 = load i32, i32* %i.addr.1, align 4
  %67 = sext i32 %66 to i64
  %68 = bitcast i8* %44 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 %67
  %70 = load i8, i8* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = icmp ne i8 %65, %70
  br i1 %71, label %if.then.1, label %if.end.1

if.then.1:
  store i1 false, i1* %same.addr, align 1
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %72 = load i32, i32* %i.addr.1, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  br label %if.end

if.end:
  %74 = load i1, i1* %same.addr, align 1
  %75 = select i1 %74, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %76 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i8* %75)
  call void @nish_print(i8* %76)
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %79 = bitcast [2 x i8]* %arr.data to i8*
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %79, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %79 to i8*
  %82 = getelementptr inbounds i8, i8* %81, i64 0
  store i8 0, i8* %82, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = getelementptr inbounds i8, i8* %81, i64 1
  store i8 255, i8* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %short.addr, align 8
  %84 = load i8*, i8** %path.addr, align 8
  %85 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %86 = call i32 @nish_write_file_bytes(i8* %84, %struct.nish_array* %85)
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.5 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  %89 = load i8*, i8** %path.addr, align 8
  %90 = call %struct.nish_array* @nish_read_file_bytes(i8* %89)
  store %struct.nish_array* %90, %struct.nish_array** %again.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %again.addr, align 8
  %92 = icmp eq %struct.nish_array* %91, null
  br i1 %92, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %93 = load %struct.nish_array*, %struct.nish_array** %again.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = trunc i64 %95 to i32
  br label %cond.end

cond.end:
  %97 = phi i32 [ -1, %cond.true ], [ %96, %cond.false ]
  %98 = call i8* @nish_str_from_i32(i32 %97)
  %99 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.6 to i8*), i8* %98)
  call void @nish_print(i8* %99)
  %100 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %101 = call i32 @nish_write_file_bytes(i8* bitcast ({ i64, [40 x i8] }* @.str.8 to i8*), %struct.nish_array* %100)
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.7 to i8*), i8* %102)
  call void @nish_print(i8* %103)
  %104 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %105 = call i32 @nish_write_file_bytes(i8* bitcast ({ i64, [15 x i8] }* @.str.10 to i8*), %struct.nish_array* %104)
  %106 = call i8* @nish_str_from_i32(i32 %105)
  %107 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.9 to i8*), i8* %106)
  call void @nish_print(i8* %107)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
