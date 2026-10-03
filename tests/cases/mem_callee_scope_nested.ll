%struct.X = type { i32 }
%struct.Holder = type { %struct.X* }
%struct.Keeper = type { %struct.X* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal void @X.constructor(%struct.X* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.X, %struct.X* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.X* noundef nonnull align 8 dereferenceable(4) %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.X* %x, %struct.X** %0, align 8, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Holder* @mk(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Holder*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.X*
  call void @X.constructor(%struct.X* %3, i32 %n)
  call void @Holder.constructor(%struct.Holder* %1, %struct.X* %3)
  ret %struct.Holder* %1
}

define internal noundef i32 @keep(%struct.Keeper* noundef nonnull align 8 dereferenceable(8) nocapture %k, i32 noundef %n) #0 {
entry:
  %o.addr = alloca %struct.Holder*, align 8
  %0 = call %struct.Holder* @mk(i32 %n)
  store %struct.Holder* %0, %struct.Holder** %o.addr, align 8
  %1 = load %struct.Holder*, %struct.Holder** %o.addr, align 8
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 0
  %3 = load %struct.X*, %struct.X** %2, align 8, !tbaa !7
  %4 = getelementptr inbounds %struct.Keeper, %struct.Keeper* %k, i32 0, i32 0
  store %struct.X* %3, %struct.X** %4, align 8, !tbaa !9
  ret i32 %n
}

define noundef i32 @nish_main() #0 {
entry:
  %k.addr = alloca %struct.Keeper*, align 8
  %Keeper.obj = alloca %struct.Keeper, align 8
  %junk.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %f.addr = alloca %struct.X*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Keeper, %struct.Keeper* %Keeper.obj, i32 0, i32 0
  store %struct.X* null, %struct.X** %0, align 8, !tbaa !9
  store %struct.Keeper* %Keeper.obj, %struct.Keeper** %k.addr, align 8
  %1 = load %struct.Keeper*, %struct.Keeper** %k.addr, align 8
  %2 = call i32 @keep(%struct.Keeper* %1, i32 41)
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %junk.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 64
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %9 = call i8* @nish_alloc_struct(i64 4)
  %10 = bitcast i8* %9 to %struct.X*
  call void @X.constructor(%struct.X* %10, i32 -1)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %18 = bitcast i8* %17 to %struct.X**
  %19 = getelementptr inbounds %struct.X*, %struct.X** %18, i64 %12
  store %struct.X* %10, %struct.X** %19, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.Keeper*, %struct.Keeper** %k.addr, align 8
  %25 = getelementptr inbounds %struct.Keeper, %struct.Keeper* %24, i32 0, i32 0
  %26 = load %struct.X*, %struct.X** %25, align 8, !tbaa !9
  store %struct.X* %26, %struct.X** %f.addr, align 8
  %27 = load %struct.X*, %struct.X** %f.addr, align 8
  %28 = icmp ne %struct.X* %27, null
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load %struct.X*, %struct.X** %f.addr, align 8
  %30 = getelementptr inbounds %struct.X, %struct.X* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4, !tbaa !4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  br label %if.end

if.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %36 = trunc i64 %35 to i32
  %37 = sub nsw i32 %36, 64
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %37
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"X", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Holder", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Keeper", !5, i64 0}
!9 = !{!8, !5, i64 0}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
