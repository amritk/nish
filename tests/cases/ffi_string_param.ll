@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strlen`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [85 x i8] } { i64 84, [85 x i8] c"`atoi`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  -12x\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"NISH_FFI_STRING_PARAM\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [90 x i8] } { i64 89, [90 x i8] c"`setenv`: argument 1 (name) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"v=\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [91 x i8] } { i64 90, [91 x i8] c"`setenv`: argument 2 (value) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"unset\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [92 x i8] } { i64 91, [92 x i8] c"`unsetenv`: argument 1 (name) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"still set\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ab42\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strcmp`: argument 2 (b) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"hello from puts\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [85 x i8] } { i64 84, [85 x i8] c"`puts`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8

declare i64 @strlen(i8*)
declare i32 @atoi(i8*)
declare i32 @setenv(i8*, i8*, i32)
declare i32 @unsetenv(i8*)
declare i32 @puts(i8*)
declare i32 @strcmp(i8*, i8*)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

define internal noundef nonnull align 8 i8* @digits(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 7
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define noundef i32 @nish_main() #1 {
entry:
  %built.addr = alloca i8*, align 8
  %name.addr = alloca i8*, align 8
  %back.addr = alloca i8*, align 8
  %other.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*), i64 8
  %1 = call i64 @strlen(i8* %0)
  %2 = call i8* @nish_str_from_u64(i64 %1)
  call void @nish_print(i8* %2)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @digits(i32 6)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8* %5)
  store i8* %6, i8** %built.addr, align 8
  %7 = load i8*, i8** %built.addr, align 8
  %8 = call i64 @nish_str_index_of(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %9 = icmp sge i64 %8, 0
  br i1 %9, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.3 to i8*))
  unreachable

ffi.ok:
  %10 = getelementptr inbounds i8, i8* %7, i64 8
  %11 = call i64 @strlen(i8* %10)
  %12 = call i8* @nish_str_from_u64(i64 %11)
  call void @nish_print(i8* %12)
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @digits(i32 11)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = call i64 @nish_str_index_of(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %17 = icmp sge i64 %16, 0
  br i1 %17, label %ffi.nul.1, label %ffi.ok.1

ffi.nul.1:
  call void @nish_panic(i8* bitcast ({ i64, [85 x i8] }* @.str.4 to i8*))
  unreachable

ffi.ok.1:
  %18 = getelementptr inbounds i8, i8* %15, i64 8
  %19 = call i32 @atoi(i8* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), i64 8
  %22 = call i32 @atoi(i8* %21)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  store i8* bitcast ({ i64, [22 x i8] }* @.str.6 to i8*), i8** %name.addr, align 8
  %24 = load i8*, i8** %name.addr, align 8
  %25 = call i64 @nish_str_index_of(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %26 = icmp sge i64 %25, 0
  br i1 %26, label %ffi.nul.2, label %ffi.ok.2

ffi.nul.2:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.7 to i8*))
  unreachable

ffi.ok.2:
  %27 = getelementptr inbounds i8, i8* %24, i64 8
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @digits(i32 3)
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  %31 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8* %30)
  %32 = call i64 @nish_str_index_of(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %33 = icmp sge i64 %32, 0
  br i1 %33, label %ffi.nul.3, label %ffi.ok.3

ffi.nul.3:
  call void @nish_panic(i8* bitcast ({ i64, [91 x i8] }* @.str.9 to i8*))
  unreachable

ffi.ok.3:
  %34 = getelementptr inbounds i8, i8* %31, i64 8
  %35 = call i32 @setenv(i8* %27, i8* %34, i32 1)
  %36 = icmp ne i32 %35, 0
  br i1 %36, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %37 = load i8*, i8** %name.addr, align 8
  %38 = call i8* @nish_getenv(i8* %37)
  store i8* %38, i8** %back.addr, align 8
  %39 = load i8*, i8** %back.addr, align 8
  %40 = icmp eq i8* %39, null
  br i1 %40, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %41 = load i8*, i8** %back.addr, align 8
  br label %cond.end

cond.end:
  %42 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.10 to i8*), %cond.true ], [ %41, %cond.false ]
  call void @nish_print(i8* %42)
  %43 = load i8*, i8** %name.addr, align 8
  %44 = call i64 @nish_str_index_of(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %45 = icmp sge i64 %44, 0
  br i1 %45, label %ffi.nul.4, label %ffi.ok.4

ffi.nul.4:
  call void @nish_panic(i8* bitcast ({ i64, [92 x i8] }* @.str.11 to i8*))
  unreachable

ffi.ok.4:
  %46 = getelementptr inbounds i8, i8* %43, i64 8
  %47 = call i32 @unsetenv(i8* %46)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
  %49 = load i8*, i8** %name.addr, align 8
  %50 = call i8* @nish_getenv(i8* %49)
  %51 = icmp eq i8* %50, null
  br i1 %51, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %52 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.10 to i8*), %cond.true.1 ], [ bitcast ({ i64, [10 x i8] }* @.str.12 to i8*), %cond.false.1 ]
  call void @nish_print(i8* %52)
  %53 = load i8*, i8** %built.addr, align 8
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = trunc i64 %55 to i32
  %57 = icmp sgt i32 %56, 0
  br i1 %57, label %cond.true.2, label %cond.false.2

cond.true.2:
  %58 = load i8*, i8** %built.addr, align 8
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %59 = phi i8* [ %58, %cond.true.2 ], [ null, %cond.false.2 ]
  store i8* %59, i8** %other.addr, align 8
  %60 = getelementptr inbounds i8, i8* bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), i64 8
  %61 = load i8*, i8** %other.addr, align 8
  %62 = icmp eq i8* %61, null
  br i1 %62, label %ffi.join, label %ffi.some

ffi.some:
  %63 = call i64 @nish_str_index_of(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %64 = icmp sge i64 %63, 0
  br i1 %64, label %ffi.nul.5, label %ffi.ok.5

ffi.nul.5:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.14 to i8*))
  unreachable

ffi.ok.5:
  %65 = getelementptr inbounds i8, i8* %61, i64 8
  br label %ffi.join

ffi.join:
  %66 = phi i8* [ null, %cond.end.2 ], [ %65, %ffi.ok.5 ]
  %67 = call i32 @strcmp(i8* %60, i8* %66)
  %68 = call i8* @nish_str_from_i32(i32 %67)
  call void @nish_print(i8* %68)
  %69 = getelementptr inbounds i8, i8* bitcast ({ i64, [16 x i8] }* @.str.15 to i8*), i64 8
  %70 = call i32 @puts(i8* %69)
  %71 = load i8*, i8** %built.addr, align 8
  %72 = call i64 @nish_str_index_of(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %73 = icmp sge i64 %72, 0
  br i1 %73, label %ffi.nul.6, label %ffi.ok.6

ffi.nul.6:
  call void @nish_panic(i8* bitcast ({ i64, [85 x i8] }* @.str.16 to i8*))
  unreachable

ffi.ok.6:
  %74 = getelementptr inbounds i8, i8* %71, i64 8
  %75 = call i32 @puts(i8* %74)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
