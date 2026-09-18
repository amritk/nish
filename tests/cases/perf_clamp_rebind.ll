@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"a [\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"b [\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #2
declare i64 @llvm.smax.i64(i64, i64) #2

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %long.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %a.addr = alloca i8*, align 8
  %u.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*), i8** %long.addr, align 8
  store i32 0, i32* %n.addr, align 4
  %0 = load i8*, i8** %s.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = load i8*, i8** %long.addr, align 8
  store i8* %3, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sgt i32 %6, 0
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  %8 = load i8*, i8** %s.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %n.addr, align 4
  br label %cond.end

cond.false:
  %12 = load i8*, i8** %s.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  store i32 %15, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %16 = phi i32 [ %11, %cond.true ], [ %15, %cond.false ]
  %17 = sext i32 %16 to i64
  %18 = call i64 @llvm.smin.i64(i64 %17, i64 %2)
  %19 = call i64 @llvm.smax.i64(i64 %18, i64 0)
  %20 = load i32, i32* %n.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = call i64 @llvm.smin.i64(i64 %21, i64 %2)
  %23 = call i64 @llvm.smax.i64(i64 %22, i64 0)
  %24 = call i64 @llvm.smin.i64(i64 %19, i64 %23)
  %25 = call i64 @llvm.smax.i64(i64 %19, i64 %23)
  %26 = sub i64 %25, %24
  %27 = getelementptr inbounds i8, i8* %0, i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 %24
  %29 = call i8* @nish_str_new(i8* %28, i64 %26)
  store i8* %29, i8** %a.addr, align 8
  %30 = load i8*, i8** %a.addr, align 8
  %31 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*))
  %33 = load i8*, i8** %a.addr, align 8
  %34 = bitcast i8* %33 to i64*
  %35 = load i64, i64* %34, align 8
  %36 = trunc i64 %35 to i32
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %32, i8* %37)
  call void @nish_print(i8* %38)
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %u.addr, align 8
  %39 = load i8*, i8** %u.addr, align 8
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = load i8*, i8** %long.addr, align 8
  store i8* %42, i8** %u.addr, align 8
  %43 = bitcast i8* %42 to i64*
  %44 = load i64, i64* %43, align 8
  %45 = trunc i64 %44 to i32
  %46 = sext i32 %45 to i64
  %47 = call i64 @llvm.smin.i64(i64 %46, i64 %41)
  %48 = call i64 @llvm.smax.i64(i64 %47, i64 0)
  %49 = call i64 @llvm.smin.i64(i64 0, i64 %48)
  %50 = call i64 @llvm.smax.i64(i64 0, i64 %48)
  %51 = sub i64 %50, %49
  %52 = getelementptr inbounds i8, i8* %39, i64 8
  %53 = getelementptr inbounds i8, i8* %52, i64 %49
  %54 = call i8* @nish_str_new(i8* %53, i64 %51)
  store i8* %54, i8** %b.addr, align 8
  %55 = load i8*, i8** %b.addr, align 8
  %56 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*))
  %58 = load i8*, i8** %b.addr, align 8
  %59 = bitcast i8* %58 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = trunc i64 %60 to i32
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %57, i8* %62)
  call void @nish_print(i8* %63)
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
attributes #2 = { nounwind willreturn readnone }
