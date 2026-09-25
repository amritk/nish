%struct.State = type { %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Finder = type { %struct.State*, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @State.constructor(%struct.State* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %idx, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %holder) #0 {
entry:
  %0 = getelementptr inbounds %struct.State, %struct.State* %this, i32 0, i32 0
  store %struct.nish_array* %idx, %struct.nish_array** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.State, %struct.State* %this, i32 0, i32 1
  store %struct.nish_array* %holder, %struct.nish_array** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.State, %struct.State* %this, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !7
  ret void
}

define internal void @Finder.constructor(%struct.Finder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.State* noundef nonnull align 8 dereferenceable(24) %state, i8* noundef nonnull noalias readonly align 8 %src) #0 {
entry:
  %0 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 0
  store %struct.State* %state, %struct.State** %0, align 8, !tbaa !9
  %1 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 1
  store i8* %src, i8** %1, align 8, !tbaa !10
  ret void
}

define internal noundef zeroext i1 @Finder.find(%struct.Finder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %v, i32 noundef %w) #1 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 0
  %1 = load %struct.State*, %struct.State** %0, align 8, !tbaa !9
  %2 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !5
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %8 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 0
  %9 = load %struct.State*, %struct.State** %8, align 8, !tbaa !9
  %10 = getelementptr inbounds %struct.State, %struct.State* %9, i32 0, i32 1
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !6
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  br label %while.cond

while.cond:
  %16 = load i32, i32* %k.addr, align 4
  %17 = trunc i64 %5 to i32
  %18 = icmp slt i32 %16, %17
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = load i32, i32* %k.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %7 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %20
  %23 = load i32, i32* %22, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %24 = icmp eq i32 %23, %v
  br i1 %24, label %land.rhs, label %land.end

land.rhs:
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = icmp ult i64 %26, %13
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %26, i64 %13)
  unreachable

bounds.ok:
  %28 = bitcast i8* %15 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %26
  %30 = load i32, i32* %29, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %31 = icmp eq i32 %30, %w
  br label %land.end

land.end:
  %32 = phi i1 [ false, %while.body ], [ %31, %bounds.ok ]
  br i1 %32, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret i1 false
}

define internal noundef i32 @Finder.sumCodes(%struct.Finder* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 1
  %2 = load i8*, i8** %1, align 8, !tbaa !10
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %0, %5
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load i32, i32* %s.addr, align 4
  %8 = getelementptr inbounds %struct.Finder, %struct.Finder* %this, i32 0, i32 1
  %9 = load i8*, i8** %8, align 8, !tbaa !10
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds i8, i8* %9, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1
  %15 = zext i8 %14 to i32
  %16 = add nsw i32 %7, %15
  store i32 %16, i32* %s.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %s.addr, align 4
  ret i32 %19
}

define noundef i32 @hoisted(%struct.State* noundef nonnull align 8 dereferenceable(24) nocapture %h) #1 {
entry:
  %n.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %n.addr, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 0
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !5
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  br label %while.cond

while.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %9, %10
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 2
  %13 = load i32, i32* %12, align 4, !tbaa !7
  %14 = add nsw i32 %13, 1
  %15 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 2
  store i32 %14, i32* %15, align 4, !tbaa !7
  %16 = load i32, i32* %s.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %8 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %18
  %21 = load i32, i32* %20, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %22 = add nsw i32 %16, %21
  store i32 %22, i32* %s.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %s.addr, align 4
  ret i32 %25
}

define noundef i32 @third(%struct.State* noundef nonnull readonly align 8 dereferenceable(24) nocapture %h) #3 {
entry:
  %0 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.State, %struct.State* %h, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !5
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 2
  %12 = load i32, i32* %11, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  ret i32 %12

if.end:
  %13 = sub nsw i32 0, 1
  ret i32 %13
}

define noundef i32 @nish_main() #1 {
entry:
  %st.addr = alloca %struct.State*, align 8
  %f.addr = alloca %struct.Finder*, align 8
  %Finder.obj = alloca %struct.Finder, align 8
  %State.obj = alloca %struct.State, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.State*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !14, !noalias !15, !tbaa !23
  %6 = call i8* @nish_alloc_struct(i64 12)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 4, i32* %9, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 5, i32* %10, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 6, i32* %11, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 3, i64* %14, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 3, i64* %15, align 8, !alias.scope !14, !noalias !15, !tbaa !23
  %16 = call i8* @nish_alloc_struct(i64 12)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 1, i32* %19, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 2, i32* %20, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %21 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 3, i32* %21, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  call void @State.constructor(%struct.State* %1, %struct.nish_array* %3, %struct.nish_array* %13)
  store %struct.State* %1, %struct.State** %st.addr, align 8
  %22 = load %struct.State*, %struct.State** %st.addr, align 8
  call void @Finder.constructor(%struct.Finder* %Finder.obj, %struct.State* %22, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  store %struct.Finder* %Finder.obj, %struct.Finder** %f.addr, align 8
  %23 = load %struct.Finder*, %struct.Finder** %f.addr, align 8
  %24 = call i1 @Finder.find(%struct.Finder* %23, i32 5, i32 2)
  %25 = select i1 %24, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %27 = load %struct.Finder*, %struct.Finder** %f.addr, align 8
  %28 = call i1 @Finder.find(%struct.Finder* %27, i32 5, i32 3)
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %30 = call i8* @nish_str_concat(i8* %26, i8* %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.Finder*, %struct.Finder** %f.addr, align 8
  %32 = call i32 @Finder.sumCodes(%struct.Finder* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.State*, %struct.State** %st.addr, align 8
  %35 = call i32 @hoisted(%struct.State* %34)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %38 = load %struct.State*, %struct.State** %st.addr, align 8
  %39 = getelementptr inbounds %struct.State, %struct.State* %38, i32 0, i32 2
  %40 = load i32, i32* %39, align 4, !tbaa !7
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %37, i8* %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.State*, %struct.State** %st.addr, align 8
  %44 = call i32 @third(%struct.State* %43)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %47 = call i8* @nish_alloc_struct(i64 24)
  %48 = bitcast i8* %47 to %struct.nish_array*
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  store i64 1, i64* %49, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  store i64 1, i64* %50, align 8, !alias.scope !14, !noalias !15, !tbaa !23
  %51 = call i8* @nish_alloc_struct(i64 4)
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  store i8* %51, i8** %52, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %53 = bitcast i8* %51 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 0
  store i32 1, i32* %54, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  %55 = call i8* @nish_alloc_struct(i64 24)
  %56 = bitcast i8* %55 to %struct.nish_array*
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  store i64 1, i64* %57, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 1
  store i64 1, i64* %58, align 8, !alias.scope !14, !noalias !15, !tbaa !23
  %59 = call i8* @nish_alloc_struct(i64 4)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %61 = bitcast i8* %59 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  store i32 1, i32* %62, align 4, !alias.scope !15, !noalias !14, !tbaa !22
  call void @State.constructor(%struct.State* %State.obj, %struct.nish_array* %48, %struct.nish_array* %56)
  %63 = call i32 @third(%struct.State* %State.obj)
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %46, i8* %64)
  call void @nish_print(i8* %65)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"State", !2, i64 0, !2, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !2, i64 8}
!7 = !{!4, !3, i64 16}
!8 = !{!"Finder", !2, i64 0, !2, i64 8}
!9 = !{!8, !2, i64 0}
!10 = !{!8, !2, i64 8}
!11 = !{!"nish array"}
!12 = !{!"header", !11}
!13 = !{!"elements", !11}
!14 = !{!12}
!15 = !{!13}
!16 = !{!"header i64", !1, i64 0}
!17 = !{!"header ptr", !1, i64 0}
!18 = !{!"array header", !16, i64 0, !16, i64 8, !17, i64 16}
!19 = !{!18, !16, i64 0}
!20 = !{!18, !17, i64 16}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!18, !16, i64 8}
