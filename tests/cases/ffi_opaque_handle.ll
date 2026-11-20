%struct.Db = type {}
%struct.Stmt = type {}

@.str.0 = private unnamed_addr constant { i64, [75 x i8] } { i64 74, [75 x i8] c"`stmt_prepare` returned NULL for a `Stmt` result; declare it `Stmt | null`\00" }, align 8

declare i8* @db_open(i32)
declare void @db_close(i8*)
declare i8* @stmt_prepare(i8*, i32)
declare i32 @stmt_step(i8*)
declare void @stmt_close(i8*)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @run(i32 noundef %flags, i32 noundef %n) #0 {
entry:
  %db.addr = alloca i8*, align 8
  %stmt.addr = alloca i8*, align 8
  %sum.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @db_open(i32 %flags)
  store i8* %0, i8** %db.addr, align 8
  %1 = load i8*, i8** %db.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end:
  %3 = load i8*, i8** %db.addr, align 8
  %4 = call i8* @stmt_prepare(i8* %3, i32 %n)
  %5 = icmp eq i8* %4, null
  br i1 %5, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.0 to i8*))
  unreachable

ffi.copy:
  store i8* %4, i8** %stmt.addr, align 8
  store i32 0, i32* %sum.addr, align 4
  %6 = load i8*, i8** %stmt.addr, align 8
  %7 = call i32 @stmt_step(i8* %6)
  store i32 %7, i32* %row.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %row.addr, align 4
  %9 = icmp sgt i32 %8, 0
  br i1 %9, label %while.body, label %while.end

while.body:
  %10 = load i32, i32* %sum.addr, align 4
  %11 = load i32, i32* %row.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %sum.addr, align 4
  %15 = load i8*, i8** %stmt.addr, align 8
  %16 = call i32 @stmt_step(i8* %15)
  store i32 %16, i32* %row.addr, align 4
  br label %while.cond

while.end:
  %17 = load i8*, i8** %stmt.addr, align 8
  call void @stmt_close(i8* %17)
  %18 = load i8*, i8** %db.addr, align 8
  call void @db_close(i8* %18)
  %19 = load i32, i32* %sum.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @broken() #0 {
entry:
  %db.addr = alloca i8*, align 8
  %stmt.addr = alloca i8*, align 8
  store i8* null, i8** %db.addr, align 8
  %0 = call i8* @db_open(i32 1)
  store i8* %0, i8** %db.addr, align 8
  %1 = load i8*, i8** %db.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %3 = load i8*, i8** %db.addr, align 8
  %4 = call i8* @stmt_prepare(i8* %3, i32 -1)
  %5 = icmp eq i8* %4, null
  br i1 %5, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.0 to i8*))
  unreachable

ffi.copy:
  store i8* %4, i8** %stmt.addr, align 8
  %6 = load i8*, i8** %stmt.addr, align 8
  call void @stmt_close(i8* %6)
  %7 = load i8*, i8** %db.addr, align 8
  call void @db_close(i8* %7)
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
