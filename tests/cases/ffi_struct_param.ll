%struct.Rlimit = type { i64, i64 }
%struct.Timespec = type { i64, i64 }
%struct.Stamp = type { i8, %struct.Timespec, i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare i32 @getrlimit(i32, %struct.Rlimit*)
declare i32 @setrlimit(i32, %struct.Rlimit*)
declare i32 @clock_gettime(i32, %struct.Timespec*)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define internal noundef i32 @readClock(%struct.Timespec* noundef nonnull align 8 dereferenceable(16) nocapture %ts) #0 {
entry:
  %0 = call i32 @clock_gettime(i32 1, %struct.Timespec* %ts)
  ret i32 %0
}

define internal noundef i32 @readStamp(%struct.Stamp* noundef nonnull align 8 dereferenceable(32) nocapture %stamp) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %stamp, i32 0, i32 1
  %1 = call i32 @clock_gettime(i32 1, %struct.Timespec* %0)
  ret i32 %1
}

define noundef i32 @nish_main() #0 {
entry:
  %limit.addr = alloca %struct.Rlimit*, align 8
  %Rlimit.obj = alloca %struct.Rlimit, align 8
  %soft.addr = alloca i64, align 8
  %back.addr = alloca %struct.Rlimit*, align 8
  %Rlimit.obj.1 = alloca %struct.Rlimit, align 8
  %stamp.addr = alloca %struct.Stamp*, align 8
  %Stamp.obj = alloca %struct.Stamp, align 8
  %later.addr = alloca %struct.Timespec*, align 8
  %Timespec.obj = alloca %struct.Timespec, align 8
  %lent.addr = alloca %struct.Timespec*, align 8
  %Timespec.obj.1 = alloca %struct.Timespec, align 8
  %relayed.addr = alloca %struct.Stamp*, align 8
  %Stamp.obj.1 = alloca %struct.Stamp, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store %struct.Rlimit zeroinitializer, %struct.Rlimit* %Rlimit.obj, align 8
  store %struct.Rlimit* %Rlimit.obj, %struct.Rlimit** %limit.addr, align 8
  %0 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %1 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %0, i32 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp eq i64 %2, 0
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %4)
  %5 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %6 = call i32 @getrlimit(i32 7, %struct.Rlimit* %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %9 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %8, i32 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = icmp ugt i64 %10, 0
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %13 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %12, i32 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %16 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %15, i32 0, i32 1
  %17 = load i64, i64* %16, align 8
  %18 = icmp ule i64 %14, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %entry ], [ %18, %land.rhs ]
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %20)
  %21 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %22 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %21, i32 0, i32 0
  %23 = load i64, i64* %22, align 8
  %24 = icmp ugt i64 %23, 64
  br i1 %24, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %25 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %26 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %25, i32 0, i32 0
  %27 = load i64, i64* %26, align 8
  br label %cond.end

cond.end:
  %28 = phi i64 [ 64, %cond.true ], [ %27, %cond.false ]
  store i64 %28, i64* %soft.addr, align 8
  %29 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %30 = load i64, i64* %soft.addr, align 8
  %31 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %29, i32 0, i32 0
  store i64 %30, i64* %31, align 8
  %32 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %33 = call i32 @setrlimit(i32 7, %struct.Rlimit* %32)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  store %struct.Rlimit zeroinitializer, %struct.Rlimit* %Rlimit.obj.1, align 8
  store %struct.Rlimit* %Rlimit.obj.1, %struct.Rlimit** %back.addr, align 8
  %35 = load %struct.Rlimit*, %struct.Rlimit** %back.addr, align 8
  %36 = call i32 @getrlimit(i32 7, %struct.Rlimit* %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = load %struct.Rlimit*, %struct.Rlimit** %back.addr, align 8
  %39 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %38, i32 0, i32 0
  %40 = load i64, i64* %39, align 8
  %41 = load i64, i64* %soft.addr, align 8
  %42 = icmp eq i64 %40, %41
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %43)
  store %struct.Stamp zeroinitializer, %struct.Stamp* %Stamp.obj, align 8
  store %struct.Stamp* %Stamp.obj, %struct.Stamp** %stamp.addr, align 8
  %44 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %45 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %44, i32 0, i32 0
  store i8 7, i8* %45, align 1
  %46 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %47 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %46, i32 0, i32 2
  store i32 42, i32* %47, align 4
  %48 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %49 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %48, i32 0, i32 1
  %50 = call i32 @clock_gettime(i32 1, %struct.Timespec* %49)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  call void @nish_print(i8* %51)
  store %struct.Timespec zeroinitializer, %struct.Timespec* %Timespec.obj, align 8
  store %struct.Timespec* %Timespec.obj, %struct.Timespec** %later.addr, align 8
  %52 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %53 = call i32 @clock_gettime(i32 1, %struct.Timespec* %52)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %56 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %55, i32 0, i32 0
  %57 = load i64, i64* %56, align 8
  %58 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %59 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %58, i32 0, i32 1
  %60 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %59, i32 0, i32 0
  %61 = load i64, i64* %60, align 8
  %62 = icmp sgt i64 %57, %61
  br i1 %62, label %lor.end, label %lor.rhs

lor.rhs:
  %63 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %64 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %63, i32 0, i32 0
  %65 = load i64, i64* %64, align 8
  %66 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %67 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %66, i32 0, i32 1
  %68 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %67, i32 0, i32 0
  %69 = load i64, i64* %68, align 8
  %70 = icmp eq i64 %65, %69
  br i1 %70, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %71 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %72 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %71, i32 0, i32 1
  %73 = load i64, i64* %72, align 8
  %74 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %75 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %74, i32 0, i32 1
  %76 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %75, i32 0, i32 1
  %77 = load i64, i64* %76, align 8
  %78 = icmp sge i64 %73, %77
  br label %land.end.1

land.end.1:
  %79 = phi i1 [ false, %lor.rhs ], [ %78, %land.rhs.1 ]
  br label %lor.end

lor.end:
  %80 = phi i1 [ true, %cond.end ], [ %79, %land.end.1 ]
  %81 = select i1 %80, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %81)
  %82 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %83 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %82, i32 0, i32 1
  %84 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %83, i32 0, i32 1
  %85 = load i64, i64* %84, align 8
  %86 = icmp sge i64 %85, 0
  br i1 %86, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %87 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %88 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %87, i32 0, i32 1
  %89 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %88, i32 0, i32 1
  %90 = load i64, i64* %89, align 8
  %91 = icmp slt i64 %90, 1000000000
  br label %land.end.2

land.end.2:
  %92 = phi i1 [ false, %lor.end ], [ %91, %land.rhs.2 ]
  %93 = select i1 %92, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %93)
  %94 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %95 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %94, i32 0, i32 0
  %96 = load i8, i8* %95, align 1
  %97 = zext i8 %96 to i64
  %98 = call i8* @nish_str_from_u64(i64 %97)
  call void @nish_print(i8* %98)
  %99 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %100 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %99, i32 0, i32 2
  %101 = load i32, i32* %100, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  call void @nish_print(i8* %102)
  store %struct.Timespec zeroinitializer, %struct.Timespec* %Timespec.obj.1, align 8
  store %struct.Timespec* %Timespec.obj.1, %struct.Timespec** %lent.addr, align 8
  %103 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %104 = call i32 @readClock(%struct.Timespec* %103)
  %105 = call i8* @nish_str_from_i32(i32 %104)
  call void @nish_print(i8* %105)
  %106 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %107 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %106, i32 0, i32 0
  %108 = load i64, i64* %107, align 8
  %109 = icmp sgt i64 %108, 0
  br i1 %109, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %110 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %111 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %110, i32 0, i32 1
  %112 = load i64, i64* %111, align 8
  %113 = icmp sgt i64 %112, 0
  br label %lor.end.1

lor.end.1:
  %114 = phi i1 [ true, %land.end.2 ], [ %113, %lor.rhs.1 ]
  %115 = select i1 %114, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %115)
  store %struct.Stamp zeroinitializer, %struct.Stamp* %Stamp.obj.1, align 8
  store %struct.Stamp* %Stamp.obj.1, %struct.Stamp** %relayed.addr, align 8
  %116 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %117 = call i32 @readStamp(%struct.Stamp* %116)
  %118 = call i8* @nish_str_from_i32(i32 %117)
  call void @nish_print(i8* %118)
  %119 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %120 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %119, i32 0, i32 1
  %121 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %120, i32 0, i32 0
  %122 = load i64, i64* %121, align 8
  %123 = icmp sgt i64 %122, 0
  br i1 %123, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %124 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %125 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %124, i32 0, i32 1
  %126 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %125, i32 0, i32 1
  %127 = load i64, i64* %126, align 8
  %128 = icmp sgt i64 %127, 0
  br label %lor.end.2

lor.end.2:
  %129 = phi i1 [ true, %lor.end.1 ], [ %128, %lor.rhs.2 ]
  %130 = select i1 %129, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %130)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
