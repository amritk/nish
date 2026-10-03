%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/cg_sec_readdir_pass\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/alpha_first_entry\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"unset\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [97 x i8] } { i64 96, [97 x i8] c"QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"never\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"alpha_first_entry\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"intact\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"corrupted\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define noundef i32 @test() #0 {
entry:
  %dir.addr = alloca i8*, align 8
  %keep.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %pad.addr = alloca i8*, align 8
  %junk.addr = alloca i8*, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [19 x i8] }* @.str.2 to i8*))
  call void @nish_write_file(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i8** %keep.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 3
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp eq i32 %7, 0
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i8* [ bitcast ({ i64, [1 x i8] }* @.str.5 to i8*), %cond.true ], [ bitcast ({ i64, [97 x i8] }* @.str.6 to i8*), %cond.false ]
  store i8* %9, i8** %pad.addr, align 8
  %10 = load i8*, i8** %pad.addr, align 8
  %11 = load i32, i32* %i.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  store i8* %13, i8** %junk.addr, align 8
  %14 = load i8*, i8** %dir.addr, align 8
  %15 = call %struct.nish_array* @nish_readdir(i8* %14)
  store %struct.nish_array* %15, %struct.nish_array** %names.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %17 = icmp ne %struct.nish_array* %16, null
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %i.addr, align 4
  %19 = icmp eq i32 %18, 0
  br label %land.end

land.end:
  %20 = phi i1 [ false, %cond.end ], [ %19, %land.rhs ]
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 0
  %29 = load i8*, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store i8* %29, i8** %keep.addr, align 8
  br label %if.end

if.end:
  %30 = load i8*, i8** %junk.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = trunc i64 %32 to i32
  %34 = icmp eq i32 %33, 1000
  br i1 %34, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*))
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = load i8*, i8** %keep.addr, align 8
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  %41 = call i8* @nish_str_from_i32(i32 %40)
  call void @nish_print(i8* %41)
  %42 = load i8*, i8** %keep.addr, align 8
  %43 = call zeroext i1 @nish_str_eq(i8* %42, i8* bitcast ({ i64, [18 x i8] }* @.str.8 to i8*))
  br i1 %43, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %44 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.9 to i8*), %cond.true.1 ], [ bitcast ({ i64, [10 x i8] }* @.str.10 to i8*), %cond.false.1 ]
  call void @nish_print(i8* %44)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }

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
