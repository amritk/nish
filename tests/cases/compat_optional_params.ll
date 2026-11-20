%struct.Counter = type { double }
%struct.Box = type {}
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"default \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c" evaluated, call \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"height\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"item\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"box\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"?\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"q\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"calls \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"sum \00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" left \00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noundef double @tick(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %counter, i8* noundef nonnull noalias readonly align 8 nocapture %label) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %counter, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !4
  %2 = fadd double %1, 0x3FF0000000000000
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %counter, i32 0, i32 0
  store double %2, double* %3, align 8, !tbaa !4
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %label)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*))
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %counter, i32 0, i32 0
  %7 = load double, double* %6, align 8, !tbaa !4
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %5, i8* %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.Counter, %struct.Counter* %counter, i32 0, i32 0
  %11 = load double, double* %10, align 8, !tbaa !4
  %12 = fmul double %11, 0x4024000000000000
  call void @nish_arena_release(i64 %arena.mark)
  ret double %12
}

define internal noundef double @area(%struct.Counter* noundef nonnull readonly align 8 dereferenceable(8) nocapture %counter, double noundef %width, double noundef %height, double noundef %scale) #1 {
entry:
  %0 = fmul double %width, %height
  %1 = fmul double %0, %scale
  ret double %1
}

define internal noundef double @area__default2(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %counter, double noundef %width) #0 {
entry:
  %height.addr = alloca double, align 8
  %0 = call double @tick(%struct.Counter* %counter, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  store double %0, double* %height.addr, align 8
  %1 = load double, double* %height.addr, align 8
  %2 = call double @area__default3(%struct.Counter* %counter, double %width, double %1)
  ret double %2
}

define internal noundef double @area__default3(%struct.Counter* noundef nonnull readonly align 8 dereferenceable(8) nocapture %counter, double noundef %width, double noundef %height) #1 {
entry:
  %scale.addr = alloca double, align 8
  %0 = fadd double %width, %height
  store double %0, double* %scale.addr, align 8
  %1 = load double, double* %scale.addr, align 8
  %2 = call double @area(%struct.Counter* %counter, double %width, double %height, double %1)
  ret double %2
}

define internal noundef nonnull align 8 i8* @greet(i8* noundef nonnull noalias readonly align 8 nocapture %name, i8* noundef noalias readonly align 8 %greeting) #0 {
entry:
  %word.addr = alloca i8*, align 8
  %0 = icmp ne i8* %greeting, null
  %1 = select i1 %0, i8* %greeting, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  store i8* %1, i8** %word.addr, align 8
  %2 = load i8*, i8** %word.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  %4 = call i8* @nish_str_concat(i8* %3, i8* %name)
  ret i8* %4
}

define internal void @shout(i8* noundef nonnull noalias readonly align 8 nocapture %name, i8* noundef noalias readonly align 8 nocapture %suffix) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp ne i8* %suffix, null
  %1 = select i1 %0, i8* %suffix, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*)
  %2 = call i8* @nish_str_concat(i8* %name, i8* %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 i8* @label(i8* noundef nonnull noalias readonly align 8 nocapture %name, i8* noundef noalias readonly align 8 nocapture %prefix) #0 {
entry:
  %0 = icmp ne i8* %prefix, null
  %1 = select i1 %0, i8* %prefix, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %3 = call i8* @nish_str_concat(i8* %2, i8* %name)
  ret i8* %3
}

define internal noundef nonnull align 8 i8* @Box.tag(%struct.Box* noundef nonnull readonly align 8 nocapture %this, i8* noundef nonnull noalias readonly align 8 nocapture %name, i8* noundef noalias readonly align 8 nocapture %prefix) #0 {
entry:
  %0 = icmp ne i8* %prefix, null
  %1 = select i1 %0, i8* %prefix, i8* bitcast ({ i64, [4 x i8] }* @.str.8 to i8*)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %3 = call i8* @nish_str_concat(i8* %2, i8* %name)
  ret i8* %3
}

define internal noundef double @count(double noundef %first, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rest) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rest, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = fadd double %2, %first
  ret double %3
}

define internal noundef double @count__default1(double noundef %first) #2 {
entry:
  %rest.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x double], align 8
  %0 = fadd double %first, 0x3FF0000000000000
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %3 = bitcast [2 x double]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %3 to double*
  %6 = getelementptr inbounds double, double* %5, i64 0
  store double %first, double* %6, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %7 = getelementptr inbounds double, double* %5, i64 1
  store double %0, double* %7, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rest.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %9 = call double @count(double %first, %struct.nish_array* %8)
  ret double %9
}

define internal noundef double @drop(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %3
  %8 = load double, double* %7, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = sitofp i64 %10 to double
  ret double %11
}

define internal noundef double @trim(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, double noundef %left) #1 {
entry:
  ret double %left
}

define internal noundef double @trim__default1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %left.addr = alloca double, align 8
  %0 = call double @drop(%struct.nish_array* %xs)
  store double %0, double* %left.addr, align 8
  %1 = load double, double* %left.addr, align 8
  %2 = call double @trim(%struct.nish_array* %xs, double %1)
  ret double %2
}

define void @nish_main() #0 {
entry:
  %counter.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %box.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x double], align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x double], align 8
  %sum.addr = alloca double, align 8
  %i.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !4
  store %struct.Counter* %Counter.obj, %struct.Counter** %counter.addr, align 8
  %1 = load %struct.Counter*, %struct.Counter** %counter.addr, align 8
  %2 = call double @area__default2(%struct.Counter* %1, double 0x4000000000000000)
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = load %struct.Counter*, %struct.Counter** %counter.addr, align 8
  %5 = call double @area__default3(%struct.Counter* %4, double 0x4000000000000000, double 0x4008000000000000)
  %6 = call i8* @nish_str_from_f64(double %5)
  call void @nish_print(i8* %6)
  %7 = load %struct.Counter*, %struct.Counter** %counter.addr, align 8
  %8 = call double @area(%struct.Counter* %7, double 0x4000000000000000, double 0x4008000000000000, double 0x4010000000000000)
  %9 = call i8* @nish_str_from_f64(double %8)
  call void @nish_print(i8* %9)
  %10 = load %struct.Counter*, %struct.Counter** %counter.addr, align 8
  %11 = call double @area__default2(%struct.Counter* %10, double 0x3FF0000000000000)
  %12 = call i8* @nish_str_from_f64(double %11)
  call void @nish_print(i8* %12)
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @greet(i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*), i8* null)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  call void @nish_print(i8* %15)
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @greet(i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  call void @nish_print(i8* %18)
  call void @shout(i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i8* null)
  call void @shout(i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*))
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @label(i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i8* null)
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  call void @nish_print(i8* %21)
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @label(i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  call void @nish_print(i8* %24)
  store %struct.Box* %Box.obj, %struct.Box** %box.addr, align 8
  %25 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @Box.tag(%struct.Box* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), i8* null)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %30 = call i64 @nish_arena_mark()
  %31 = call i8* @Box.tag(%struct.Box* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.15 to i8*))
  %32 = call i8* @nish_arena_keep(i64 %30, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call double @count__default1(double 0x4014000000000000)
  %34 = call i8* @nish_str_from_f64(double %33)
  call void @nish_print(i8* %34)
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %37 = bitcast [1 x double]* %arr.data to i8*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = bitcast i8* %37 to double*
  %40 = getelementptr inbounds double, double* %39, i64 0
  store double 0x3FF0000000000000, double* %40, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %41 = call double @count(double 0x4014000000000000, %struct.nish_array* %arr.hdr)
  %42 = call i8* @nish_str_from_f64(double %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.Counter*, %struct.Counter** %counter.addr, align 8
  %44 = getelementptr inbounds %struct.Counter, %struct.Counter* %43, i32 0, i32 0
  %45 = load double, double* %44, align 8, !tbaa !4
  %46 = call i8* @nish_str_from_f64(double %45)
  %47 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.16 to i8*), i8* %46)
  call void @nish_print(i8* %47)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %48, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %49, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %50 = bitcast [3 x double]* %arr.data.1 to i8*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %52 = bitcast i8* %50 to double*
  %53 = getelementptr inbounds double, double* %52, i64 0
  store double 0x3FF0000000000000, double* %53, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %54 = getelementptr inbounds double, double* %52, i64 1
  store double 0x4000000000000000, double* %54, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %55 = getelementptr inbounds double, double* %52, i64 2
  store double 0x4008000000000000, double* %55, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %xs.addr, align 8
  store double 0x0000000000000000, double* %sum.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %while.cond

while.cond:
  %56 = load double, double* %i.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %60 = sitofp i64 %59 to double
  %61 = fcmp olt double %56, %60
  br i1 %61, label %while.body, label %while.end

while.body:
  %62 = load double, double* %sum.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %64 = load double, double* %i.addr, align 8
  %65 = fptosi double %64 to i64
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %68 = icmp ult i64 %65, %67
  br i1 %68, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %65, i64 %67)
  unreachable

bounds.ok:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %71 = bitcast i8* %70 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %65
  %73 = load double, double* %72, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %74 = fadd double %62, %73
  store double %74, double* %sum.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %76 = call double @trim__default1(%struct.nish_array* %75)
  %77 = load double, double* %i.addr, align 8
  %78 = fadd double %77, 0x3FF0000000000000
  store double %78, double* %i.addr, align 8
  br label %while.cond

while.end:
  %79 = load double, double* %sum.addr, align 8
  %80 = call i8* @nish_str_from_f64(double %79)
  %81 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.17 to i8*), i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [7 x i8] }* @.str.18 to i8*))
  %83 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %86 = sitofp i64 %85 to double
  %87 = call i8* @nish_str_from_f64(double %86)
  %88 = call i8* @nish_str_concat(i8* %82, i8* %87)
  call void @nish_print(i8* %88)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!nish.compat = !{!23}
!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"Counter", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element double", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
!23 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
