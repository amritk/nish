%struct.Rlimit = type { i64, i64 }
%struct.Timespec = type { i64, i64 }
%struct.Stamp = type { i8, %struct.Timespec, i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare i32 @getrlimit(i32, %struct.Rlimit*)
declare i32 @setrlimit(i32, %struct.Rlimit*)
declare i32 @clock_gettime(i32, %struct.Timespec*)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
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
  %0 = bitcast %struct.Rlimit* %Rlimit.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 16, i1 false)
  store %struct.Rlimit* %Rlimit.obj, %struct.Rlimit** %limit.addr, align 8
  %1 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %2 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %1, i32 0, i32 0
  %3 = load i64, i64* %2, align 8
  %4 = icmp eq i64 %3, 0
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %7 = call i32 @getrlimit(i32 7, %struct.Rlimit* %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %10 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %9, i32 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = icmp ugt i64 %11, 0
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %14 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %13, i32 0, i32 0
  %15 = load i64, i64* %14, align 8
  %16 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %17 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %16, i32 0, i32 1
  %18 = load i64, i64* %17, align 8
  %19 = icmp ule i64 %15, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %entry ], [ %19, %land.rhs ]
  %21 = select i1 %20, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %21)
  %22 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %23 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %22, i32 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ugt i64 %24, 64
  br i1 %25, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %26 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %27 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %26, i32 0, i32 0
  %28 = load i64, i64* %27, align 8
  br label %cond.end

cond.end:
  %29 = phi i64 [ 64, %cond.true ], [ %28, %cond.false ]
  store i64 %29, i64* %soft.addr, align 8
  %30 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %31 = load i64, i64* %soft.addr, align 8
  %32 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %30, i32 0, i32 0
  store i64 %31, i64* %32, align 8
  %33 = load %struct.Rlimit*, %struct.Rlimit** %limit.addr, align 8
  %34 = call i32 @setrlimit(i32 7, %struct.Rlimit* %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = bitcast %struct.Rlimit* %Rlimit.obj.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %36, i8 0, i64 16, i1 false)
  store %struct.Rlimit* %Rlimit.obj.1, %struct.Rlimit** %back.addr, align 8
  %37 = load %struct.Rlimit*, %struct.Rlimit** %back.addr, align 8
  %38 = call i32 @getrlimit(i32 7, %struct.Rlimit* %37)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = load %struct.Rlimit*, %struct.Rlimit** %back.addr, align 8
  %41 = getelementptr inbounds %struct.Rlimit, %struct.Rlimit* %40, i32 0, i32 0
  %42 = load i64, i64* %41, align 8
  %43 = load i64, i64* %soft.addr, align 8
  %44 = icmp eq i64 %42, %43
  %45 = select i1 %44, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %45)
  %46 = bitcast %struct.Stamp* %Stamp.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %46, i8 0, i64 32, i1 false)
  store %struct.Stamp* %Stamp.obj, %struct.Stamp** %stamp.addr, align 8
  %47 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %48 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %47, i32 0, i32 0
  store i8 7, i8* %48, align 1
  %49 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %50 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %49, i32 0, i32 2
  store i32 42, i32* %50, align 4
  %51 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %52 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %51, i32 0, i32 1
  %53 = call i32 @clock_gettime(i32 1, %struct.Timespec* %52)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = bitcast %struct.Timespec* %Timespec.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %55, i8 0, i64 16, i1 false)
  store %struct.Timespec* %Timespec.obj, %struct.Timespec** %later.addr, align 8
  %56 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %57 = call i32 @clock_gettime(i32 1, %struct.Timespec* %56)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %60 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %59, i32 0, i32 0
  %61 = load i64, i64* %60, align 8
  %62 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %63 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %62, i32 0, i32 1
  %64 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %63, i32 0, i32 0
  %65 = load i64, i64* %64, align 8
  %66 = icmp sgt i64 %61, %65
  br i1 %66, label %lor.end, label %lor.rhs

lor.rhs:
  %67 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %68 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %67, i32 0, i32 0
  %69 = load i64, i64* %68, align 8
  %70 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %71 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %70, i32 0, i32 1
  %72 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %71, i32 0, i32 0
  %73 = load i64, i64* %72, align 8
  %74 = icmp eq i64 %69, %73
  br i1 %74, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %75 = load %struct.Timespec*, %struct.Timespec** %later.addr, align 8
  %76 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %75, i32 0, i32 1
  %77 = load i64, i64* %76, align 8
  %78 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %79 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %78, i32 0, i32 1
  %80 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %79, i32 0, i32 1
  %81 = load i64, i64* %80, align 8
  %82 = icmp sge i64 %77, %81
  br label %land.end.1

land.end.1:
  %83 = phi i1 [ false, %lor.rhs ], [ %82, %land.rhs.1 ]
  br label %lor.end

lor.end:
  %84 = phi i1 [ true, %cond.end ], [ %83, %land.end.1 ]
  %85 = select i1 %84, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %85)
  %86 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %87 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %86, i32 0, i32 1
  %88 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %87, i32 0, i32 1
  %89 = load i64, i64* %88, align 8
  %90 = icmp sge i64 %89, 0
  br i1 %90, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %91 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %92 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %91, i32 0, i32 1
  %93 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %92, i32 0, i32 1
  %94 = load i64, i64* %93, align 8
  %95 = icmp slt i64 %94, 1000000000
  br label %land.end.2

land.end.2:
  %96 = phi i1 [ false, %lor.end ], [ %95, %land.rhs.2 ]
  %97 = select i1 %96, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %97)
  %98 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %99 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %98, i32 0, i32 0
  %100 = load i8, i8* %99, align 1
  %101 = zext i8 %100 to i64
  %102 = call i8* @nish_str_from_u64(i64 %101)
  call void @nish_print(i8* %102)
  %103 = load %struct.Stamp*, %struct.Stamp** %stamp.addr, align 8
  %104 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %103, i32 0, i32 2
  %105 = load i32, i32* %104, align 4
  %106 = call i8* @nish_str_from_i32(i32 %105)
  call void @nish_print(i8* %106)
  %107 = bitcast %struct.Timespec* %Timespec.obj.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %107, i8 0, i64 16, i1 false)
  store %struct.Timespec* %Timespec.obj.1, %struct.Timespec** %lent.addr, align 8
  %108 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %109 = call i32 @readClock(%struct.Timespec* %108)
  %110 = call i8* @nish_str_from_i32(i32 %109)
  call void @nish_print(i8* %110)
  %111 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %112 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %111, i32 0, i32 0
  %113 = load i64, i64* %112, align 8
  %114 = icmp sgt i64 %113, 0
  br i1 %114, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %115 = load %struct.Timespec*, %struct.Timespec** %lent.addr, align 8
  %116 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %115, i32 0, i32 1
  %117 = load i64, i64* %116, align 8
  %118 = icmp sgt i64 %117, 0
  br label %lor.end.1

lor.end.1:
  %119 = phi i1 [ true, %land.end.2 ], [ %118, %lor.rhs.1 ]
  %120 = select i1 %119, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %120)
  %121 = bitcast %struct.Stamp* %Stamp.obj.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %121, i8 0, i64 32, i1 false)
  store %struct.Stamp* %Stamp.obj.1, %struct.Stamp** %relayed.addr, align 8
  %122 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %123 = call i32 @readStamp(%struct.Stamp* %122)
  %124 = call i8* @nish_str_from_i32(i32 %123)
  call void @nish_print(i8* %124)
  %125 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %126 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %125, i32 0, i32 1
  %127 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %126, i32 0, i32 0
  %128 = load i64, i64* %127, align 8
  %129 = icmp sgt i64 %128, 0
  br i1 %129, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %130 = load %struct.Stamp*, %struct.Stamp** %relayed.addr, align 8
  %131 = getelementptr inbounds %struct.Stamp, %struct.Stamp* %130, i32 0, i32 1
  %132 = getelementptr inbounds %struct.Timespec, %struct.Timespec* %131, i32 0, i32 1
  %133 = load i64, i64* %132, align 8
  %134 = icmp sgt i64 %133, 0
  br label %lor.end.2

lor.end.2:
  %135 = phi i1 [ true, %lor.end.1 ], [ %134, %lor.rhs.2 ]
  %136 = select i1 %135, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %136)
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
