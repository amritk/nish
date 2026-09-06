%struct.Base = type { i32 }
%struct.Derived = type { i32, i32 }
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #4
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @sts_panic_index(i64 noundef, i64 noundef) #5

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #6 {
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

define void @Base.constructor(%struct.Base* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Base, %struct.Base* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4
  ret void
}

define noundef i32 @Base.tag(%struct.Base* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Base, %struct.Base* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = mul i32 %1, 2
  ret i32 %2
}

define void @Derived.constructor(%struct.Derived* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %id, i32 noundef %extra) #0 {
entry:
  %0 = bitcast %struct.Derived* %this to %struct.Base*
  call void @Base.constructor(%struct.Base* %0, i32 %id)
  %1 = getelementptr inbounds %struct.Derived, %struct.Derived* %this, i32 0, i32 1
  store i32 %extra, i32* %1, align 4
  ret void
}

define noundef i32 @sumIds(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %items) #1 {
entry:
  %total.addr = alloca i32, align 4
  %b.addr = alloca %struct.Base*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %items, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %items, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to %struct.Base**
  %7 = getelementptr inbounds %struct.Base*, %struct.Base** %6, i64 %0
  %8 = load %struct.Base*, %struct.Base** %7, align 8
  store %struct.Base* %8, %struct.Base** %b.addr, align 8
  %9 = load i32, i32* %total.addr, align 4
  %10 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %11 = getelementptr inbounds %struct.Base, %struct.Base* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %9, %12
  store i32 %13, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16
}

define noundef nonnull align 8 dereferenceable(4) %struct.Base* @lower(%struct.Base* noundef nonnull align 8 dereferenceable(4) %a, %struct.Base* noundef nonnull align 8 dereferenceable(4) %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Base, %struct.Base* %a, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Base, %struct.Base* %b, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = icmp sle i32 %1, %3
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi %struct.Base* [ %a, %cond.true ], [ %b, %cond.false ]
  ret %struct.Base* %5
}

define noundef align 8 %struct.Base* @maybe(i1 noundef zeroext %flag, %struct.Derived* noundef nonnull align 8 dereferenceable(8) %d) #2 {
entry:
  br i1 %flag, label %cond.true, label %cond.false

cond.true:
  %0 = bitcast %struct.Derived* %d to %struct.Base*
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi %struct.Base* [ %0, %cond.true ], [ null, %cond.false ]
  ret %struct.Base* %1
}

define noundef nonnull align 8 dereferenceable(4) %struct.Base* @widen(%struct.Derived* noundef nonnull align 8 dereferenceable(8) %d) #2 {
entry:
  %0 = bitcast %struct.Derived* %d to %struct.Base*
  ret %struct.Base* %0
}

define noundef i32 @sts_main() #3 {
entry:
  %d.addr = alloca %struct.Derived*, align 8
  %e.addr = alloca %struct.Derived*, align 8
  %items.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [2 x %struct.Base*], align 8
  %b.addr = alloca %struct.Base*, align 8
  %m.addr = alloca %struct.Base*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Derived*
  call void @Derived.constructor(%struct.Derived* %1, i32 5, i32 50)
  store %struct.Derived* %1, %struct.Derived** %d.addr, align 8
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Derived*
  call void @Derived.constructor(%struct.Derived* %3, i32 2, i32 20)
  store %struct.Derived* %3, %struct.Derived** %e.addr, align 8
  %4 = load %struct.Derived*, %struct.Derived** %d.addr, align 8
  %5 = bitcast %struct.Derived* %4 to %struct.Base*
  %6 = load %struct.Derived*, %struct.Derived** %e.addr, align 8
  %7 = bitcast %struct.Derived* %6 to %struct.Base*
  %8 = call %struct.Base* @lower(%struct.Base* %5, %struct.Base* %7)
  %9 = getelementptr inbounds %struct.Base, %struct.Base* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @sts_str_from_i32(i32 %10)
  call void @sts_print(i8* %11)
  %12 = load %struct.Derived*, %struct.Derived** %d.addr, align 8
  %13 = bitcast %struct.Derived* %12 to %struct.Base*
  %14 = load %struct.Derived*, %struct.Derived** %e.addr, align 8
  %15 = bitcast %struct.Derived* %14 to %struct.Base*
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %16, align 8
  %17 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %17, align 8
  %18 = bitcast [2 x %struct.Base*]* %arr.data to i8*
  %19 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %18, i8** %19, align 8
  %20 = bitcast i8* %18 to %struct.Base**
  %21 = getelementptr inbounds %struct.Base*, %struct.Base** %20, i64 0
  store %struct.Base* %13, %struct.Base** %21, align 8
  %22 = getelementptr inbounds %struct.Base*, %struct.Base** %20, i64 1
  store %struct.Base* %15, %struct.Base** %22, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %items.addr, align 8
  %23 = load %struct.sts_array*, %struct.sts_array** %items.addr, align 8
  %24 = call i8* @sts_alloc_struct(i64 8)
  %25 = bitcast i8* %24 to %struct.Derived*
  call void @Derived.constructor(%struct.Derived* %25, i32 3, i32 30)
  %26 = bitcast %struct.Derived* %25 to %struct.Base*
  %27 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 0
  %28 = load i64, i64* %27, align 8
  %29 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = icmp eq i64 %28, %30
  br i1 %31, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %23, i64 8)
  br label %push.store

push.store:
  %32 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %23, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8
  %34 = bitcast i8* %33 to %struct.Base**
  %35 = getelementptr inbounds %struct.Base*, %struct.Base** %34, i64 %28
  store %struct.Base* %26, %struct.Base** %35, align 8
  %36 = add i64 %28, 1
  store i64 %36, i64* %27, align 8
  %37 = trunc i64 %36 to i32
  %38 = load %struct.sts_array*, %struct.sts_array** %items.addr, align 8
  %39 = call i8* @sts_alloc_struct(i64 8)
  %40 = bitcast i8* %39 to %struct.Derived*
  call void @Derived.constructor(%struct.Derived* %40, i32 1, i32 10)
  %41 = bitcast %struct.Derived* %40 to %struct.Base*
  %42 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %38, i64 0, i32 0
  %43 = load i64, i64* %42, align 8
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %38, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8
  %47 = bitcast i8* %46 to %struct.Base**
  %48 = getelementptr inbounds %struct.Base*, %struct.Base** %47, i64 0
  store %struct.Base* %41, %struct.Base** %48, align 8
  %49 = load %struct.sts_array*, %struct.sts_array** %items.addr, align 8
  %50 = call i32 @sumIds(%struct.sts_array* %49)
  %51 = call i8* @sts_str_from_i32(i32 %50)
  call void @sts_print(i8* %51)
  %52 = load %struct.Derived*, %struct.Derived** %e.addr, align 8
  %53 = bitcast %struct.Derived* %52 to %struct.Base*
  store %struct.Base* %53, %struct.Base** %b.addr, align 8
  %54 = load %struct.Derived*, %struct.Derived** %d.addr, align 8
  %55 = bitcast %struct.Derived* %54 to %struct.Base*
  store %struct.Base* %55, %struct.Base** %b.addr, align 8
  %56 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %57 = call i32 @Base.tag(%struct.Base* %56)
  %58 = call i8* @sts_str_from_i32(i32 %57)
  call void @sts_print(i8* %58)
  %59 = load %struct.Derived*, %struct.Derived** %d.addr, align 8
  %60 = call %struct.Base* @maybe(i1 true, %struct.Derived* %59)
  store %struct.Base* %60, %struct.Base** %m.addr, align 8
  %61 = load %struct.Base*, %struct.Base** %m.addr, align 8
  %62 = icmp ne %struct.Base* %61, null
  br i1 %62, label %if.then, label %if.end

if.then:
  %63 = load %struct.Base*, %struct.Base** %m.addr, align 8
  %64 = getelementptr inbounds %struct.Base, %struct.Base* %63, i32 0, i32 0
  %65 = load i32, i32* %64, align 4
  %66 = call i8* @sts_str_from_i32(i32 %65)
  call void @sts_print(i8* %66)
  br label %if.end

if.end:
  %67 = load %struct.Derived*, %struct.Derived** %e.addr, align 8
  %68 = call %struct.Base* @widen(%struct.Derived* %67)
  %69 = call i32 @Base.tag(%struct.Base* %68)
  %70 = call i8* @sts_str_from_i32(i32 %69)
  call void @sts_print(i8* %70)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }
