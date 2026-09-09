%struct.amrit_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"world\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"goodbye\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare noundef nonnull align 8 i8* @amrit_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_array_grow(%struct.amrit_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @amrit_panic_index(i64 noundef, i64 noundef) #3

define internal noundef nonnull align 8 i8* @join(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %words) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %words, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %words, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3
  store i8* %8, i8** %w.addr, align 8
  %9 = load i8*, i8** %out.addr, align 8
  %10 = load i8*, i8** %w.addr, align 8
  %11 = call i8* @amrit_str_concat(i8* %9, i8* %10)
  store i8* %11, i8** %out.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i8*, i8** %out.addr, align 8
  ret i8* %14
}

define noundef i32 @amrit_main() #1 {
entry:
  %words.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %words.addr, align 8
  %8 = load %struct.amrit_array*, %struct.amrit_array** %words.addr, align 8
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @amrit_array_grow(%struct.amrit_array* %8, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8** %17, align 8, !alias.scope !4, !noalias !3
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4
  %19 = trunc i64 %18 to i32
  %20 = load %struct.amrit_array*, %struct.amrit_array** %words.addr, align 8
  %21 = call i64 @amrit_arena_mark()
  %22 = call i8* @join(%struct.amrit_array* %20)
  %23 = call i8* @amrit_arena_keep(i64 %21, i8* %22)
  call void @amrit_print(i8* %23)
  %24 = load %struct.amrit_array*, %struct.amrit_array** %words.addr, align 8
  %25 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4
  %27 = icmp ult i64 3, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 3, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4
  %30 = bitcast i8* %29 to i8**
  %31 = getelementptr inbounds i8*, i8** %30, i64 3
  %32 = load i8*, i8** %31, align 8, !alias.scope !4, !noalias !3
  %33 = call zeroext i1 @amrit_str_eq(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %34 = select i1 %33, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @amrit_print(i8* %34)
  %35 = load %struct.amrit_array*, %struct.amrit_array** %words.addr, align 8
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4
  %38 = icmp ult i64 0, %37
  br i1 %38, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 0, i64 %37)
  unreachable

bounds.ok.1:
  %39 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %35, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8** %42, align 8, !alias.scope !4, !noalias !3
  %43 = load %struct.amrit_array*, %struct.amrit_array** %words.addr, align 8
  %44 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4
  %46 = icmp ult i64 0, %45
  br i1 %46, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 0, i64 %45)
  unreachable

bounds.ok.2:
  %47 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %43, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4
  %49 = bitcast i8* %48 to i8**
  %50 = getelementptr inbounds i8*, i8** %49, i64 0
  %51 = load i8*, i8** %50, align 8, !alias.scope !4, !noalias !3
  call void @amrit_print(i8* %51)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
