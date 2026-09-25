%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"list \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"build/mem_readdir_scope\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/only.txt\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"unreadable\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"ZZZZZZZZ\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"filled \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"first: \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef align 8 %struct.nish_array* @listOf(i8* noundef nonnull noalias readonly align 8 nocapture %dir) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %dir)
  store i8* %0, i8** %label.addr, align 8
  %1 = load i8*, i8** %label.addr, align 8
  call void @nish_print(i8* %1)
  %2 = call %struct.nish_array* @nish_readdir(i8* %dir)
  ret %struct.nish_array* %2
}

define noundef i32 @nish_main() #1 {
entry:
  %dir.addr = alloca i8*, align 8
  %entries.addr = alloca %struct.nish_array*, align 8
  %filler.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store i8* bitcast ({ i64, [24 x i8] }* @.str.2 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*))
  call void @nish_write_file(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %5 = load i8*, i8** %dir.addr, align 8
  %6 = call %struct.nish_array* @listOf(i8* %5)
  store %struct.nish_array* %6, %struct.nish_array** %entries.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %8 = icmp eq %struct.nish_array* %7, null
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [11 x i8] }* @.str.5 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.6 to i8*), i8** %filler.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 40
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i8*, i8** %filler.addr, align 8
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [9 x i8] }* @.str.7 to i8*))
  store i8* %12, i8** %filler.addr, align 8
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i8*, i8** %filler.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 0
  %29 = load i8*, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i8* %29)
  call void @nish_print(i8* %30)
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
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element ptr", !6, i64 0}
!8 = !{!7, !7, i64 0}
