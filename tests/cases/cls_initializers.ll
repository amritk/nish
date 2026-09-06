%struct.Defaults = type { i32, i32, i1, i8* }
%struct.Mixed = type { i32, i32, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mixed\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Mixed.constructor(%struct.Mixed* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %limit) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %1, align 8
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 1
  store i32 %limit, i32* %2, align 4
  %3 = icmp sgt i32 %limit, 100
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %4, align 8
  br label %if.end

if.end:
  ret void
}

define noundef i32 @sts_main() #0 {
entry:
  %d.addr = alloca %struct.Defaults*, align 8
  %m.addr = alloca %struct.Mixed*, align 8
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Defaults*
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 0
  store i32 42, i32* %2, align 4
  %3 = sub i32 0, 1
  %4 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 2
  store i1 true, i1* %5, align 1
  %6 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %6, align 8
  store %struct.Defaults* %1, %struct.Defaults** %d.addr, align 8
  %7 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %8 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %11 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %9, %12
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %16 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %15, i32 0, i32 2
  %17 = load i1, i1* %16, align 1
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @sts_print(i8* %18)
  %19 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %20 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %19, i32 0, i32 3
  %21 = load i8*, i8** %20, align 8
  call void @sts_print(i8* %21)
  %22 = call i8* @sts_alloc_struct(i64 16)
  %23 = bitcast i8* %22 to %struct.Mixed*
  call void @Mixed.constructor(%struct.Mixed* %23, i32 500)
  store %struct.Mixed* %23, %struct.Mixed** %m.addr, align 8
  %24 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %25 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4
  %27 = call i8* @sts_str_from_i32(i32 %26)
  call void @sts_print(i8* %27)
  %28 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %29 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %28, i32 0, i32 1
  %30 = load i32, i32* %29, align 4
  %31 = call i8* @sts_str_from_i32(i32 %30)
  call void @sts_print(i8* %31)
  %32 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %33 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %32, i32 0, i32 2
  %34 = load i8*, i8** %33, align 8
  call void @sts_print(i8* %34)
  %35 = call i8* @sts_alloc_struct(i64 16)
  %36 = bitcast i8* %35 to %struct.Mixed*
  call void @Mixed.constructor(%struct.Mixed* %36, i32 1)
  %37 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %36, i32 0, i32 2
  %38 = load i8*, i8** %37, align 8
  call void @sts_print(i8* %38)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
