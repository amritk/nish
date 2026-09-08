%struct.Registry = type { %struct.Item* }
%struct.Item = type { i32 }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_free_arena() #0
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

define void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(4) %this, %struct.Registry* noundef nonnull align 8 dereferenceable(8) nocapture %reg, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Registry, %struct.Registry* %reg, i32 0, i32 0
  store %struct.Item* %this, %struct.Item** %1, align 8
  ret void
}

define noundef i32 @register(%struct.Registry* noundef nonnull align 8 dereferenceable(8) nocapture %reg, i32 noundef %value) #0 {
entry:
  %item.addr = alloca %struct.Item*, align 8
  %0 = call i8* @amrit_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Item*
  call void @Item.constructor(%struct.Item* %1, %struct.Registry* %reg, i32 %value)
  store %struct.Item* %1, %struct.Item** %item.addr, align 8
  %2 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %3 = getelementptr inbounds %struct.Item, %struct.Item* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define noundef i32 @amrit_main() #0 {
entry:
  %reg.addr = alloca %struct.Registry*, align 8
  %Registry.obj = alloca %struct.Registry, align 8
  %last.addr = alloca %struct.Item*, align 8
  %0 = getelementptr inbounds %struct.Registry, %struct.Registry* %Registry.obj, i32 0, i32 0
  store %struct.Item* null, %struct.Item** %0, align 8
  store %struct.Registry* %Registry.obj, %struct.Registry** %reg.addr, align 8
  %1 = load %struct.Registry*, %struct.Registry** %reg.addr, align 8
  %2 = call i32 @register(%struct.Registry* %1, i32 7)
  %3 = call i8* @amrit_str_from_i32(i32 %2)
  call void @amrit_print(i8* %3)
  %4 = load %struct.Registry*, %struct.Registry** %reg.addr, align 8
  %5 = call i32 @register(%struct.Registry* %4, i32 8)
  %6 = call i8* @amrit_str_from_i32(i32 %5)
  call void @amrit_print(i8* %6)
  %7 = load %struct.Registry*, %struct.Registry** %reg.addr, align 8
  %8 = getelementptr inbounds %struct.Registry, %struct.Registry* %7, i32 0, i32 0
  %9 = load %struct.Item*, %struct.Item** %8, align 8
  store %struct.Item* %9, %struct.Item** %last.addr, align 8
  %10 = load %struct.Item*, %struct.Item** %last.addr, align 8
  %11 = icmp ne %struct.Item* %10, null
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.Item*, %struct.Item** %last.addr, align 8
  %13 = getelementptr inbounds %struct.Item, %struct.Item* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4
  %15 = call i8* @amrit_str_from_i32(i32 %14)
  call void @amrit_print(i8* %15)
  br label %if.end

if.end:
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
