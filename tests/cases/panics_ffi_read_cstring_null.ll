@.str.0 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"`readCString` read a NULL pointer\00" }, align 8

declare i8* @textPtr()
declare i8* @nullPtr()
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
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @textPtr()
  %1 = icmp eq i8* %0, null
  br i1 %1, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [34 x i8] }* @.str.0 to i8*))
  unreachable

ffi.copy:
  %2 = call i8* @nish.ffi.str(i8* %0)
  store i8* %2, i8** %s.addr, align 8
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

define noundef i32 @absent() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nullPtr()
  %1 = icmp eq i8* %0, null
  br i1 %1, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [34 x i8] }* @.str.0 to i8*))
  unreachable

ffi.copy:
  %2 = call i8* @nish.ffi.str(i8* %0)
  store i8* %2, i8** %s.addr, align 8
  %3 = load i8*, i8** %s.addr, align 8
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
