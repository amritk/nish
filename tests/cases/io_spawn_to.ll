%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"build/io_spawn_to\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/out.txt\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/err.txt\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"echo to-stdout; echo to-stderr >&2; exit 3\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"nothing captured\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" / \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"echo second\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"nothing captured twice\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"again: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4

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
  %dir.addr = alloca i8*, align 8
  %out.addr = alloca i8*, align 8
  %err.addr = alloca i8*, align 8
  %status.addr = alloca i32, align 4
  %captured.addr = alloca i8*, align 8
  %diagnostic.addr = alloca i8*, align 8
  %again.addr = alloca i8*, align 8
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  store i8* %4, i8** %out.addr, align 8
  %5 = load i8*, i8** %dir.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  store i8* %6, i8** %err.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i8*, i8** %13, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i8*, i8** %13, i64 2
  store i8* bitcast ({ i64, [43 x i8] }* @.str.6 to i8*), i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = load i8*, i8** %out.addr, align 8
  %18 = load i8*, i8** %err.addr, align 8
  %19 = call i32 @nish_spawn_to(%struct.nish_array* %8, i8* %17, i8* %18)
  store i32 %19, i32* %status.addr, align 4
  %20 = load i8*, i8** %out.addr, align 8
  %21 = call i8* @nish_read_file_or_null(i8* %20)
  store i8* %21, i8** %captured.addr, align 8
  %22 = load i8*, i8** %err.addr, align 8
  %23 = call i8* @nish_read_file_or_null(i8* %22)
  store i8* %23, i8** %diagnostic.addr, align 8
  %24 = load i8*, i8** %captured.addr, align 8
  %25 = icmp eq i8* %24, null
  br i1 %25, label %lor.end, label %lor.rhs

lor.rhs:
  %26 = load i8*, i8** %diagnostic.addr, align 8
  %27 = icmp eq i8* %26, null
  br label %lor.end

lor.end:
  %28 = phi i1 [ true, %entry ], [ %27, %lor.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [17 x i8] }* @.str.7 to i8*))
  ret i32 1

if.end:
  %29 = load i32, i32* %status.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*))
  %32 = load i8*, i8** %captured.addr, align 8
  %33 = bitcast i8* %32 to i64*
  %34 = load i64, i64* %33, align 8
  %35 = load i8*, i8** %captured.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %38, i32 1)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok

ovf.ok:
  %42 = sext i32 %40 to i64
  %43 = call i64 @llvm.smin.i64(i64 %42, i64 %34)
  %44 = call i64 @llvm.smax.i64(i64 %43, i64 0)
  %45 = call i64 @llvm.smin.i64(i64 0, i64 %44)
  %46 = call i64 @llvm.smax.i64(i64 0, i64 %44)
  %47 = sub i64 %46, %45
  %48 = getelementptr inbounds i8, i8* %32, i64 8
  %49 = getelementptr inbounds i8, i8* %48, i64 %45
  %50 = call i8* @nish_str_new(i8* %49, i64 %47)
  %51 = call i8* @nish_str_concat(i8* %31, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  %53 = load i8*, i8** %diagnostic.addr, align 8
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = load i8*, i8** %diagnostic.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %59, i32 1)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %63 = sext i32 %61 to i64
  %64 = call i64 @llvm.smin.i64(i64 %63, i64 %55)
  %65 = call i64 @llvm.smax.i64(i64 %64, i64 0)
  %66 = call i64 @llvm.smin.i64(i64 0, i64 %65)
  %67 = call i64 @llvm.smax.i64(i64 0, i64 %65)
  %68 = sub i64 %67, %66
  %69 = getelementptr inbounds i8, i8* %53, i64 8
  %70 = getelementptr inbounds i8, i8* %69, i64 %66
  %71 = call i8* @nish_str_new(i8* %70, i64 %68)
  %72 = call i8* @nish_str_concat(i8* %52, i8* %71)
  call void @nish_print(i8* %72)
  %73 = call i8* @nish_alloc_struct(i64 24)
  %74 = bitcast i8* %73 to %struct.nish_array*
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  store i64 3, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 1
  store i64 3, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = call i8* @nish_alloc_struct(i64 24)
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  store i8* %77, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %77 to i8**
  %80 = getelementptr inbounds i8*, i8** %79, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %80, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = getelementptr inbounds i8*, i8** %79, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8** %81, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %82 = getelementptr inbounds i8*, i8** %79, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.10 to i8*), i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = load i8*, i8** %out.addr, align 8
  %84 = load i8*, i8** %err.addr, align 8
  %85 = call i32 @nish_spawn_to(%struct.nish_array* %74, i8* %83, i8* %84)
  %86 = load i8*, i8** %out.addr, align 8
  %87 = call i8* @nish_read_file_or_null(i8* %86)
  store i8* %87, i8** %again.addr, align 8
  %88 = load i8*, i8** %again.addr, align 8
  %89 = icmp eq i8* %88, null
  br i1 %89, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_print(i8* bitcast ({ i64, [23 x i8] }* @.str.11 to i8*))
  ret i32 1

if.end.1:
  %90 = load i8*, i8** %again.addr, align 8
  %91 = bitcast i8* %90 to i64*
  %92 = load i64, i64* %91, align 8
  %93 = load i8*, i8** %again.addr, align 8
  %94 = bitcast i8* %93 to i64*
  %95 = load i64, i64* %94, align 8
  %96 = trunc i64 %95 to i32
  %97 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %96, i32 1)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %100 = sext i32 %98 to i64
  %101 = call i64 @llvm.smin.i64(i64 %100, i64 %92)
  %102 = call i64 @llvm.smax.i64(i64 %101, i64 0)
  %103 = call i64 @llvm.smin.i64(i64 0, i64 %102)
  %104 = call i64 @llvm.smax.i64(i64 0, i64 %102)
  %105 = sub i64 %104, %103
  %106 = getelementptr inbounds i8, i8* %90, i64 8
  %107 = getelementptr inbounds i8, i8* %106, i64 %103
  %108 = call i8* @nish_str_new(i8* %107, i64 %105)
  %109 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* %108)
  call void @nish_print(i8* %109)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
