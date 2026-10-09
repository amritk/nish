@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcabc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"bc\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"a,b,,c,\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"aaaa\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"aa\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5
declare i64 @llvm.fptosi.sat.i64.f64(double) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare i64 @llvm.umin.i64(i64, i64) #5

define internal noundef i32 @find(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub, i32 noundef %from) #0 {
entry:
  %0 = sext i32 %from to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = call i64 @llvm.smin.i64(i64 %0, i64 %2)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %4)
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @findF(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub, double noundef %from) #0 {
entry:
  %0 = call i64 @llvm.fptosi.sat.i64.f64(double %from)
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = call i64 @llvm.smin.i64(i64 %0, i64 %2)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %4)
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @findU(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub, i64 noundef %from) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @llvm.umin.i64(i64 %from, i64 %1)
  %3 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %2)
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef i32 @count(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub) #1 {
entry:
  %n.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 0)
  %1 = trunc i64 %0 to i32
  store i32 %1, i32* %at.addr, align 4
  br label %while.cond

while.cond:
  %2 = load i32, i32* %at.addr, align 4
  %3 = icmp sge i32 %2, 0
  br i1 %3, label %while.body, label %while.end

while.body:
  %4 = load i32, i32* %n.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %n.addr, align 4
  %8 = load i32, i32* %at.addr, align 4
  %9 = bitcast i8* %sub to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %15 = sext i32 %13 to i64
  %16 = bitcast i8* %s to i64*
  %17 = load i64, i64* %16, align 8
  %18 = call i64 @llvm.smin.i64(i64 %15, i64 %17)
  %19 = call i64 @llvm.smax.i64(i64 %18, i64 0)
  %20 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %19)
  %21 = trunc i64 %20 to i32
  store i32 %21, i32* %at.addr, align 4
  br label %while.cond

while.end:
  %22 = load i32, i32* %n.addr, align 4
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %zero.addr = alloca double, align 8
  %step.addr = alloca i64, align 8
  %huge.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = load i8*, i8** %s.addr, align 8
  %1 = call i32 @find(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i8*, i8** %s.addr, align 8
  %4 = call i32 @find(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 2)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %s.addr, align 8
  %7 = call i32 @find(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 4)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i8*, i8** %s.addr, align 8
  %10 = call i32 @find(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 99)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load i8*, i8** %s.addr, align 8
  %13 = call i32 @find(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i32 -5)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load i8*, i8** %s.addr, align 8
  %16 = call i32 @find(i8* %15, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 3)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = load i8*, i8** %s.addr, align 8
  %19 = call i32 @find(i8* %18, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 99)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load i8*, i8** %s.addr, align 8
  %22 = call i32 @find(i8* %21, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 -1)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load i8*, i8** %s.addr, align 8
  %25 = call i32 @find(i8* %24, i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i32 4)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  %27 = load i8*, i8** %s.addr, align 8
  %28 = call i32 @find(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i32 6)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
  %30 = load i8*, i8** %s.addr, align 8
  %31 = call i32 @find(i8* %30, i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), i32 4)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @find(i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i32 0)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load i8*, i8** %s.addr, align 8
  %36 = call i32 @findF(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), double 0x3FF8000000000000)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  store double 0x0000000000000000, double* %zero.addr, align 8
  %38 = load i8*, i8** %s.addr, align 8
  %39 = load double, double* %zero.addr, align 8
  %40 = load double, double* %zero.addr, align 8
  %41 = fdiv double %39, %40
  %42 = call i32 @findF(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), double %41)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  store i64 1024, i64* %step.addr, align 8
  %44 = load i64, i64* %step.addr, align 8
  %45 = mul i64 9007199254740992, %44
  store i64 %45, i64* %huge.addr, align 8
  %46 = load i8*, i8** %s.addr, align 8
  %47 = call i32 @findU(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i64 2)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
  %49 = load i8*, i8** %s.addr, align 8
  %50 = load i64, i64* %huge.addr, align 8
  %51 = call i32 @findU(i8* %49, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i64 %50)
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  %53 = load i8*, i8** %s.addr, align 8
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = call i64 @llvm.smin.i64(i64 3, i64 %55)
  %57 = call i64 @llvm.smax.i64(i64 %56, i64 0)
  %58 = call i64 @nish_str_index_of_from(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 %57)
  %59 = trunc i64 %58 to i32
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  %61 = call i32 @count(i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %62 = call i8* @nish_str_from_i32(i32 %61)
  call void @nish_print(i8* %62)
  %63 = call i32 @count(i8* bitcast ({ i64, [5 x i8] }* @.str.9 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %64 = call i8* @nish_str_from_i32(i32 %63)
  call void @nish_print(i8* %64)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
