@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"build/test\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/test/owner_checks.txt\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"build/test/owner_checks.missing\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/owner_checks.txt\00x\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"/bin/sh\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/bin/sh\00x\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_lstat_owner_mode(i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_euid() #1
declare zeroext i1 @nish_is_executable(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef i64 @ownerOf(i64 noundef %ownerMode) #0 {
entry:
  %0 = sext i32 32 to i64
  %1 = and i64 %0, 63
  %2 = ashr i64 %ownerMode, %1
  ret i64 %2
}

define internal noundef i64 @typeOf(i64 noundef %ownerMode) #0 {
entry:
  %0 = sext i32 61440 to i64
  %1 = and i64 %ownerMode, %0
  ret i64 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %file.addr = alloca i8*, align 8
  %me.addr = alloca i64, align 8
  %om.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %1 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*))
  store i8* bitcast ({ i64, [28 x i8] }* @.str.2 to i8*), i8** %file.addr, align 8
  %2 = load i8*, i8** %file.addr, align 8
  call void @nish_write_file(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %3 = call i64 @nish_euid()
  store i64 %3, i64* %me.addr, align 8
  %4 = load i64, i64* %me.addr, align 8
  %5 = sext i32 0 to i64
  %6 = icmp sge i64 %4, %5
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %7)
  %8 = load i8*, i8** %file.addr, align 8
  %9 = call i64 @nish_lstat_owner_mode(i8* %8)
  store i64 %9, i64* %om.addr, align 8
  %10 = load i64, i64* %om.addr, align 8
  %11 = sext i32 -1 to i64
  %12 = icmp ne i64 %10, %11
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %13)
  %14 = load i64, i64* %om.addr, align 8
  %15 = call i64 @ownerOf(i64 %14)
  %16 = load i64, i64* %me.addr, align 8
  %17 = icmp eq i64 %15, %16
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %18)
  %19 = load i64, i64* %om.addr, align 8
  %20 = call i64 @typeOf(i64 %19)
  %21 = sext i32 32768 to i64
  %22 = icmp eq i64 %20, %21
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %23)
  %24 = call i64 @nish_lstat_owner_mode(i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*))
  %25 = call i64 @typeOf(i64 %24)
  %26 = sext i32 16384 to i64
  %27 = icmp eq i64 %25, %26
  %28 = select i1 %27, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %28)
  %29 = call i64 @nish_lstat_owner_mode(i8* bitcast ({ i64, [32 x i8] }* @.str.6 to i8*))
  %30 = call i8* @nish_str_from_i64(i64 %29)
  call void @nish_print(i8* %30)
  %31 = call i64 @nish_lstat_owner_mode(i8* bitcast ({ i64, [30 x i8] }* @.str.7 to i8*))
  %32 = call i8* @nish_str_from_i64(i64 %31)
  call void @nish_print(i8* %32)
  %33 = load i8*, i8** %file.addr, align 8
  %34 = call zeroext i1 @nish_is_executable(i8* %33)
  %35 = select i1 %34, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %35)
  %36 = call zeroext i1 @nish_is_executable(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*))
  %37 = select i1 %36, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %37)
  %38 = call zeroext i1 @nish_is_executable(i8* bitcast ({ i64, [10 x i8] }* @.str.9 to i8*))
  %39 = select i1 %38, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %39)
  %40 = call zeroext i1 @nish_is_executable(i8* bitcast ({ i64, [32 x i8] }* @.str.6 to i8*))
  %41 = select i1 %40, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %41)
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
