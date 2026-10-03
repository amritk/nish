%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/cg_sec_readdir_return\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/alpha_first_entry\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/beta_second_entry\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [63 x i8] } { i64 62, [63 x i8] c"QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"alpha_first_entry\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"intact\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"corrupted\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

define internal noundef nonnull align 8 i8* @first(i8* noundef nonnull noalias readonly align 8 nocapture %d) #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish_readdir(i8* %d)
  store %struct.nish_array* %0, %struct.nish_array** %names.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = icmp eq i32 %6, 0
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)

if.end:
  %9 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 0
  %17 = load i8*, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8* %17
}

define noundef i32 @test() #0 {
entry:
  %dir.addr = alloca i8*, align 8
  %a.addr = alloca i8*, align 8
  %q.addr = alloca i8*, align 8
  %junk.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [19 x i8] }* @.str.3 to i8*))
  call void @nish_write_file(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %5 = load i8*, i8** %dir.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [19 x i8] }* @.str.5 to i8*))
  call void @nish_write_file(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %7 = load i8*, i8** %dir.addr, align 8
  %8 = call i64 @nish_arena_mark()
  %9 = call i8* @first(i8* %7)
  %10 = call i8* @nish_arena_keep(i64 %8, i8* %9)
  store i8* %10, i8** %a.addr, align 8
  store i8* bitcast ({ i64, [63 x i8] }* @.str.7 to i8*), i8** %q.addr, align 8
  %11 = load i8*, i8** %q.addr, align 8
  %12 = load i8*, i8** %q.addr, align 8
  %13 = call i8* @nish_str_concat(i8* %11, i8* %12)
  %14 = load i8*, i8** %q.addr, align 8
  %15 = call i8* @nish_str_concat(i8* %13, i8* %14)
  %16 = load i8*, i8** %q.addr, align 8
  %17 = call i8* @nish_str_concat(i8* %15, i8* %16)
  %18 = load i8*, i8** %q.addr, align 8
  %19 = call i8* @nish_str_concat(i8* %17, i8* %18)
  %20 = load i8*, i8** %q.addr, align 8
  %21 = call i8* @nish_str_concat(i8* %19, i8* %20)
  %22 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i32 2)
  %23 = call i32 @llvm.fptosi.sat.i32.f64(double %22)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %21, i8* %24)
  store i8* %25, i8** %junk.addr, align 8
  %26 = load i8*, i8** %a.addr, align 8
  %27 = call zeroext i1 @nish_str_eq(i8* %26, i8* bitcast ({ i64, [18 x i8] }* @.str.9 to i8*))
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %28 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), %cond.true ], [ bitcast ({ i64, [10 x i8] }* @.str.11 to i8*), %cond.false ]
  call void @nish_print(i8* %28)
  %29 = load i8*, i8** %a.addr, align 8
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = trunc i64 %31 to i32
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %35 = load i8*, i8** %junk.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %34, i8* %39)
  call void @nish_print(i8* %40)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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
