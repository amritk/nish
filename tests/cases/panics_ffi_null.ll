@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"HOME\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [73 x i8] } { i64 72, [73 x i8] c"`getenv` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"NISH_FFI_NULL_NEVER_SET\00" }, align 8

declare i8* @getenv(i8*)
declare i8* @strchr(i8*, i32)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #2

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

define noundef i32 @present() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i64 8
  %1 = call i8* @getenv(i8* %0)
  %2 = icmp eq i8* %1, null
  br i1 %2, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [73 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %3 = call i8* @nish.ffi.str(i8* %1)
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sgt i32 %6, 0
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %8
}

define noundef i32 @nullable() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i64 8
  %1 = call i8* @strchr(i8* %0, i32 122)
  %2 = icmp eq i8* %1, null
  br i1 %2, label %ffi.none, label %ffi.copy

ffi.copy:
  %3 = call i8* @nish.ffi.str(i8* %1)
  br label %ffi.join

ffi.none:
  br label %ffi.join

ffi.join:
  %4 = phi i8* [ %3, %ffi.copy ], [ null, %ffi.none ]
  %5 = icmp eq i8* %4, null
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

define noundef i32 @absent() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [24 x i8] }* @.str.3 to i8*), i64 8
  %1 = call i8* @getenv(i8* %0)
  %2 = icmp eq i8* %1, null
  br i1 %2, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [73 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %3 = call i8* @nish.ffi.str(i8* %1)
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
