%struct.Box = type { i8* }
%struct.amrit_result.str.i32 = type { i1, i8*, i32 }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"L\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_reset_arena() #0
declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare noundef nonnull align 8 i8* @amrit_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %text, i8** %0, align 8
  ret void
}

define noundef nonnull align 8 i8* @fill(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %b, i32 noundef %i) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @amrit_str_from_i32(i32 %i)
  %1 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i8* %2, i8** %3, align 8
  %4 = load i8*, i8** %s.addr, align 8
  ret i8* %4
}

define noundef nonnull align 8 i8* @sweep(i32 noundef %i) #0 {
entry:
  call void @amrit_reset_arena()
  %0 = call i8* @amrit_str_from_i32(i32 %i)
  %1 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %0)
  ret i8* %1
}

define noundef nonnull align 8 dereferenceable(24) %struct.amrit_result.str.i32* @label(i32 noundef %i) #0 {
entry:
  %0 = call i8* @amrit_str_from_i32(i32 %i)
  %1 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = call i8* @amrit_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.amrit_result.str.i32*
  %4 = getelementptr inbounds %struct.amrit_result.str.i32, %struct.amrit_result.str.i32* %3, i32 0, i32 0
  store i1 true, i1* %4, align 1
  %5 = getelementptr inbounds %struct.amrit_result.str.i32, %struct.amrit_result.str.i32* %3, i32 0, i32 1
  store i8* %1, i8** %5, align 8
  ret %struct.amrit_result.str.i32* %3
}

define noundef nonnull align 8 i8* @plain(i32 noundef %i) #0 {
entry:
  %0 = call i8* @amrit_str_from_i32(i32 %i)
  %1 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %0)
  ret i8* %1
}

define noundef i32 @amrit_main() #0 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  call void @Box.constructor(%struct.Box* %Box.obj, i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*))
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %0 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %1 = call i8* @fill(%struct.Box* %0, i32 1)
  call void @amrit_print(i8* %1)
  %2 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %2, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8
  call void @amrit_print(i8* %4)
  %5 = call i8* @sweep(i32 2)
  call void @amrit_print(i8* %5)
  %6 = call %struct.amrit_result.str.i32* @label(i32 3)
  %7 = getelementptr inbounds %struct.amrit_result.str.i32, %struct.amrit_result.str.i32* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.amrit_result.str.i32, %struct.amrit_result.str.i32* %6, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i8* [ %10, %res.ok ], [ bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %res.alt ]
  call void @amrit_print(i8* %11)
  %12 = call i64 @amrit_arena_mark()
  %13 = call i8* @plain(i32 4)
  %14 = call i8* @amrit_arena_keep(i64 %12, i8* %13)
  call void @amrit_print(i8* %14)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
