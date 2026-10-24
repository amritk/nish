%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [75 x i8] } { i64 74, [75 x i8] c"`strerror` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"never\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"xxab\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strchr`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"NISH_FFI_STRING_RETURN\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [90 x i8] } { i64 89, [90 x i8] c"`getenv`: argument 1 (name) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"unset\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"set\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [90 x i8] } { i64 89, [90 x i8] c"`setenv`: argument 1 (name) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"v=\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [91 x i8] } { i64 90, [91 x i8] c"`setenv`: argument 2 (value) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"found\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @strerror(i32)
declare i8* @getenv(i8*)
declare i32 @setenv(i8*, i8*, i32)
declare i8* @setlocale(i32, i8*)
declare i8* @strchr(i8*, i32)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef nonnull align 8 i8* @digits(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 7
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define internal noundef i32 @noise(i32 noundef %n) #1 {
entry:
  %t.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %t.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i8*, i8** %t.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  store i8* %5, i8** %t.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %8 = load i8*, i8** %t.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  ret i32 %11
}

define internal noundef i32 @churn() #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 64
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = call i32 @noise(i32 40)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %t.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %14 = load i8*, i8** %13, align 8
  %15 = icmp eq i8* %14, %3
  br i1 %15, label %pass.rewind, label %pass.free

pass.rewind:
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %16, align 8
  br label %pass.done

pass.free:
  %17 = ptrtoint i8* %3 to i64
  %18 = add i64 %17, %5
  call void @nish_arena_release(i64 %18)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %19 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @describe(i32 noundef %e) #1 {
entry:
  %k.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %0 = add nsw i32 %e, 3
  %1 = call i32 @noise(i32 %0)
  store i32 %1, i32* %k.addr, align 4
  %2 = call i8* @strerror(i32 %e)
  %3 = icmp eq i8* %2, null
  br i1 %3, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %4 = call i8* @nish.ffi.str(i8* %2)
  store i8* %4, i8** %s.addr, align 8
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp slt i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %7 = load i8*, i8** %s.addr, align 8
  br label %cond.end

cond.end:
  %8 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), %cond.true ], [ %7, %cond.false ]
  ret i8* %8
}

define internal noundef align 8 i8* @after(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @digits(i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %2)
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = call i64 @nish_str_index_of(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %6 = icmp sge i64 %5, 0
  br i1 %6, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %7 = getelementptr inbounds i8, i8* %4, i64 8
  %8 = call i8* @strchr(i8* %7, i32 98)
  %9 = icmp eq i8* %8, null
  br i1 %9, label %ffi.none, label %ffi.copy

ffi.copy:
  %10 = call i8* @nish.ffi.str(i8* %8)
  br label %ffi.join

ffi.none:
  br label %ffi.join

ffi.join:
  %11 = phi i8* [ %10, %ffi.copy ], [ null, %ffi.none ]
  ret i8* %11
}

define noundef i32 @nish_main() #1 {
entry:
  %name.addr = alloca i8*, align 8
  %back.addr = alloca i8*, align 8
  %locale.addr = alloca i8*, align 8
  %kept.addr = alloca i8*, align 8
  %both.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %tail.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @strerror(i32 2)
  %1 = icmp eq i8* %0, null
  br i1 %1, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %2 = call i8* @nish.ffi.str(i8* %0)
  call void @nish_print(i8* %2)
  store i8* bitcast ({ i64, [23 x i8] }* @.str.6 to i8*), i8** %name.addr, align 8
  %3 = load i8*, i8** %name.addr, align 8
  %4 = call i64 @nish_str_index_of(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %5 = icmp sge i64 %4, 0
  br i1 %5, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.7 to i8*))
  unreachable

ffi.ok:
  %6 = getelementptr inbounds i8, i8* %3, i64 8
  %7 = call i8* @getenv(i8* %6)
  %8 = icmp eq i8* %7, null
  br i1 %8, label %ffi.none, label %ffi.copy.1

ffi.copy.1:
  %9 = call i8* @nish.ffi.str(i8* %7)
  br label %ffi.join

ffi.none:
  br label %ffi.join

ffi.join:
  %10 = phi i8* [ %9, %ffi.copy.1 ], [ null, %ffi.none ]
  %11 = icmp eq i8* %10, null
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %12 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), %cond.true ], [ bitcast ({ i64, [4 x i8] }* @.str.9 to i8*), %cond.false ]
  call void @nish_print(i8* %12)
  %13 = load i8*, i8** %name.addr, align 8
  %14 = call i64 @nish_str_index_of(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %15 = icmp sge i64 %14, 0
  br i1 %15, label %ffi.nul.1, label %ffi.ok.1

ffi.nul.1:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.10 to i8*))
  unreachable

ffi.ok.1:
  %16 = getelementptr inbounds i8, i8* %13, i64 8
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @digits(i32 3)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.11 to i8*), i8* %19)
  %21 = call i64 @nish_str_index_of(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %22 = icmp sge i64 %21, 0
  br i1 %22, label %ffi.nul.2, label %ffi.ok.2

ffi.nul.2:
  call void @nish_panic(i8* bitcast ({ i64, [91 x i8] }* @.str.12 to i8*))
  unreachable

ffi.ok.2:
  %23 = getelementptr inbounds i8, i8* %20, i64 8
  %24 = call i32 @setenv(i8* %16, i8* %23, i32 1)
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %26 = load i8*, i8** %name.addr, align 8
  %27 = call i64 @nish_str_index_of(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %28 = icmp sge i64 %27, 0
  br i1 %28, label %ffi.nul.3, label %ffi.ok.3

ffi.nul.3:
  call void @nish_panic(i8* bitcast ({ i64, [90 x i8] }* @.str.7 to i8*))
  unreachable

ffi.ok.3:
  %29 = getelementptr inbounds i8, i8* %26, i64 8
  %30 = call i8* @getenv(i8* %29)
  %31 = icmp eq i8* %30, null
  br i1 %31, label %ffi.none.1, label %ffi.copy.2

ffi.copy.2:
  %32 = call i8* @nish.ffi.str(i8* %30)
  br label %ffi.join.1

ffi.none.1:
  br label %ffi.join.1

ffi.join.1:
  %33 = phi i8* [ %32, %ffi.copy.2 ], [ null, %ffi.none.1 ]
  store i8* %33, i8** %back.addr, align 8
  %34 = load i8*, i8** %back.addr, align 8
  %35 = icmp eq i8* %34, null
  br i1 %35, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %36 = load i8*, i8** %back.addr, align 8
  br label %cond.end.1

cond.end.1:
  %37 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), %cond.true.1 ], [ %36, %cond.false.1 ]
  call void @nish_print(i8* %37)
  %38 = call i8* @setlocale(i32 0, i8* null)
  %39 = icmp eq i8* %38, null
  br i1 %39, label %ffi.none.2, label %ffi.copy.3

ffi.copy.3:
  %40 = call i8* @nish.ffi.str(i8* %38)
  br label %ffi.join.2

ffi.none.2:
  br label %ffi.join.2

ffi.join.2:
  %41 = phi i8* [ %40, %ffi.copy.3 ], [ null, %ffi.none.2 ]
  store i8* %41, i8** %locale.addr, align 8
  %42 = load i8*, i8** %locale.addr, align 8
  %43 = icmp eq i8* %42, null
  br i1 %43, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  %44 = load i8*, i8** %locale.addr, align 8
  br label %cond.end.2

cond.end.2:
  %45 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), %cond.true.2 ], [ %44, %cond.false.2 ]
  call void @nish_print(i8* %45)
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @describe(i32 13)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  store i8* %48, i8** %kept.addr, align 8
  %49 = call i8* @strerror(i32 1)
  %50 = icmp eq i8* %49, null
  br i1 %50, label %ffi.null.1, label %ffi.copy.4

ffi.null.1:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy.4:
  %51 = call i8* @nish.ffi.str(i8* %49)
  %52 = call i8* @strerror(i32 2)
  %53 = icmp eq i8* %52, null
  br i1 %53, label %ffi.null.2, label %ffi.copy.5

ffi.null.2:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy.5:
  %54 = call i8* @nish.ffi.str(i8* %52)
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = bitcast [2 x i8*]* %arr.data to i8*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %57, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %57 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 0
  store i8* %51, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = getelementptr inbounds i8*, i8** %59, i64 1
  store i8* %54, i8** %61, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %both.addr, align 8
  %62 = call i8* @after(i32 12345)
  store i8* %62, i8** %tail.addr, align 8
  %63 = call i32 @churn()
  %64 = icmp sgt i32 %63, 0
  %65 = select i1 %64, i8* bitcast ({ i64, [5 x i8] }* @.str.14 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.15 to i8*)
  call void @nish_print(i8* %65)
  %66 = load i8*, i8** %kept.addr, align 8
  call void @nish_print(i8* %66)
  %67 = load %struct.nish_array*, %struct.nish_array** %both.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = icmp ult i64 0, %69
  br i1 %70, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %69)
  unreachable

bounds.ok:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %73 = bitcast i8* %72 to i8**
  %74 = getelementptr inbounds i8*, i8** %73, i64 0
  %75 = load i8*, i8** %74, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %both.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp ult i64 1, %79
  br i1 %80, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %79)
  unreachable

bounds.ok.1:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i8**
  %84 = getelementptr inbounds i8*, i8** %83, i64 1
  %85 = load i8*, i8** %84, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %86 = call i8* @nish_str_concat(i8* %76, i8* %85)
  call void @nish_print(i8* %86)
  %87 = load i8*, i8** %tail.addr, align 8
  %88 = icmp eq i8* %87, null
  br i1 %88, label %cond.true.3, label %cond.false.3

cond.true.3:
  br label %cond.end.3

cond.false.3:
  %89 = load i8*, i8** %tail.addr, align 8
  br label %cond.end.3

cond.end.3:
  %90 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), %cond.true.3 ], [ %89, %cond.false.3 ]
  call void @nish_print(i8* %90)
  %91 = getelementptr inbounds i8, i8* bitcast ({ i64, [4 x i8] }* @.str.17 to i8*), i64 8
  %92 = call i8* @strchr(i8* %91, i32 122)
  %93 = icmp eq i8* %92, null
  br i1 %93, label %ffi.none.3, label %ffi.copy.6

ffi.copy.6:
  %94 = call i8* @nish.ffi.str(i8* %92)
  br label %ffi.join.3

ffi.none.3:
  br label %ffi.join.3

ffi.join.3:
  %95 = phi i8* [ %94, %ffi.copy.6 ], [ null, %ffi.none.3 ]
  %96 = icmp eq i8* %95, null
  br i1 %96, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %97 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), %cond.true.4 ], [ bitcast ({ i64, [6 x i8] }* @.str.18 to i8*), %cond.false.4 ]
  call void @nish_print(i8* %97)
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
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
