@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello world\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"a [\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"b [\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"c [\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"d [\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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
  store i32 -3, i32* %k.addr, align 4
  %0 = load i8*, i8** %s.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = load i32, i32* %k.addr, align 4
  %4 = sext i32 %3 to i64
  %5 = call i64 @llvm.smin.i64(i64 %4, i64 %2)
  %6 = call i64 @llvm.smax.i64(i64 %5, i64 0)
  %7 = load i8*, i8** %s.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  store i32 %10, i32* %k.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = call i64 @llvm.smin.i64(i64 %11, i64 %2)
  %13 = call i64 @llvm.smax.i64(i64 %12, i64 0)
  %14 = call i64 @llvm.smin.i64(i64 %6, i64 %13)
  %15 = call i64 @llvm.smax.i64(i64 %6, i64 %13)
  %16 = sub i64 %15, %14
  %17 = getelementptr inbounds i8, i8* %0, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = call i8* @nish_str_new(i8* %18, i64 %16)
  store i8* %19, i8** %a.addr, align 8
  %20 = load i8*, i8** %a.addr, align 8
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %23 = load i8*, i8** %a.addr, align 8
  %24 = bitcast i8* %23 to i64*
  %25 = load i64, i64* %24, align 8
  %26 = trunc i64 %25 to i32
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %22, i8* %27)
  call void @nish_print(i8* %28)
  store i32 -4, i32* %m.addr, align 4
  store i1 true, i1* %pick.addr, align 1
  %29 = load i8*, i8** %s.addr, align 8
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = load i32, i32* %m.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = call i64 @llvm.smin.i64(i64 %33, i64 %31)
  %35 = call i64 @llvm.smax.i64(i64 %34, i64 0)
  %36 = load i1, i1* %pick.addr, align 1
  br i1 %36, label %cond.true, label %cond.false

cond.true:
  %37 = load i8*, i8** %s.addr, align 8
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  store i32 %40, i32* %m.addr, align 4
  br label %cond.end

cond.false:
  %41 = load i8*, i8** %s.addr, align 8
  %42 = bitcast i8* %41 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = trunc i64 %43 to i32
  store i32 %44, i32* %m.addr, align 4
  br label %cond.end

cond.end:
  %45 = phi i32 [ %40, %cond.true ], [ %44, %cond.false ]
  %46 = sext i32 %45 to i64
  %47 = call i64 @llvm.smin.i64(i64 %46, i64 %31)
  %48 = call i64 @llvm.smax.i64(i64 %47, i64 0)
  %49 = call i64 @llvm.smin.i64(i64 %35, i64 %48)
  %50 = call i64 @llvm.smax.i64(i64 %35, i64 %48)
  %51 = sub i64 %50, %49
  %52 = getelementptr inbounds i8, i8* %29, i64 8
  %53 = getelementptr inbounds i8, i8* %52, i64 %49
  %54 = call i8* @nish_str_new(i8* %53, i64 %51)
  store i8* %54, i8** %b.addr, align 8
  %55 = load i8*, i8** %b.addr, align 8
  %56 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %58 = load i8*, i8** %b.addr, align 8
  %59 = bitcast i8* %58 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = trunc i64 %60 to i32
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %57, i8* %62)
  call void @nish_print(i8* %63)
  %64 = load i8*, i8** %s.addr, align 8
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = trunc i64 %66 to i32
  store i32 %67, i32* %n.addr, align 4
  %68 = load i8*, i8** %s.addr, align 8
  %69 = bitcast i8* %68 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = load i32, i32* %n.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = call i32 @width()
  %74 = sext i32 %73 to i64
  %75 = call i64 @llvm.smin.i64(i64 %74, i64 %70)
  %76 = call i64 @llvm.smax.i64(i64 %75, i64 0)
  %77 = call i64 @llvm.smin.i64(i64 %72, i64 %76)
  %78 = call i64 @llvm.smax.i64(i64 %72, i64 %76)
  %79 = sub i64 %78, %77
  %80 = getelementptr inbounds i8, i8* %68, i64 8
  %81 = getelementptr inbounds i8, i8* %80, i64 %77
  %82 = call i8* @nish_str_new(i8* %81, i64 %79)
  store i8* %82, i8** %c.addr, align 8
  %83 = load i8*, i8** %c.addr, align 8
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8* %83)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %86 = load i8*, i8** %c.addr, align 8
  %87 = bitcast i8* %86 to i64*
  %88 = load i64, i64* %87, align 8
  %89 = trunc i64 %88 to i32
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %85, i8* %90)
  call void @nish_print(i8* %91)
  store i32 -1, i32* %j.addr, align 4
  %92 = load i8*, i8** %s.addr, align 8
  %93 = bitcast i8* %92 to i64*
  %94 = load i64, i64* %93, align 8
  %95 = load i8*, i8** %s.addr, align 8
  %96 = bitcast i8* %95 to i64*
  %97 = load i64, i64* %96, align 8
  %98 = trunc i64 %97 to i32
  store i32 %98, i32* %j.addr, align 4
  %99 = sub nsw i32 %98, 6
  %100 = sext i32 %99 to i64
  %101 = call i64 @llvm.smin.i64(i64 %100, i64 %94)
  %102 = call i64 @llvm.smax.i64(i64 %101, i64 0)
  %103 = call i64 @llvm.smin.i64(i64 0, i64 %102)
  %104 = call i64 @llvm.smax.i64(i64 0, i64 %102)
  %105 = sub i64 %104, %103
  %106 = getelementptr inbounds i8, i8* %92, i64 8
  %107 = getelementptr inbounds i8, i8* %106, i64 %103
  %108 = call i8* @nish_str_new(i8* %107, i64 %105)
  store i8* %108, i8** %d.addr, align 8
  %109 = load i8*, i8** %d.addr, align 8
  %110 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8* %109)
  %111 = call i8* @nish_str_concat(i8* %110, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %112 = load i8*, i8** %d.addr, align 8
  %113 = bitcast i8* %112 to i64*
  %114 = load i64, i64* %113, align 8
  %115 = trunc i64 %114 to i32
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %111, i8* %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %119 = load i32, i32* %j.addr, align 4
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* %118, i8* %120)
  call void @nish_print(i8* %121)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
