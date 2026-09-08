@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"x64\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"x86_64\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"arm64\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"aarch64\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"linux\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"-unknown-linux-gnu\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"darwin\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"-apple-darwin\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"platform: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arch: \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"triple: \00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef nonnull align 8 i8* @amrit_platform() #3
declare noundef nonnull align 8 i8* @amrit_arch() #3

define noundef nonnull align 8 i8* @hostTriple(i8* noundef nonnull noalias readonly align 8 nocapture %platform, i8* noundef nonnull noalias readonly align 8 nocapture %arch) #0 {
entry:
  %cpu.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %cpu.addr, align 8
  %0 = call zeroext i1 @amrit_str_eq(i8* %arch, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  br i1 %0, label %if.then, label %if.else

if.then:
  store i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8** %cpu.addr, align 8
  br label %if.end

if.else:
  %1 = call zeroext i1 @amrit_str_eq(i8* %arch, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*))
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  store i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8** %cpu.addr, align 8
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %2 = load i8*, i8** %cpu.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %if.then.2, label %if.end.2

if.then.2:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end.2:
  %7 = call zeroext i1 @amrit_str_eq(i8* %platform, i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  br i1 %7, label %if.then.3, label %if.end.3

if.then.3:
  %8 = load i8*, i8** %cpu.addr, align 8
  %9 = call i8* @amrit_str_concat(i8* %8, i8* bitcast ({ i64, [19 x i8] }* @.str.6 to i8*))
  ret i8* %9

if.end.3:
  %10 = call zeroext i1 @amrit_str_eq(i8* %platform, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  br i1 %10, label %if.then.4, label %if.end.4

if.then.4:
  %11 = load i8*, i8** %cpu.addr, align 8
  %12 = call i8* @amrit_str_concat(i8* %11, i8* bitcast ({ i64, [14 x i8] }* @.str.8 to i8*))
  ret i8* %12

if.end.4:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define noundef i32 @amrit_main() #0 {
entry:
  %platform.addr = alloca i8*, align 8
  %arch.addr = alloca i8*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i8* @amrit_platform()
  store i8* %0, i8** %platform.addr, align 8
  %1 = call i8* @amrit_arch()
  store i8* %1, i8** %arch.addr, align 8
  %2 = load i8*, i8** %platform.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i8*, i8** %platform.addr, align 8
  %8 = call i8* @amrit_platform()
  %9 = call zeroext i1 @amrit_str_eq(i8* %7, i8* %8)
  br label %land.end

land.end:
  %10 = phi i1 [ false, %entry ], [ %9, %land.rhs ]
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %12 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.9 to i8*), i8* %11)
  call void @amrit_print(i8* %12)
  %13 = load i8*, i8** %arch.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = icmp sgt i32 %16, 0
  br i1 %17, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %18 = load i8*, i8** %arch.addr, align 8
  %19 = call i8* @amrit_arch()
  %20 = call zeroext i1 @amrit_str_eq(i8* %18, i8* %19)
  br label %land.end.1

land.end.1:
  %21 = phi i1 [ false, %land.end ], [ %20, %land.rhs.1 ]
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %23 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*), i8* %22)
  call void @amrit_print(i8* %23)
  %24 = load i8*, i8** %platform.addr, align 8
  %25 = load i8*, i8** %arch.addr, align 8
  %26 = call i8* @hostTriple(i8* %24, i8* %25)
  %27 = bitcast i8* %26 to i64*
  %28 = load i64, i64* %27, align 8
  %29 = trunc i64 %28 to i32
  %30 = icmp sgt i32 %29, 0
  %31 = select i1 %30, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*)
  %32 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.13 to i8*), i8* %31)
  call void @amrit_print(i8* %32)
  call void @amrit_arena_release(i64 %arena.mark)
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
attributes #3 = { nounwind willreturn readnone }
