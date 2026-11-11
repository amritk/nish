%struct.Base = type { i64, i8*, i32 }
%struct.Point = type { i64, i8*, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define noundef nonnull align 8 dereferenceable(24) %struct.Point* @moved(%struct.Base* noundef nonnull readonly align 8 dereferenceable(24) nocapture %b) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Point*
  %2 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 0
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 0
  store i64 %3, i64* %4, align 8
  %5 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 1
  %6 = load i8*, i8** %5, align 8
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 1
  store i8* %6, i8** %7, align 8
  %8 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 2
  %9 = load i32, i32* %8, align 4
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 2
  store i32 %9, i32* %10, align 4
  %11 = getelementptr inbounds %struct.Point, %struct.Point* %1, i32 0, i32 3
  store i32 1, i32* %11, align 4
  ret %struct.Point* %1
}

define noundef i32 @firstX(%struct.Base* noundef nonnull readonly align 8 dereferenceable(24) nocapture %b) #1 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %0 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i64 %1, i64* %2, align 8
  %3 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8
  %5 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i8* %4, i8** %5, align 8
  %6 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 2
  %7 = load i32, i32* %6, align 4
  %8 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 2
  store i32 %7, i32* %8, align 4
  %9 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 3
  store i32 1, i32* %9, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %10 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %11 = getelementptr inbounds %struct.Point, %struct.Point* %10, i32 0, i32 2
  %12 = load i32, i32* %11, align 4
  ret i32 %12
}

define void @nish_main() #2 {
entry:
  %b.addr = alloca %struct.Base*, align 8
  %Base.obj = alloca %struct.Base, align 8
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %f.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Base, %struct.Base* %Base.obj, i32 0, i32 2
  store i32 1, i32* %0, align 4
  %1 = sext i32 2 to i64
  %2 = getelementptr inbounds %struct.Base, %struct.Base* %Base.obj, i32 0, i32 0
  store i64 %1, i64* %2, align 8
  %3 = getelementptr inbounds %struct.Base, %struct.Base* %Base.obj, i32 0, i32 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %3, align 8
  store %struct.Base* %Base.obj, %struct.Base** %b.addr, align 8
  %4 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %5 = getelementptr inbounds %struct.Base, %struct.Base* %4, i32 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i64 %6, i64* %7, align 8
  %8 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %9 = getelementptr inbounds %struct.Base, %struct.Base* %8, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8
  %11 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i8* %10, i8** %11, align 8
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 2
  store i32 10, i32* %12, align 4
  %13 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 3
  store i32 3, i32* %13, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %14 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %15 = call %struct.Point* @moved(%struct.Base* %14)
  store %struct.Point* %15, %struct.Point** %q.addr, align 8
  %16 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %17 = call i32 @firstX(%struct.Base* %16)
  store i32 %17, i32* %f.addr, align 4
  %18 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %19 = getelementptr inbounds %struct.Point, %struct.Point* %18, i32 0, i32 2
  %20 = load i32, i32* %19, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %23 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %24 = getelementptr inbounds %struct.Point, %struct.Point* %23, i32 0, i32 0
  %25 = load i64, i64* %24, align 8
  %26 = call i8* @nish_str_from_i64(i64 %25)
  %27 = call i8* @nish_str_concat(i8* %22, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %29 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %29, i32 0, i32 1
  %31 = load i8*, i8** %30, align 8
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %34 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %34, i32 0, i32 3
  %36 = load i32, i32* %35, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %33, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %40 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %41 = getelementptr inbounds %struct.Point, %struct.Point* %40, i32 0, i32 2
  %42 = load i32, i32* %41, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %46 = load i32, i32* %f.addr, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %45, i8* %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
