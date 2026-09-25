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
  store i64 0, i64* %3, align 8, !alias.scope !13, !noalias !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !13, !noalias !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !13, !noalias !14
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
  %11 = sub nsw i32 0, 1
  call void @X.constructor(%struct.X* %10, i32 %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !13, !noalias !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !13, !noalias !14
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !13, !noalias !14
  %19 = bitcast i8* %18 to %struct.X**
  %20 = getelementptr inbounds %struct.X*, %struct.X** %19, i64 %13
  store %struct.X* %10, %struct.X** %20, align 8, !alias.scope !14, !noalias !13, !tbaa !16
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !13, !noalias !14
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.Keeper*, %struct.Keeper** %k.addr, align 8
  %26 = getelementptr inbounds %struct.Keeper, %struct.Keeper* %25, i32 0, i32 0
  %27 = load %struct.X*, %struct.X** %26, align 8, !tbaa !9
  store %struct.X* %27, %struct.X** %f.addr, align 8
  %28 = load %struct.X*, %struct.X** %f.addr, align 8
  %29 = icmp ne %struct.X* %28, null
  br i1 %29, label %if.then, label %if.end

if.then:
  %30 = load %struct.X*, %struct.X** %f.addr, align 8
  %31 = getelementptr inbounds %struct.X, %struct.X* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !4
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !13, !noalias !14
  %37 = trunc i64 %36 to i32
  %38 = sub nsw i32 %37, 64
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38
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
!15 = !{!"element ptr", !1, i64 0}
!16 = !{!15, !15, i64 0}
