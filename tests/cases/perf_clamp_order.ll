@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"a [\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"b [\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"c [\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"d [\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0

define internal noundef i32 @width() #0 {
entry:
  ret i32 6
}

define noundef i32 @nish_main() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  %a.addr = alloca i8*, align 8
  %m.addr = alloca i32, align 4
  %pick.addr = alloca i1, align 1
  %b.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %c.addr = alloca i8*, align 8
  %j.addr = alloca i32, align 4
  %d.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = sub nsw i32 0, 3
  store i32 %0, i32* %k.addr, align 4
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = sext i32 %4 to i64
  %6 = call i64 @llvm.smin.i64(i64 %5, i64 %3)
  %7 = call i64 @llvm.smax.i64(i64 %6, i64 0)
  %8 = load i8*, i8** %s.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %k.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = call i64 @llvm.smin.i64(i64 %12, i64 %3)
  %14 = call i64 @llvm.smax.i64(i64 %13, i64 0)
  %15 = call i64 @llvm.smin.i64(i64 %7, i64 %14)
  %16 = call i64 @llvm.smax.i64(i64 %7, i64 %14)
  %17 = sub i64 %16, %15
  %18 = getelementptr inbounds i8, i8* %1, i64 8
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = call i8* @nish_str_new(i8* %19, i64 %17)
  store i8* %20, i8** %a.addr, align 8
  %21 = load i8*, i8** %a.addr, align 8
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %24 = load i8*, i8** %a.addr, align 8
  %25 = bitcast i8* %24 to i64*
  %26 = load i64, i64* %25, align 8
  %27 = trunc i64 %26 to i32
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %23, i8* %28)
  call void @nish_print(i8* %29)
  %30 = sub nsw i32 0, 4
  store i32 %30, i32* %m.addr, align 4
  store i1 true, i1* %pick.addr, align 1
  %31 = load i8*, i8** %s.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = load i32, i32* %m.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = call i64 @llvm.smin.i64(i64 %35, i64 %33)
  %37 = call i64 @llvm.smax.i64(i64 %36, i64 0)
  %38 = load i1, i1* %pick.addr, align 1
  br i1 %38, label %cond.true, label %cond.false

cond.true:
  %39 = load i8*, i8** %s.addr, align 8
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = trunc i64 %41 to i32
  store i32 %42, i32* %m.addr, align 4
  br label %cond.end

cond.false:
  %43 = load i8*, i8** %s.addr, align 8
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  store i32 %46, i32* %m.addr, align 4
  br label %cond.end

cond.end:
  %47 = phi i32 [ %42, %cond.true ], [ %46, %cond.false ]
  %48 = sext i32 %47 to i64
  %49 = call i64 @llvm.smin.i64(i64 %48, i64 %33)
  %50 = call i64 @llvm.smax.i64(i64 %49, i64 0)
  %51 = call i64 @llvm.smin.i64(i64 %37, i64 %50)
  %52 = call i64 @llvm.smax.i64(i64 %37, i64 %50)
  %53 = sub i64 %52, %51
  %54 = getelementptr inbounds i8, i8* %31, i64 8
  %55 = getelementptr inbounds i8, i8* %54, i64 %51
  %56 = call i8* @nish_str_new(i8* %55, i64 %53)
  store i8* %56, i8** %b.addr, align 8
  %57 = load i8*, i8** %b.addr, align 8
  %58 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %60 = load i8*, i8** %b.addr, align 8
  %61 = bitcast i8* %60 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = trunc i64 %62 to i32
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %59, i8* %64)
  call void @nish_print(i8* %65)
  %66 = load i8*, i8** %s.addr, align 8
  %67 = bitcast i8* %66 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = trunc i64 %68 to i32
  store i32 %69, i32* %n.addr, align 4
  %70 = load i8*, i8** %s.addr, align 8
  %71 = bitcast i8* %70 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = load i32, i32* %n.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = call i32 @width()
  %76 = sext i32 %75 to i64
  %77 = call i64 @llvm.smin.i64(i64 %76, i64 %72)
  %78 = call i64 @llvm.smax.i64(i64 %77, i64 0)
  %79 = call i64 @llvm.smin.i64(i64 %74, i64 %78)
  %80 = call i64 @llvm.smax.i64(i64 %74, i64 %78)
  %81 = sub i64 %80, %79
  %82 = getelementptr inbounds i8, i8* %70, i64 8
  %83 = getelementptr inbounds i8, i8* %82, i64 %79
  %84 = call i8* @nish_str_new(i8* %83, i64 %81)
  store i8* %84, i8** %c.addr, align 8
  %85 = load i8*, i8** %c.addr, align 8
  %86 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %88 = load i8*, i8** %c.addr, align 8
  %89 = bitcast i8* %88 to i64*
  %90 = load i64, i64* %89, align 8
  %91 = trunc i64 %90 to i32
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %87, i8* %92)
  call void @nish_print(i8* %93)
  %94 = sub nsw i32 0, 1
  store i32 %94, i32* %j.addr, align 4
  %95 = load i8*, i8** %s.addr, align 8
  %96 = bitcast i8* %95 to i64*
  %97 = load i64, i64* %96, align 8
  %98 = load i8*, i8** %s.addr, align 8
  %99 = bitcast i8* %98 to i64*
  %100 = load i64, i64* %99, align 8
  %101 = trunc i64 %100 to i32
  store i32 %101, i32* %j.addr, align 4
  %102 = sub nsw i32 %101, 6
  %103 = sext i32 %102 to i64
  %104 = call i64 @llvm.smin.i64(i64 %103, i64 %97)
  %105 = call i64 @llvm.smax.i64(i64 %104, i64 0)
  %106 = call i64 @llvm.smin.i64(i64 0, i64 %105)
  %107 = call i64 @llvm.smax.i64(i64 0, i64 %105)
  %108 = sub i64 %107, %106
  %109 = getelementptr inbounds i8, i8* %95, i64 8
  %110 = getelementptr inbounds i8, i8* %109, i64 %106
  %111 = call i8* @nish_str_new(i8* %110, i64 %108)
  store i8* %111, i8** %d.addr, align 8
  %112 = load i8*, i8** %d.addr, align 8
  %113 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8* %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %115 = load i8*, i8** %d.addr, align 8
  %116 = bitcast i8* %115 to i64*
  %117 = load i64, i64* %116, align 8
  %118 = trunc i64 %117 to i32
  %119 = call i8* @nish_str_from_i32(i32 %118)
  %120 = call i8* @nish_str_concat(i8* %114, i8* %119)
  %121 = call i8* @nish_str_concat(i8* %120, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %122 = load i32, i32* %j.addr, align 4
  %123 = call i8* @nish_str_from_i32(i32 %122)
  %124 = call i8* @nish_str_concat(i8* %121, i8* %123)
  call void @nish_print(i8* %124)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
