@nish_errno_slot = external global i32, align 4
@.str.0 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"before any call: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"/nonexistent/nish-errno\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"open: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" errno \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [72 x i8] } { i64 71, [72 x i8] c"`quiet` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"quiet: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"99999999999999999999999\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"strtol out of range: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"42\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"strtol in range: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [77 x i8] } { i64 76, [77 x i8] c"`errno_says` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"errno_says: \00" }, align 8

declare i32 @open(i8*, i32)
declare i64 @strtol(i8*, i8*, i32)
declare i8* @errno_says(i32)
declare i8* @quiet()
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare nonnull i32* @nish_errno_ptr() #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

define private i8* @nish.ffi.str(i8* %p) {
entry:
  br label %scan

scan:
  %n = phi i64 [ 0, %entry ], [ %next, %scan ]
  %at = getelementptr inbounds i8, i8* %p, i64 %n
  %byte = load i8, i8* %at, align 1
  %next = add i64 %n, 1
  %end = icmp eq i8 %byte, 0
  br i1 %end, label %copy, label %scan

copy:
  %s = call i8* @nish_str_new(i8* %p, i64 %n)
  ret i8* %s
}

define internal noundef i32 @lastErrno() #0 {
entry:
  %0 = load i32, i32* @nish_errno_slot, align 4
  ret i32 %0
}

define noundef i32 @run() #1 {
entry:
  %fd.addr = alloca i32, align 4
  %q.addr = alloca i8*, align 8
  %big.addr = alloca i64, align 8
  %small.addr = alloca i64, align 8
  %said.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @lastErrno()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.0 to i8*), i8* %1)
  call void @nish_print(i8* %2)
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [24 x i8] }* @.str.1 to i8*), i64 8
  %4 = call i32* @nish_errno_ptr()
  store i32 0, i32* %4, align 4
  %5 = call i32 @open(i8* %3, i32 0)
  %6 = load i32, i32* %4, align 4
  store i32 %6, i32* @nish_errno_slot, align 4
  store i32 %5, i32* %fd.addr, align 4
  %7 = load i32, i32* %fd.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %11 = call i32 @lastErrno()
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  call void @nish_print(i8* %13)
  %14 = call i32* @nish_errno_ptr()
  store i32 0, i32* %14, align 4
  %15 = call i8* @quiet()
  %16 = load i32, i32* %14, align 4
  store i32 %16, i32* @nish_errno_slot, align 4
  %17 = icmp eq i8* %15, null
  br i1 %17, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [72 x i8] }* @.str.4 to i8*))
  unreachable

ffi.copy:
  %18 = call i8* @nish.ffi.str(i8* %15)
  store i8* %18, i8** %q.addr, align 8
  %19 = load i8*, i8** %q.addr, align 8
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %22 = load i32, i32* @nish_errno_slot, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  call void @nish_print(i8* %24)
  %25 = getelementptr inbounds i8, i8* bitcast ({ i64, [24 x i8] }* @.str.6 to i8*), i64 8
  %26 = call i32* @nish_errno_ptr()
  store i32 0, i32* %26, align 4
  %27 = call i64 @strtol(i8* %25, i8* null, i32 10)
  %28 = load i32, i32* %26, align 4
  store i32 %28, i32* @nish_errno_slot, align 4
  store i64 %27, i64* %big.addr, align 8
  %29 = load i64, i64* %big.addr, align 8
  %30 = icmp sgt i64 %29, 4000000000000000
  %31 = select i1 %30, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %32 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.7 to i8*), i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %34 = load i32, i32* @nish_errno_slot, align 4
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %33, i8* %35)
  call void @nish_print(i8* %36)
  %37 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*), i64 8
  %38 = call i32* @nish_errno_ptr()
  store i32 0, i32* %38, align 4
  %39 = call i64 @strtol(i8* %37, i8* null, i32 10)
  %40 = load i32, i32* %38, align 4
  store i32 %40, i32* @nish_errno_slot, align 4
  store i64 %39, i64* %small.addr, align 8
  %41 = load i64, i64* %small.addr, align 8
  %42 = call i8* @nish_str_from_i64(i64 %41)
  %43 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.11 to i8*), i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %45 = load i32, i32* @nish_errno_slot, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %44, i8* %46)
  call void @nish_print(i8* %47)
  %48 = call i32* @nish_errno_ptr()
  store i32 0, i32* %48, align 4
  %49 = call i8* @errno_says(i32 5)
  %50 = load i32, i32* %48, align 4
  store i32 %50, i32* @nish_errno_slot, align 4
  %51 = icmp eq i8* %49, null
  br i1 %51, label %ffi.null.1, label %ffi.copy.1

ffi.null.1:
  call void @nish_panic(i8* bitcast ({ i64, [77 x i8] }* @.str.12 to i8*))
  unreachable

ffi.copy.1:
  %52 = call i8* @nish.ffi.str(i8* %49)
  store i8* %52, i8** %said.addr, align 8
  %53 = load i8*, i8** %said.addr, align 8
  %54 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.13 to i8*), i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %56 = load i32, i32* @nish_errno_slot, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %55, i8* %57)
  call void @nish_print(i8* %58)
  %59 = load i32, i32* @nish_errno_slot, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %59
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
