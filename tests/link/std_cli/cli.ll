%struct.Style = type { i1, i1 }
%struct.HelpMenu = type { %struct.Style*, i8*, i32, i32, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\1B[\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"m\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"0m\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"1;35\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"36\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"33\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"4\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"2\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"0\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"no\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"off\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"[ -t \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c" ] || exit 1; \00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"t=/usr/bin/tput; [ -x $t ] || t=/bin/tput; [ -x $t ] || exit 0; \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [79 x i8] } { i64 78, [79 x i8] c"c=$($t colors 2>/dev/null) || exit 0; case $c in ''|*[!0-9-]*) exit 0;; esac; \00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"/bin/sh\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"[ \22$c\22 -ge 8 ] || exit \00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"NISH_AGENT\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"CLAUDECODE\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"GEMINI_CLI\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"FORCE_COLOR\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"NO_COLOR\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"CLICOLOR_FORCE\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"TERM\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"CLICOLOR\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"dumb\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [81 x i8] } { i64 80, [81 x i8] c"                                                                                \00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"  \00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"usage:\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #1
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smin.i64(i64, i64) #6
declare i64 @llvm.smax.i64(i64, i64) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @nish.Style.constructor(%struct.Style* noundef nonnull noalias align 8 dereferenceable(2) nocapture %this, i1 noundef zeroext %on, i1 noundef zeroext %colour) #0 {
entry:
  %0 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  store i1 %on, i1* %0, align 1, !tbaa !4
  %1 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 1
  store i1 %colour, i1* %1, align 1, !tbaa !5
  ret void
}

define noundef nonnull align 8 i8* @nish.Style.paint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 %themed, i8* noundef nonnull noalias readonly align 8 %mono) #1 {
entry:
  %code.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 1
  %1 = load i1, i1* %0, align 1, !tbaa !5
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %themed, %cond.true ], [ %mono, %cond.false ]
  store i8* %2, i8** %code.addr, align 8
  %3 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  %4 = load i1, i1* %3, align 1, !tbaa !4
  %5 = xor i1 %4, true
  br i1 %5, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %6 = bitcast i8* %text to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = icmp eq i32 %8, 0
  br label %lor.end.1

lor.end.1:
  %10 = phi i1 [ true, %cond.end ], [ %9, %lor.rhs.1 ]
  br i1 %10, label %lor.end, label %lor.rhs

lor.rhs:
  %11 = load i8*, i8** %code.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = icmp eq i32 %14, 0
  br label %lor.end

lor.end:
  %16 = phi i1 [ true, %lor.end.1 ], [ %15, %lor.rhs ]
  br i1 %16, label %if.then, label %if.end

if.then:
  ret i8* %text

if.end:
  %17 = load i8*, i8** %code.addr, align 8
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %20 = call i8* @nish_str_concat(i8* %19, i8* %text)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  ret i8* %22
}

define noundef nonnull align 8 i8* @nish.Style.heading(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.Style.paint(%struct.Style* %this, i8* %text, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef nonnull align 8 i8* @nish.Style.name(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.Style.paint(%struct.Style* %this, i8* %text, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef nonnull align 8 i8* @nish.Style.flag(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.Style.paint(%struct.Style* %this, i8* %text, i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef nonnull align 8 i8* @nish.Style.meta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.Style.paint(%struct.Style* %this, i8* %text, i8* bitcast ({ i64, [3 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef nonnull align 8 i8* @nish.Style.dim(%struct.Style* noundef nonnull readonly align 8 dereferenceable(2) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.Style.paint(%struct.Style* %this, i8* %text, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef zeroext i1 @nish.envIsSet(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %value.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_getenv(i8* %name)
  store i8* %0, i8** %value.addr, align 8
  %1 = load i8*, i8** %value.addr, align 8
  %2 = icmp ne i8* %1, null
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = load i8*, i8** %value.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sgt i32 %6, 0
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i1 %8
}

define internal noundef zeroext i1 @nish.spells(i8* noundef nonnull noalias readonly align 8 nocapture %value, i8* noundef nonnull noalias readonly align 8 nocapture %word) #2 {
entry:
  %i.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %0 = bitcast i8* %value to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = bitcast i8* %word to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp ne i32 %2, %5
  br i1 %6, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = bitcast i8* %value to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %7, %10
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %i.addr, align 4
  %13 = bitcast i8* %word to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %12, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds i8, i8* %value, i64 8
  %21 = getelementptr inbounds i8, i8* %20, i64 %19
  %22 = load i8, i8* %21, align 1
  %23 = zext i8 %22 to i32
  store i32 %23, i32* %code.addr, align 4
  %24 = load i32, i32* %code.addr, align 4
  %25 = icmp sge i32 %24, 65
  br i1 %25, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %26 = load i32, i32* %code.addr, align 4
  %27 = icmp sle i32 %26, 90
  br label %land.end.1

land.end.1:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.1 ]
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  %29 = load i32, i32* %code.addr, align 4
  %30 = add nsw i32 %29, 32
  store i32 %30, i32* %code.addr, align 4
  br label %if.end.1

if.end.1:
  %31 = load i32, i32* %code.addr, align 4
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds i8, i8* %word, i64 8
  %35 = getelementptr inbounds i8, i8* %34, i64 %33
  %36 = load i8, i8* %35, align 1
  %37 = zext i8 %36 to i32
  %38 = icmp ne i32 %31, %37
  br i1 %38, label %if.then.2, label %if.end.2

if.then.2:
  ret i1 false

if.end.2:
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef zeroext i1 @nish.isNo(i8* noundef nonnull noalias readonly align 8 %value) #2 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %value, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = call i1 @nish.spells(i8* %value, i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*))
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = call i1 @nish.spells(i8* %value, i8* bitcast ({ i64, [3 x i8] }* @.str.12 to i8*))
  br label %lor.end.1

lor.end.1:
  %4 = phi i1 [ true, %lor.end.2 ], [ %3, %lor.rhs.1 ]
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = call i1 @nish.spells(i8* %value, i8* bitcast ({ i64, [4 x i8] }* @.str.13 to i8*))
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %lor.end.1 ], [ %5, %lor.rhs ]
  ret i1 %6
}

define internal noundef zeroext i1 @nish.saysNo(i8* noundef noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp ne i8* %value, null
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = call i1 @nish.isNo(i8* %value)
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @nish.saysYes(i8* noundef noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp ne i8* %value, null
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = bitcast i8* %value to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 0
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs.1 ]
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = call i1 @nish.isNo(i8* %value)
  %7 = xor i1 %6, true
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  ret i1 %8
}

define internal noundef zeroext i1 @nish.envSaysNo(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %0 = call i8* @nish_getenv(i8* %name)
  %1 = call i1 @nish.saysNo(i8* %0)
  ret i1 %1
}

define internal noundef zeroext i1 @nish.envSaysYes(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %0 = call i8* @nish_getenv(i8* %name)
  %1 = call i1 @nish.saysYes(i8* %0)
  ret i1 %1
}

define internal noundef i32 @nish.paletteOf(i32 noundef %fd) #1 {
entry:
  %tty.addr = alloca i8*, align 8
  %find.addr = alloca i8*, align 8
  %count.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %fd)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.14 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [15 x i8] }* @.str.15 to i8*))
  store i8* %2, i8** %tty.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.16 to i8*), i8** %find.addr, align 8
  store i8* bitcast ({ i64, [79 x i8] }* @.str.17 to i8*), i8** %count.addr, align 8
  %3 = load i8*, i8** %tty.addr, align 8
  %4 = load i8*, i8** %find.addr, align 8
  %5 = call i8* @nish_str_concat(i8* %3, i8* %4)
  %6 = load i8*, i8** %count.addr, align 8
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [24 x i8] }* @.str.20 to i8*))
  %9 = call i8* @nish_str_from_i32(i32 2)
  %10 = call i8* @nish_str_concat(i8* %8, i8* %9)
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %15 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.18 to i8*), i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %19 = getelementptr inbounds i8*, i8** %17, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.19 to i8*), i8** %19, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %20 = getelementptr inbounds i8*, i8** %17, i64 2
  store i8* %10, i8** %20, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %21 = call i32 @nish_spawn(%struct.nish_array* %12)
  ret i32 %21
}

define internal noundef nonnull align 8 dereferenceable(2) %struct.Style* @nish.styleOfPalette(i32 noundef %palette) #0 {
entry:
  %0 = icmp eq i32 %palette, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 2)
  %2 = bitcast i8* %1 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %2, i1 true, i1 true)
  ret %struct.Style* %2

if.end:
  %3 = call i8* @nish_alloc_struct(i64 2)
  %4 = bitcast i8* %3 to %struct.Style*
  %5 = icmp eq i32 %palette, 2
  call void @nish.Style.constructor(%struct.Style* %4, i1 %5, i1 false)
  ret %struct.Style* %4
}

define noundef zeroext i1 @nish.agentDriven() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i1 @nish.envIsSet(i8* bitcast ({ i64, [11 x i8] }* @.str.21 to i8*))
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i1 @nish.envSaysNo(i8* bitcast ({ i64, [11 x i8] }* @.str.21 to i8*))
  %2 = xor i1 %1, true
  call void @nish_arena_release(i64 %arena.mark)
  ret i1 %2

if.end:
  %3 = call i1 @nish.envSaysYes(i8* bitcast ({ i64, [11 x i8] }* @.str.22 to i8*))
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = call i1 @nish.envSaysYes(i8* bitcast ({ i64, [11 x i8] }* @.str.23 to i8*))
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %if.end ], [ %4, %lor.rhs ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i1 %5
}

define noundef nonnull align 8 dereferenceable(2) %struct.Style* @nish.styleFor(i32 noundef %fd, i1 noundef zeroext %agent) #1 {
entry:
  %level.addr = alloca i8*, align 8
  %term.addr = alloca i8*, align 8
  %0 = call i8* @nish_getenv(i8* bitcast ({ i64, [12 x i8] }* @.str.24 to i8*))
  store i8* %0, i8** %level.addr, align 8
  %1 = call i1 @nish.envIsSet(i8* bitcast ({ i64, [9 x i8] }* @.str.25 to i8*))
  br i1 %1, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %agent, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = load i8*, i8** %level.addr, align 8
  %4 = call i1 @nish.saysNo(i8* %3)
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %lor.end.1 ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = call i8* @nish_alloc_struct(i64 2)
  %7 = bitcast i8* %6 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %7, i1 false, i1 false)
  ret %struct.Style* %7

if.end:
  %8 = load i8*, i8** %level.addr, align 8
  %9 = call i1 @nish.saysYes(i8* %8)
  br i1 %9, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %10 = call i1 @nish.envSaysYes(i8* bitcast ({ i64, [15 x i8] }* @.str.26 to i8*))
  br label %lor.end.2

lor.end.2:
  %11 = phi i1 [ true, %if.end ], [ %10, %lor.rhs.2 ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = call i8* @nish_alloc_struct(i64 2)
  %13 = bitcast i8* %12 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %13, i1 true, i1 true)
  ret %struct.Style* %13

if.end.1:
  %14 = call i8* @nish_getenv(i8* bitcast ({ i64, [5 x i8] }* @.str.27 to i8*))
  store i8* %14, i8** %term.addr, align 8
  %15 = call i1 @nish.envSaysNo(i8* bitcast ({ i64, [9 x i8] }* @.str.28 to i8*))
  br i1 %15, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %16 = load i8*, i8** %term.addr, align 8
  %17 = icmp ne i8* %16, null
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i8*, i8** %term.addr, align 8
  %19 = call zeroext i1 @nish_str_eq(i8* %18, i8* bitcast ({ i64, [5 x i8] }* @.str.29 to i8*))
  br label %land.end

land.end:
  %20 = phi i1 [ false, %lor.rhs.3 ], [ %19, %land.rhs ]
  br label %lor.end.3

lor.end.3:
  %21 = phi i1 [ true, %if.end.1 ], [ %20, %land.end ]
  br i1 %21, label %if.then.2, label %if.end.2

if.then.2:
  %22 = call i8* @nish_alloc_struct(i64 2)
  %23 = bitcast i8* %22 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %23, i1 false, i1 false)
  ret %struct.Style* %23

if.end.2:
  %24 = call i32 @nish.paletteOf(i32 %fd)
  %25 = tail call %struct.Style* @nish.styleOfPalette(i32 %24)
  ret %struct.Style* %25
}

define internal noundef nonnull align 8 i8* @nish.spaces(i32 noundef %count) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = icmp sle i32 %count, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*)

if.end:
  %1 = bitcast i8* bitcast ({ i64, [81 x i8] }* @.str.30 to i8*) to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sle i32 %count, %3
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = bitcast i8* bitcast ({ i64, [81 x i8] }* @.str.30 to i8*) to i64*
  %6 = load i64, i64* %5, align 8
  %7 = sext i32 %count to i64
  %8 = call i64 @llvm.smin.i64(i64 %7, i64 %6)
  %9 = call i64 @llvm.smax.i64(i64 %8, i64 0)
  %10 = call i64 @llvm.smin.i64(i64 0, i64 %9)
  %11 = call i64 @llvm.smax.i64(i64 0, i64 %9)
  %12 = sub i64 %11, %10
  %13 = getelementptr inbounds i8, i8* bitcast ({ i64, [81 x i8] }* @.str.30 to i8*), i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %10
  %15 = call i8* @nish_str_new(i8* %14, i64 %12)
  ret i8* %15

if.end.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %19 = load i32, i32* %i.addr, align 4
  %20 = icmp slt i32 %19, %count
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i8** %30, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = trunc i64 %31 to i32
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*) to i64*
  %39 = load i64, i64* %38, align 8
  %40 = sub i64 %37, 1
  %41 = mul i64 %39, %40
  %42 = icmp eq i64 %37, 0
  %43 = select i1 %42, i64 0, i64 %41
  store i64 %43, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %44 = load i64, i64* %join.at, align 8
  %45 = icmp ult i64 %44, %37
  br i1 %45, label %join.sum.body, label %join.copy

join.sum.body:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %48 = bitcast i8* %47 to i8**
  %49 = getelementptr inbounds i8*, i8** %48, i64 %44
  %50 = load i8*, i8** %49, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %51 = load i64, i64* %join.total, align 8
  %52 = bitcast i8* %50 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = add i64 %51, %53
  store i64 %54, i64* %join.total, align 8
  %55 = add i64 %44, 1
  store i64 %55, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %56 = load i64, i64* %join.total, align 8
  %57 = icmp ugt i64 %56, 2147483647
  %58 = add i64 %56, 9
  %59 = select i1 %57, i64 4611686018427387904, i64 %58
  %60 = call i8* @nish_alloc_struct(i64 %59)
  %61 = bitcast i8* %60 to i64*
  store i64 %56, i64* %61, align 8
  %62 = getelementptr inbounds i8, i8* %60, i64 8
  store i8* %62, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %63 = load i64, i64* %join.at, align 8
  %64 = icmp ult i64 %63, %37
  br i1 %64, label %join.part, label %join.end

join.part:
  %65 = load i8*, i8** %join.p, align 8
  %66 = icmp eq i64 %63, 0
  %67 = select i1 %66, i64 0, i64 %39
  %68 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %65, i8* %68, i64 %67, i1 false)
  %69 = getelementptr inbounds i8, i8* %65, i64 %67
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %72 = bitcast i8* %71 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %63
  %74 = load i8*, i8** %73, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %75 = bitcast i8* %74 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = getelementptr inbounds i8, i8* %74, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %69, i8* %77, i64 %76, i1 false)
  %78 = getelementptr inbounds i8, i8* %69, i64 %76
  store i8* %78, i8** %join.p, align 8
  %79 = add i64 %63, 1
  store i64 %79, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %80 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %80, align 1
  ret i8* %60
}

define internal noundef nonnull align 8 i8* @nish.padTo(i32 noundef %width, i32 noundef %column) #1 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %width, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = icmp sle i32 %1, %column
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %column, i32 %width)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %7 = phi i32 [ %5, %ovf.ok.1 ], [ 2, %cond.false ]
  %8 = call i64 @nish_arena_mark()
  %9 = call i8* @nish.spaces(i32 %7)
  %10 = call i8* @nish_arena_keep(i64 %8, i8* %9)
  ret i8* %10

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %cond.true ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.HelpMenu.constructor(%struct.HelpMenu* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this, %struct.Style* noundef nonnull align 8 dereferenceable(2) %style, i8* noundef nonnull noalias readonly align 8 %program, i32 noundef %column, i32 noundef %usageColumn) #0 {
entry:
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  store %struct.Style* %style, %struct.Style** %0, align 8, !tbaa !22
  %1 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 1
  store i8* %program, i8** %1, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 2
  store i32 %column, i32* %2, align 4, !tbaa !24
  %3 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 3
  store i32 %usageColumn, i32* %3, align 4, !tbaa !25
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  store %struct.nish_array* %5, %struct.nish_array** %9, align 8, !tbaa !26
  %10 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 5
  store i32 0, i32* %10, align 4, !tbaa !27
  ret void
}

define void @nish.HelpMenu.header(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %version, i8* noundef nonnull noalias readonly align 8 %summary) #1 {
entry:
  %style.addr = alloca %struct.Style*, align 8
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %1 = load %struct.Style*, %struct.Style** %0, align 8, !tbaa !22
  store %struct.Style* %1, %struct.Style** %style.addr, align 8
  %2 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !26
  %4 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %5 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 1
  %6 = load i8*, i8** %5, align 8, !tbaa !23
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @nish.Style.name(%struct.Style* %4, i8* %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %11 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @nish.Style.dim(%struct.Style* %11, i8* %version)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  %15 = call i8* @nish_str_concat(i8* %10, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [3 x i8] }* @.str.32 to i8*))
  %17 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %18 = call i64 @nish_arena_mark()
  %19 = call i8* @nish.Style.dim(%struct.Style* %17, i8* %summary)
  %20 = call i8* @nish_arena_keep(i64 %18, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %16, i8* %20)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %21, i8** %30, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = trunc i64 %31 to i32
  %33 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !26
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*), i8** %43, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = trunc i64 %44 to i32
  ret void
}

define void @nish.HelpMenu.usage(%struct.HelpMenu* noundef nonnull align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %shape, i8* noundef nonnull noalias readonly align 8 %description) #1 {
entry:
  %style.addr = alloca %struct.Style*, align 8
  %lead.addr = alloca i8*, align 8
  %width.addr = alloca i32, align 4
  %text.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %1 = load %struct.Style*, %struct.Style** %0, align 8, !tbaa !22
  store %struct.Style* %1, %struct.Style** %style.addr, align 8
  %2 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 5
  %3 = load i32, i32* %2, align 4, !tbaa !27
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.Style.heading(%struct.Style* %5, i8* bitcast ({ i64, [7 x i8] }* @.str.33 to i8*))
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  br label %cond.end

cond.false:
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @nish.spaces(i32 7)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  br label %cond.end

cond.end:
  %13 = phi i8* [ %9, %cond.true ], [ %12, %cond.false ]
  store i8* %13, i8** %lead.addr, align 8
  %14 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 1
  %15 = load i8*, i8** %14, align 8, !tbaa !23
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 8, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  %22 = bitcast i8* %shape to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %26, i32* %width.addr, align 4
  %28 = bitcast i8* %description to i64*
  %29 = load i64, i64* %28, align 8
  %30 = trunc i64 %29 to i32
  %31 = icmp sgt i32 %30, 0
  br i1 %31, label %cond.true.1, label %cond.false.1

cond.true.1:
  %32 = load i32, i32* %width.addr, align 4
  %33 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 3
  %34 = load i32, i32* %33, align 4, !tbaa !25
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @nish.padTo(i32 %32, i32 %34)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  %38 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %39 = call i64 @nish_arena_mark()
  %40 = call i8* @nish.Style.dim(%struct.Style* %38, i8* %description)
  %41 = call i8* @nish_arena_keep(i64 %39, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %37, i8* %41)
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %43 = phi i8* [ %42, %cond.true.1 ], [ bitcast ({ i64, [1 x i8] }* @.str.9 to i8*), %cond.false.1 ]
  store i8* %43, i8** %text.addr, align 8
  %44 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %45 = load %struct.nish_array*, %struct.nish_array** %44, align 8, !tbaa !26
  %46 = load i8*, i8** %lead.addr, align 8
  %47 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %48 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 1
  %49 = load i8*, i8** %48, align 8, !tbaa !23
  %50 = call i64 @nish_arena_mark()
  %51 = call i8* @nish.Style.name(%struct.Style* %47, i8* %49)
  %52 = call i8* @nish_arena_keep(i64 %50, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %46, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %55 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @nish.Style.flag(%struct.Style* %55, i8* %shape)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %54, i8* %58)
  %60 = load i8*, i8** %text.addr, align 8
  %61 = call i8* @nish_str_concat(i8* %59, i8* %60)
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  %65 = load i64, i64* %64, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %66 = icmp eq i64 %63, %65
  br i1 %66, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %45, i64 8)
  br label %push.store

push.store:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %69 = bitcast i8* %68 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 %63
  store i8* %61, i8** %70, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %71 = add i64 %63, 1
  store i64 %71, i64* %62, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %72 = trunc i64 %71 to i32
  %73 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 5
  %74 = load i32, i32* %73, align 4, !tbaa !27
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 1)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %78 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 5
  store i32 %76, i32* %78, align 4, !tbaa !27
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.HelpMenu.section(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %title) #1 {
entry:
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 %3
  store i8* bitcast ({ i64, [1 x i8] }* @.str.9 to i8*), i8** %10, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = trunc i64 %11 to i32
  %13 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !26
  %15 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %16 = load %struct.Style*, %struct.Style** %15, align 8, !tbaa !22
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @nish.Style.heading(%struct.Style* %16, i8* %title)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  store i8* %19, i8** %28, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = trunc i64 %29 to i32
  ret void
}

define void @nish.HelpMenu.row(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %flag, i8* noundef nonnull noalias readonly align 8 %meta, i8* noundef nonnull noalias readonly align 8 %description) #1 {
entry:
  %style.addr = alloca %struct.Style*, align 8
  %width.addr = alloca i32, align 4
  %placeholder.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %1 = load %struct.Style*, %struct.Style** %0, align 8, !tbaa !22
  store %struct.Style* %1, %struct.Style** %style.addr, align 8
  %2 = bitcast i8* %flag to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast i8* %meta to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = icmp sgt i32 %10, 0
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = bitcast i8* %meta to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 1, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %18 = phi i32 [ %16, %ovf.ok.1 ], [ 0, %cond.false ]
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %20, i32* %width.addr, align 4
  %22 = bitcast i8* %meta to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  %25 = icmp sgt i32 %24, 0
  br i1 %25, label %cond.true.1, label %cond.false.1

cond.true.1:
  %26 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @nish.Style.meta(%struct.Style* %26, i8* %meta)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i8* %29)
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %31 = phi i8* [ %30, %cond.true.1 ], [ bitcast ({ i64, [1 x i8] }* @.str.9 to i8*), %cond.false.1 ]
  store i8* %31, i8** %placeholder.addr, align 8
  %32 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !26
  %34 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @nish.Style.flag(%struct.Style* %34, i8* %flag)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  %38 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.32 to i8*), i8* %37)
  %39 = load i8*, i8** %placeholder.addr, align 8
  %40 = call i8* @nish_str_concat(i8* %38, i8* %39)
  %41 = load i32, i32* %width.addr, align 4
  %42 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 2
  %43 = load i32, i32* %42, align 4, !tbaa !24
  %44 = call i64 @nish_arena_mark()
  %45 = call i8* @nish.padTo(i32 %41, i32 %43)
  %46 = call i8* @nish_arena_keep(i64 %44, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %40, i8* %46)
  %48 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @nish.Style.dim(%struct.Style* %48, i8* %description)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %47, i8* %51)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %56 = load i64, i64* %55, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %57 = icmp eq i64 %54, %56
  br i1 %57, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %33, i64 8)
  br label %push.store

push.store:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %60 = bitcast i8* %59 to i8**
  %61 = getelementptr inbounds i8*, i8** %60, i64 %54
  store i8* %52, i8** %61, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %62 = add i64 %54, 1
  store i64 %62, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %63 = trunc i64 %62 to i32
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.HelpMenu.note(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %3 = load %struct.Style*, %struct.Style** %2, align 8, !tbaa !22
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @nish.Style.dim(%struct.Style* %3, i8* %text)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.32 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %18 = trunc i64 %17 to i32
  ret void
}

define void @nish.HelpMenu.value(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 0
  %3 = load %struct.Style*, %struct.Style** %2, align 8, !tbaa !22
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @nish.Style.meta(%struct.Style* %3, i8* %text)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.32 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %18 = trunc i64 %17 to i32
  ret void
}

define noundef nonnull align 8 i8* @nish.HelpMenu.text(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.HelpMenu, %struct.HelpMenu* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.34 to i8*) to i64*
  %5 = load i64, i64* %4, align 8
  %6 = sub i64 %3, 1
  %7 = mul i64 %5, %6
  %8 = icmp eq i64 %3, 0
  %9 = select i1 %8, i64 0, i64 %7
  store i64 %9, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %10 = load i64, i64* %join.at, align 8
  %11 = icmp ult i64 %10, %3
  br i1 %11, label %join.sum.body, label %join.copy

join.sum.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %10
  %16 = load i8*, i8** %15, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %17 = load i64, i64* %join.total, align 8
  %18 = bitcast i8* %16 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = add i64 %17, %19
  store i64 %20, i64* %join.total, align 8
  %21 = add i64 %10, 1
  store i64 %21, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %22 = load i64, i64* %join.total, align 8
  %23 = icmp ugt i64 %22, 2147483647
  %24 = add i64 %22, 9
  %25 = select i1 %23, i64 4611686018427387904, i64 %24
  %26 = call i8* @nish_alloc_struct(i64 %25)
  %27 = bitcast i8* %26 to i64*
  store i64 %22, i64* %27, align 8
  %28 = getelementptr inbounds i8, i8* %26, i64 8
  store i8* %28, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %29 = load i64, i64* %join.at, align 8
  %30 = icmp ult i64 %29, %3
  br i1 %30, label %join.part, label %join.end

join.part:
  %31 = load i8*, i8** %join.p, align 8
  %32 = icmp eq i64 %29, 0
  %33 = select i1 %32, i64 0, i64 %5
  %34 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.34 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %31, i8* %34, i64 %33, i1 false)
  %35 = getelementptr inbounds i8, i8* %31, i64 %33
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %29
  %40 = load i8*, i8** %39, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %41 = bitcast i8* %40 to i64*
  %42 = load i64, i64* %41, align 8
  %43 = getelementptr inbounds i8, i8* %40, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %35, i8* %43, i64 %42, i1 false)
  %44 = getelementptr inbounds i8, i8* %35, i64 %42
  store i8* %44, i8** %join.p, align 8
  %45 = add i64 %29, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %46 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %46, align 1
  ret i8* %26
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"Style", !2, i64 0, !2, i64 1}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 1}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"ptr", !1, i64 0}
!20 = !{!"i32", !1, i64 0}
!21 = !{!"HelpMenu", !19, i64 0, !19, i64 8, !20, i64 16, !20, i64 20, !19, i64 24, !20, i64 32}
!22 = !{!21, !19, i64 0}
!23 = !{!21, !19, i64 8}
!24 = !{!21, !20, i64 16}
!25 = !{!21, !20, i64 20}
!26 = !{!21, !19, i64 24}
!27 = !{!21, !20, i64 32}
