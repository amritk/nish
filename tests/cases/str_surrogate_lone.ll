@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\ED\A0\BD\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\ED\B8\80\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"\ED\B8\80\ED\A0\BD\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"\ED\A0\BDx\ED\B8\80\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\ED\A0\BDA\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\F0\9F\98\80\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define noundef i32 @nish_main() #0 {
entry:
  %high.addr = alloca i8*, align 8
  %low.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %high.addr, align 8
  %0 = load i8*, i8** %high.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %6 = load i8*, i8** %high.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = icmp ult i64 0, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds i8, i8* %6, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 0
  %12 = load i8, i8* %11, align 1
  %13 = zext i8 %12 to i32
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %5, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %17 = load i8*, i8** %high.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = icmp ult i64 1, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds i8, i8* %17, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 1
  %23 = load i8, i8* %22, align 1
  %24 = zext i8 %23 to i32
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %16, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %28 = load i8*, i8** %high.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = icmp ult i64 2, %30
  br i1 %31, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %30)
  unreachable

bounds.ok.2:
  %32 = getelementptr inbounds i8, i8* %28, i64 8
  %33 = getelementptr inbounds i8, i8* %32, i64 2
  %34 = load i8, i8* %33, align 1
  %35 = zext i8 %34 to i32
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %27, i8* %36)
  call void @nish_print(i8* %37)
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %low.addr, align 8
  %38 = load i8*, i8** %low.addr, align 8
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = trunc i64 %40 to i32
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %44 = load i8*, i8** %low.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.3:
  %48 = getelementptr inbounds i8, i8* %44, i64 8
  %49 = getelementptr inbounds i8, i8* %48, i64 0
  %50 = load i8, i8* %49, align 1
  %51 = zext i8 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* %43, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %55 = load i8*, i8** %low.addr, align 8
  %56 = bitcast i8* %55 to i64*
  %57 = load i64, i64* %56, align 8
  %58 = icmp ult i64 1, %57
  br i1 %58, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %57)
  unreachable

bounds.ok.4:
  %59 = getelementptr inbounds i8, i8* %55, i64 8
  %60 = getelementptr inbounds i8, i8* %59, i64 1
  %61 = load i8, i8* %60, align 1
  %62 = zext i8 %61 to i32
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %54, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %66 = load i8*, i8** %low.addr, align 8
  %67 = bitcast i8* %66 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = icmp ult i64 2, %68
  br i1 %69, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %68)
  unreachable

bounds.ok.5:
  %70 = getelementptr inbounds i8, i8* %66, i64 8
  %71 = getelementptr inbounds i8, i8* %70, i64 2
  %72 = load i8, i8* %71, align 1
  %73 = zext i8 %72 to i32
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %65, i8* %74)
  call void @nish_print(i8* %75)
  %76 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*) to i64*
  %77 = load i64, i64* %76, align 8
  %78 = trunc i64 %77 to i32
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %81 = bitcast i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*) to i64*
  %82 = load i64, i64* %81, align 8
  %83 = trunc i64 %82 to i32
  %84 = call i8* @nish_str_from_i32(i32 %83)
  %85 = call i8* @nish_str_concat(i8* %80, i8* %84)
  %86 = call i8* @nish_str_concat(i8* %85, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %87 = bitcast i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*) to i64*
  %88 = load i64, i64* %87, align 8
  %89 = trunc i64 %88 to i32
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %86, i8* %90)
  call void @nish_print(i8* %91)
  %92 = load i8*, i8** %high.addr, align 8
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %94 = call zeroext i1 @nish_str_eq(i8* %93, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*))
  %95 = select i1 %94, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %97 = load i8*, i8** %high.addr, align 8
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %99 = bitcast i8* %98 to i64*
  %100 = load i64, i64* %99, align 8
  %101 = trunc i64 %100 to i32
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %96, i8* %102)
  call void @nish_print(i8* %103)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
