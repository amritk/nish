%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"build/io_readdir\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"/sub\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"/b.txt\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"/a.txt\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/.hidden\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"h\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"unreadable\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"sub unreadable\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"empty: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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
  %dir.addr = alloca i8*, align 8
  %entries.addr = alloca %struct.nish_array*, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %5 = call zeroext i1 @nish_mkdir(i8* %4)
  %6 = load i8*, i8** %dir.addr, align 8
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  call void @nish_write_file(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %8 = load i8*, i8** %dir.addr, align 8
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  call void @nish_write_file(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %10 = load i8*, i8** %dir.addr, align 8
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*))
  call void @nish_write_file(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %12 = load i8*, i8** %dir.addr, align 8
  %13 = call %struct.nish_array* @nish_readdir(i8* %12)
  store %struct.nish_array* %13, %struct.nish_array** %entries.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %15 = icmp eq %struct.nish_array* %14, null
  br i1 %15, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [11 x i8] }* @.str.9 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %16 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %22 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*) to i64*
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
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %31
  %37 = load i8*, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !13
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
  %44 = add i64 %43, 9
  %45 = call i8* @nish_alloc_struct(i64 %44)
  %46 = bitcast i8* %45 to i64*
  store i64 %43, i64* %46, align 8
  %47 = getelementptr inbounds i8, i8* %45, i64 8
  store i8* %47, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %48 = load i64, i64* %join.at, align 8
  %49 = icmp ult i64 %48, %24
  br i1 %49, label %join.part, label %join.end

join.part:
  %50 = load i8*, i8** %join.p, align 8
  %51 = icmp eq i64 %48, 0
  %52 = select i1 %51, i64 0, i64 %26
  %53 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %50, i8* %53, i64 %52, i1 false)
  %54 = getelementptr inbounds i8, i8* %50, i64 %52
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = bitcast i8* %56 to i8**
  %58 = getelementptr inbounds i8*, i8** %57, i64 %48
  %59 = load i8*, i8** %58, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %60 = bitcast i8* %59 to i64*
  %61 = load i64, i64* %60, align 8
  %62 = getelementptr inbounds i8, i8* %59, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %54, i8* %62, i64 %61, i1 false)
  %63 = getelementptr inbounds i8, i8* %54, i64 %61
  store i8* %63, i8** %join.p, align 8
  %64 = add i64 %48, 1
  store i64 %64, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %65 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %65, align 1
  %66 = call i8* @nish_str_concat(i8* %21, i8* %45)
  call void @nish_print(i8* %66)
  %67 = load i8*, i8** %dir.addr, align 8
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %69 = call %struct.nish_array* @nish_readdir(i8* %68)
  store %struct.nish_array* %69, %struct.nish_array** %empty.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %71 = icmp eq %struct.nish_array* %70, null
  br i1 %71, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_print(i8* bitcast ({ i64, [15 x i8] }* @.str.12 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %72 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.13 to i8*), i8* %76)
  call void @nish_print(i8* %77)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
