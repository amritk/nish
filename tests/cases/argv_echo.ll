%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" argument(s)\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c" (\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" bytes)\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"sum of the numeric ones: \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

define internal noundef i32 @count() #0 {
entry:
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = trunc i64 %2 to i32
  %4 = sub nsw i32 %3, 1
  ret i32 %4
}

define internal noundef nonnull align 8 i8* @argument(i32 noundef %i) #1 {
entry:
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 %1
  %9 = load i8*, i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  ret i8* %9
}

define noundef i32 @nish_main() #1 {
entry:
  %args.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %arg.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  store %struct.nish_array* %0, %struct.nish_array** %args.addr, align 8
  %1 = call i32 @count()
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  call void @nish_print(i8* %3)
  store i32 1, i32* %i.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %args.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %6 to i32
  %11 = icmp slt i32 %9, %10
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %15 = load i32, i32* %i.addr, align 4
  %16 = call i8* @argument(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %19 = load i32, i32* %i.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = icmp ult i64 %20, %6
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %20, i64 %6)
  unreachable

bounds.ok:
  %22 = bitcast i8* %8 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %20
  %24 = load i8*, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %25 = bitcast i8* %24 to i64*
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %18, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  call void @nish_print(i8* %30)
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %sum.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %args.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4
  %37 = icmp ult i64 %34, %36
  br i1 %37, label %forof.body, label %forof.end

forof.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 %34
  %42 = load i8*, i8** %41, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  store i8* %42, i8** %arg.addr, align 8
  %43 = load i32, i32* %sum.addr, align 4
  %44 = load i8*, i8** %arg.addr, align 8
  %45 = call double @nish_parse_number(i8* %44, i32 2)
  %46 = call i32 @llvm.fptosi.sat.i32.f64(double %45)
  %47 = add nsw i32 %43, %46
  store i32 %47, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %48 = load i64, i64* %forof.idx, align 8
  %49 = add i64 %48, 1
  store i64 %49, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %50 = load i32, i32* %sum.addr, align 4
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*), i8* %51)
  call void @nish_print(i8* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %args.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4
  %56 = trunc i64 %55 to i32
  %57 = icmp sgt i32 %56, 1
  br i1 %57, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %58 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %58
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element ptr", !6, i64 0}
!8 = !{!7, !7, i64 0}
