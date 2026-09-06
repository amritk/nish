%struct.sts_array = type { i64, i64, i8* }

@sts_argv = external global %struct.sts_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" argument(s)\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c" (\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" bytes)\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"sum of the numeric ones: \00" }, align 8

declare void @sts_free_arena() #2
declare noundef i64 @sts_arena_mark() #2
declare void @sts_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare void @sts_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @sts_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

define noundef i32 @count() #0 {
entry:
  %0 = load %struct.sts_array*, %struct.sts_array** @sts_argv, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = sub i32 %3, 1
  ret i32 %4
}

define noundef nonnull align 8 i8* @argument(i32 noundef %i) #1 {
entry:
  %0 = load %struct.sts_array*, %struct.sts_array** @sts_argv, align 8
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %0, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 %1
  %9 = load i8*, i8** %8, align 8
  ret i8* %9
}

define noundef i32 @sts_main() #1 {
entry:
  %args.addr = alloca %struct.sts_array*, align 8
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %arg.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = load %struct.sts_array*, %struct.sts_array** @sts_argv, align 8
  store %struct.sts_array* %0, %struct.sts_array** %args.addr, align 8
  %1 = call i32 @count()
  %2 = call i8* @sts_str_from_i32(i32 %1)
  %3 = call i8* @sts_str_concat(i8* %2, i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  call void @sts_print(i8* %3)
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load %struct.sts_array*, %struct.sts_array** %args.addr, align 8
  %6 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %4, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = call i8* @sts_str_from_i32(i32 %10)
  %12 = call i8* @sts_str_concat(i8* %11, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i8* @argument(i32 %13)
  %15 = call i8* @sts_str_concat(i8* %12, i8* %14)
  %16 = call i8* @sts_str_concat(i8* %15, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %17 = load %struct.sts_array*, %struct.sts_array** %args.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %17, i64 0, i32 0
  %21 = load i64, i64* %20, align 8
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %17, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = trunc i64 %29 to i32
  %31 = call i8* @sts_str_from_i32(i32 %30)
  %32 = call i8* @sts_str_concat(i8* %16, i8* %31)
  %33 = call i8* @sts_str_concat(i8* %32, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  call void @sts_print(i8* %33)
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %sum.addr, align 4
  %36 = load %struct.sts_array*, %struct.sts_array** %args.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %37 = load i64, i64* %forof.idx, align 8
  %38 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %36, i64 0, i32 0
  %39 = load i64, i64* %38, align 8
  %40 = icmp ult i64 %37, %39
  br i1 %40, label %forof.body, label %forof.end

forof.body:
  %41 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %36, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8
  %43 = bitcast i8* %42 to i8**
  %44 = getelementptr inbounds i8*, i8** %43, i64 %37
  %45 = load i8*, i8** %44, align 8
  store i8* %45, i8** %arg.addr, align 8
  %46 = load i32, i32* %sum.addr, align 4
  %47 = load i8*, i8** %arg.addr, align 8
  %48 = call double @sts_parse_number(i8* %47, i32 2)
  %49 = call i32 @llvm.fptosi.sat.i32.f64(double %48)
  %50 = add i32 %46, %49
  store i32 %50, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %51 = load i64, i64* %forof.idx, align 8
  %52 = add i64 %51, 1
  store i64 %52, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %53 = load i32, i32* %sum.addr, align 4
  %54 = call i8* @sts_str_from_i32(i32 %53)
  %55 = call i8* @sts_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*), i8* %54)
  call void @sts_print(i8* %55)
  %56 = load %struct.sts_array*, %struct.sts_array** %args.addr, align 8
  %57 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = icmp sgt i32 %59, 1
  br i1 %60, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %61 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %61
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @sts_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
