%struct.Vec3 = type { double, double, double }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #3
declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #0

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #4 {
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

define void @Vec3.constructor(%struct.Vec3* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, double noundef %x, double noundef %y, double noundef %z) #0 {
entry:
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 0
  store double %x, double* %0, align 8
  %1 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 1
  store double %y, double* %1, align 8
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 2
  store double %z, double* %2, align 8
  ret void
}

define noundef double @Vec3.dot(%struct.Vec3* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, %struct.Vec3* noundef nonnull readonly align 8 dereferenceable(24) nocapture %o) #1 {
entry:
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 0
  %3 = load double, double* %2, align 8
  %4 = fmul double %1, %3
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 1
  %6 = load double, double* %5, align 8
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 1
  %8 = load double, double* %7, align 8
  %9 = fmul double %6, %8
  %10 = fadd double %4, %9
  %11 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 2
  %12 = load double, double* %11, align 8
  %13 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 2
  %14 = load double, double* %13, align 8
  %15 = fmul double %12, %14
  %16 = fadd double %10, %15
  ret double %16
}

define noundef nonnull align 8 dereferenceable(24) %struct.Vec3* @Vec3.scaled(%struct.Vec3* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, double noundef %k) #0 {
entry:
  %0 = call i8* @amrit_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Vec3*
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 0
  %3 = load double, double* %2, align 8
  %4 = fmul double %3, %k
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 1
  %6 = load double, double* %5, align 8
  %7 = fmul double %6, %k
  %8 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 2
  %9 = load double, double* %8, align 8
  %10 = fmul double %9, %k
  call void @Vec3.constructor(%struct.Vec3* %1, double %4, double %7, double %10)
  ret %struct.Vec3* %1
}

define void @Vec3.addInPlace(%struct.Vec3* noundef nonnull align 8 dereferenceable(24) nocapture %this, %struct.Vec3* noundef nonnull readonly align 8 dereferenceable(24) nocapture %o) #0 {
entry:
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 0
  %3 = load double, double* %2, align 8
  %4 = fadd double %1, %3
  store double %4, double* %0, align 8
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 1
  %6 = load double, double* %5, align 8
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 1
  %8 = load double, double* %7, align 8
  %9 = fadd double %6, %8
  store double %9, double* %5, align 8
  %10 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %this, i32 0, i32 2
  %11 = load double, double* %10, align 8
  %12 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %o, i32 0, i32 2
  %13 = load double, double* %12, align 8
  %14 = fadd double %11, %13
  store double %14, double* %10, align 8
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.Vec3* @centroid(double noundef %count) #2 {
entry:
  %acc.addr = alloca %struct.Vec3*, align 8
  %i.addr = alloca double, align 8
  %Vec3.obj = alloca %struct.Vec3, align 8
  %0 = call i8* @amrit_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Vec3*
  call void @Vec3.constructor(%struct.Vec3* %1, double 0x0000000000000000, double 0x0000000000000000, double 0x0000000000000000)
  store %struct.Vec3* %1, %struct.Vec3** %acc.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %2 = load double, double* %i.addr, align 8
  %3 = fcmp olt double %2, %count
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load %struct.Vec3*, %struct.Vec3** %acc.addr, align 8
  call void @Vec3.constructor(%struct.Vec3* %Vec3.obj, double 0x3FF0000000000000, double 0x4000000000000000, double 0x4008000000000000)
  %5 = call %struct.Vec3* @Vec3.scaled(%struct.Vec3* %Vec3.obj, double 0x3FE0000000000000)
  call void @Vec3.addInPlace(%struct.Vec3* %4, %struct.Vec3* %5)
  br label %for.inc

for.inc:
  %6 = load double, double* %i.addr, align 8
  %7 = fadd double %6, 0x3FF0000000000000
  store double %7, double* %i.addr, align 8
  br label %for.cond

for.end:
  %8 = load %struct.Vec3*, %struct.Vec3** %acc.addr, align 8
  ret %struct.Vec3* %8
}

define void @amrit_main() #2 {
entry:
  %c.addr = alloca %struct.Vec3*, align 8
  %Vec3.obj = alloca %struct.Vec3, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call %struct.Vec3* @centroid(double 0x4010000000000000)
  store %struct.Vec3* %0, %struct.Vec3** %c.addr, align 8
  %1 = load %struct.Vec3*, %struct.Vec3** %c.addr, align 8
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %1, i32 0, i32 0
  %3 = load double, double* %2, align 8
  %4 = call i8* @amrit_str_from_f64(double %3)
  call void @amrit_print(i8* %4)
  %5 = load %struct.Vec3*, %struct.Vec3** %c.addr, align 8
  %6 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %5, i32 0, i32 1
  %7 = load double, double* %6, align 8
  %8 = call i8* @amrit_str_from_f64(double %7)
  call void @amrit_print(i8* %8)
  %9 = load %struct.Vec3*, %struct.Vec3** %c.addr, align 8
  %10 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %9, i32 0, i32 2
  %11 = load double, double* %10, align 8
  %12 = call i8* @amrit_str_from_f64(double %11)
  call void @amrit_print(i8* %12)
  %13 = load %struct.Vec3*, %struct.Vec3** %c.addr, align 8
  call void @Vec3.constructor(%struct.Vec3* %Vec3.obj, double 0x3FF0000000000000, double 0x3FF0000000000000, double 0x3FF0000000000000)
  %14 = call double @Vec3.dot(%struct.Vec3* %13, %struct.Vec3* %Vec3.obj)
  %15 = call i8* @amrit_str_from_f64(double %14)
  call void @amrit_print(i8* %15)
  call void @amrit_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @amrit_main()
  call void @amrit_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
