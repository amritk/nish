@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c".txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"secret\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strlen`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strcmp`: argument 2 (b) holds a NUL byte, which C would read as the end of the string\00" }, align 8

declare i64 @strlen(i8*)
declare i32 @strcmp(i8*, i8*)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noundef nonnull align 8 i8* @withNul(i8* noundef nonnull noalias readonly align 8 nocapture %head) #0 {
entry:
  %chr = alloca i8, align 1
  %0 = trunc i64 0 to i8
  store i8 %0, i8* %chr, align 1
  %1 = call i8* @nish_str_new(i8* %chr, i64 1)
  %2 = call i8* @nish_str_concat(i8* %head, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  ret i8* %3
}

define noundef i32 @literal() #0 {
entry:
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i64 @strlen(i8* %0)
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef i32 @clean() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @withNul(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = icmp ule i64 0, 6
  %6 = icmp ule i64 6, %4
  %7 = and i1 %5, %6
  br i1 %7, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 6, i64 %4)
  unreachable

slice.ok:
  %8 = sub i64 6, 0
  %9 = getelementptr inbounds i8, i8* %2, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 0
  %11 = call i8* @nish_str_new(i8* %10, i64 %8)
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %13 = icmp sge i64 %12, 0
  br i1 %13, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.4 to i8*))
  unreachable

ffi.ok:
  %14 = getelementptr inbounds i8, i8* %11, i64 8
  %15 = call i64 @strlen(i8* %14)
  %16 = trunc i64 %15 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %16
}

define noundef i32 @holdsNul() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @withNul(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_str_index_of(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %4 = icmp sge i64 %3, 0
  br i1 %4, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.4 to i8*))
  unreachable

ffi.ok:
  %5 = getelementptr inbounds i8, i8* %2, i64 8
  %6 = call i64 @strlen(i8* %5)
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define noundef i32 @nullableNul() #0 {
entry:
  %b.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @withNul(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %b.addr, align 8
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  %4 = load i8*, i8** %b.addr, align 8
  %5 = icmp eq i8* %4, null
  br i1 %5, label %ffi.join, label %ffi.some

ffi.some:
  %6 = call i64 @nish_str_index_of(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %7 = icmp sge i64 %6, 0
  br i1 %7, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.6 to i8*))
  unreachable

ffi.ok:
  %8 = getelementptr inbounds i8, i8* %4, i64 8
  br label %ffi.join

ffi.join:
  %9 = phi i8* [ null, %entry ], [ %8, %ffi.ok ]
  %10 = call i32 @strcmp(i8* %3, i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
