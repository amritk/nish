%struct.Map$f64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$f64$str = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"set \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"add \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"plus\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"minus\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"plus first \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"minus first \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"update \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"guarded add \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"guarded set \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"getOrInsert \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"nan \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #1

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

define internal void @count(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %m, double noundef %k) #0 {
entry:
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %m, double %k)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %m, i32 %2, double zeroinitializer)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi double [ %3, %nullish.value ], [ 0x0000000000000000, %nullish.default ]
  %5 = fadd double %4, 0x3FF0000000000000
  br i1 %1, label %set.found, label %set.insert

set.found:
  %6 = trunc i64 %0 to i32
  call void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* %m, i32 %6, double %5)
  br label %set.end

set.insert:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %m, i64 %0, double %k, double %5)
  br label %set.end

set.end:
  ret void
}

define internal void @firstOnly(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) %s, double noundef %k) #0 {
entry:
  %0 = call i64 @nish.Set$f64.probe(%struct.Set$f64* %s, double %k)
  %1 = icmp sge i64 %0, 0
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish.Set$f64.insertAt(%struct.Set$f64* %s, i64 %0, double %k)
  br label %if.end

if.end:
  ret void
}

define internal void @firstValue(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %m, double noundef %k, double noundef %v) #0 {
entry:
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %m, double %k)
  %1 = icmp sge i64 %0, 0
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %m, i64 %0, double %k, double %v)
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %z.addr = alloca double, align 8
  %set.addr = alloca %struct.Map$f64$f64*, align 8
  %k.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  %add.addr = alloca %struct.Set$f64*, align 8
  %v.addr = alloca double, align 8
  %walk.idx.1 = alloca i32, align 4
  %plusFirst.addr = alloca %struct.Map$f64$str*, align 8
  %minusFirst.addr = alloca %struct.Map$f64$str*, align 8
  %k.addr.1 = alloca double, align 8
  %walk.idx.2 = alloca i32, align 4
  %k.addr.2 = alloca double, align 8
  %walk.idx.3 = alloca i32, align 4
  %counts.addr = alloca %struct.Map$f64$f64*, align 8
  %k.addr.3 = alloca double, align 8
  %walk.idx.4 = alloca i32, align 4
  %seen.addr = alloca %struct.Set$f64*, align 8
  %v.addr.1 = alloca double, align 8
  %walk.idx.5 = alloca i32, align 4
  %firsts.addr = alloca %struct.Map$f64$f64*, align 8
  %k.addr.4 = alloca double, align 8
  %walk.idx.6 = alloca i32, align 4
  %ids.addr = alloca %struct.Map$f64$f64*, align 8
  %id.addr = alloca double, align 8
  %k.addr.5 = alloca double, align 8
  %walk.idx.7 = alloca i32, align 4
  %nan.addr = alloca %struct.Set$f64*, align 8
  %v.addr.2 = alloca double, align 8
  %walk.idx.8 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %z.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %1)
  store %struct.Map$f64$f64* %1, %struct.Map$f64$f64** %set.addr, align 8
  %2 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %set.addr, align 8
  %3 = load double, double* %z.addr, align 8
  %4 = fneg double %3
  %5 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %2, double %4, double 0x3FF0000000000000)
  %6 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %set.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %6)
  %7 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %6, i32 0)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %8 = load i32, i32* %walk.idx, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %walk.body, label %walk.end

walk.body:
  %10 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %6, i32 %8, double zeroinitializer)
  store double %10, double* %k.addr, align 8
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load double, double* %k.addr, align 8
  %16 = call i8* @nish_str_from_f64(double %15)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = load double, double* %k.addr, align 8
  %20 = fdiv double 0x3FF0000000000000, %19
  %21 = call i8* @nish_str_from_f64(double %20)
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  call void @nish_print(i8* %22)
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = icmp eq i8* %24, %12
  br i1 %25, label %pass.rewind, label %pass.free

pass.rewind:
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %26, align 8
  br label %pass.done

pass.free:
  %27 = ptrtoint i8* %12 to i64
  %28 = add i64 %27, %14
  call void @nish_arena_release(i64 %28)
  br label %pass.done

pass.done:
  br label %walk.inc

walk.inc:
  %29 = add i32 %8, 1
  %30 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %6, i32 %29)
  store i32 %30, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %6)
  %31 = call i8* @nish_alloc_struct(i64 48)
  %32 = bitcast i8* %31 to %struct.Set$f64*
  call void @nish.Set$f64.constructor(%struct.Set$f64* %32)
  store %struct.Set$f64* %32, %struct.Set$f64** %add.addr, align 8
  %33 = load %struct.Set$f64*, %struct.Set$f64** %add.addr, align 8
  %34 = load double, double* %z.addr, align 8
  %35 = fneg double %34
  %36 = call %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* %33, double %35)
  %37 = load %struct.Set$f64*, %struct.Set$f64** %add.addr, align 8
  %38 = load double, double* %z.addr, align 8
  %39 = call %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* %37, double %38)
  %40 = load %struct.Set$f64*, %struct.Set$f64** %add.addr, align 8
  call void @nish.Set$f64.walkOpen(%struct.Set$f64* %40)
  %41 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %40, i32 0)
  store i32 %41, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %42 = load i32, i32* %walk.idx.1, align 4
  %43 = icmp sge i32 %42, 0
  br i1 %43, label %walk.body.1, label %walk.end.1

walk.body.1:
  %44 = call double @nish.Set$f64.keyAt(%struct.Set$f64* %40, i32 %42, double zeroinitializer)
  store double %44, double* %v.addr, align 8
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %46 = load i8*, i8** %45, align 8
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %48 = load i64, i64* %47, align 8
  %49 = load double, double* %v.addr, align 8
  %50 = call i8* @nish_str_from_f64(double %49)
  %51 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %53 = load double, double* %v.addr, align 8
  %54 = fdiv double 0x3FF0000000000000, %53
  %55 = call i8* @nish_str_from_f64(double %54)
  %56 = call i8* @nish_str_concat(i8* %52, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %58 = load %struct.Set$f64*, %struct.Set$f64** %add.addr, align 8
  %59 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %58, i32 0, i32 0
  %60 = load double, double* %59, align 8, !tbaa !6
  %61 = call i8* @nish_str_from_f64(double %60)
  %62 = call i8* @nish_str_concat(i8* %57, i8* %61)
  call void @nish_print(i8* %62)
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %64 = load i8*, i8** %63, align 8
  %65 = icmp eq i8* %64, %46
  br i1 %65, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %66 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %48, i64* %66, align 8
  br label %pass.done.1

pass.free.1:
  %67 = ptrtoint i8* %46 to i64
  %68 = add i64 %67, %48
  call void @nish_arena_release(i64 %68)
  br label %pass.done.1

pass.done.1:
  br label %walk.inc.1

walk.inc.1:
  %69 = add i32 %42, 1
  %70 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %40, i32 %69)
  store i32 %70, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Set$f64.walkClose(%struct.Set$f64* %40)
  %71 = call i8* @nish_alloc_struct(i64 56)
  %72 = bitcast i8* %71 to %struct.Map$f64$str*
  call void @nish.Map$f64$str.constructor(%struct.Map$f64$str* %72)
  store %struct.Map$f64$str* %72, %struct.Map$f64$str** %plusFirst.addr, align 8
  %73 = load %struct.Map$f64$str*, %struct.Map$f64$str** %plusFirst.addr, align 8
  %74 = load double, double* %z.addr, align 8
  %75 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %73, double %74, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %76 = load double, double* %z.addr, align 8
  %77 = fneg double %76
  %78 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %75, double %77, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  %79 = call i8* @nish_alloc_struct(i64 56)
  %80 = bitcast i8* %79 to %struct.Map$f64$str*
  call void @nish.Map$f64$str.constructor(%struct.Map$f64$str* %80)
  store %struct.Map$f64$str* %80, %struct.Map$f64$str** %minusFirst.addr, align 8
  %81 = load %struct.Map$f64$str*, %struct.Map$f64$str** %minusFirst.addr, align 8
  %82 = load double, double* %z.addr, align 8
  %83 = fneg double %82
  %84 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %81, double %83, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*))
  %85 = load double, double* %z.addr, align 8
  %86 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %84, double %85, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %87 = load %struct.Map$f64$str*, %struct.Map$f64$str** %plusFirst.addr, align 8
  call void @nish.Map$f64$str.walkOpen(%struct.Map$f64$str* %87)
  %88 = call i32 @nish.Map$f64$str.walkNext(%struct.Map$f64$str* %87, i32 0)
  store i32 %88, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.cond.2:
  %89 = load i32, i32* %walk.idx.2, align 4
  %90 = icmp sge i32 %89, 0
  br i1 %90, label %walk.body.2, label %walk.end.2

walk.body.2:
  %91 = call double @nish.Map$f64$str.keyAt(%struct.Map$f64$str* %87, i32 %89, double zeroinitializer)
  store double %91, double* %k.addr.1, align 8
  %92 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %93 = load i8*, i8** %92, align 8
  %94 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %95 = load i64, i64* %94, align 8
  %96 = load double, double* %k.addr.1, align 8
  %97 = fdiv double 0x3FF0000000000000, %96
  %98 = call i8* @nish_str_from_f64(double %97)
  %99 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.5 to i8*), i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %101 = load %struct.Map$f64$str*, %struct.Map$f64$str** %plusFirst.addr, align 8
  %102 = load double, double* %k.addr.1, align 8
  %103 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %101, double %102)
  %104 = icmp sge i64 %103, 0
  br i1 %104, label %nullish.value, label %nullish.default

nullish.value:
  %105 = trunc i64 %103 to i32
  %106 = call i8* @nish.Map$f64$str.valueAt(%struct.Map$f64$str* %101, i32 %105, i8* zeroinitializer)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %107 = phi i8* [ %106, %nullish.value ], [ bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), %nullish.default ]
  %108 = call i8* @nish_str_concat(i8* %100, i8* %107)
  call void @nish_print(i8* %108)
  %109 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %110 = load i8*, i8** %109, align 8
  %111 = icmp eq i8* %110, %93
  br i1 %111, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %112 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %95, i64* %112, align 8
  br label %pass.done.2

pass.free.2:
  %113 = ptrtoint i8* %93 to i64
  %114 = add i64 %113, %95
  call void @nish_arena_release(i64 %114)
  br label %pass.done.2

pass.done.2:
  br label %walk.inc.2

walk.inc.2:
  %115 = add i32 %89, 1
  %116 = call i32 @nish.Map$f64$str.walkNext(%struct.Map$f64$str* %87, i32 %115)
  store i32 %116, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.end.2:
  call void @nish.Map$f64$str.walkClose(%struct.Map$f64$str* %87)
  %117 = load %struct.Map$f64$str*, %struct.Map$f64$str** %minusFirst.addr, align 8
  call void @nish.Map$f64$str.walkOpen(%struct.Map$f64$str* %117)
  %118 = call i32 @nish.Map$f64$str.walkNext(%struct.Map$f64$str* %117, i32 0)
  store i32 %118, i32* %walk.idx.3, align 4
  br label %walk.cond.3

walk.cond.3:
  %119 = load i32, i32* %walk.idx.3, align 4
  %120 = icmp sge i32 %119, 0
  br i1 %120, label %walk.body.3, label %walk.end.3

walk.body.3:
  %121 = call double @nish.Map$f64$str.keyAt(%struct.Map$f64$str* %117, i32 %119, double zeroinitializer)
  store double %121, double* %k.addr.2, align 8
  %122 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %123 = load i8*, i8** %122, align 8
  %124 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %125 = load i64, i64* %124, align 8
  %126 = load double, double* %k.addr.2, align 8
  %127 = fdiv double 0x3FF0000000000000, %126
  %128 = call i8* @nish_str_from_f64(double %127)
  %129 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.7 to i8*), i8* %128)
  %130 = call i8* @nish_str_concat(i8* %129, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %131 = load %struct.Map$f64$str*, %struct.Map$f64$str** %minusFirst.addr, align 8
  %132 = load double, double* %k.addr.2, align 8
  %133 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %131, double %132)
  %134 = icmp sge i64 %133, 0
  br i1 %134, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %135 = trunc i64 %133 to i32
  %136 = call i8* @nish.Map$f64$str.valueAt(%struct.Map$f64$str* %131, i32 %135, i8* zeroinitializer)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %137 = phi i8* [ %136, %nullish.value.1 ], [ bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), %nullish.default.1 ]
  %138 = call i8* @nish_str_concat(i8* %130, i8* %137)
  call void @nish_print(i8* %138)
  %139 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %140 = load i8*, i8** %139, align 8
  %141 = icmp eq i8* %140, %123
  br i1 %141, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %142 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %125, i64* %142, align 8
  br label %pass.done.3

pass.free.3:
  %143 = ptrtoint i8* %123 to i64
  %144 = add i64 %143, %125
  call void @nish_arena_release(i64 %144)
  br label %pass.done.3

pass.done.3:
  br label %walk.inc.3

walk.inc.3:
  %145 = add i32 %119, 1
  %146 = call i32 @nish.Map$f64$str.walkNext(%struct.Map$f64$str* %117, i32 %145)
  store i32 %146, i32* %walk.idx.3, align 4
  br label %walk.cond.3

walk.end.3:
  call void @nish.Map$f64$str.walkClose(%struct.Map$f64$str* %117)
  %147 = call i8* @nish_alloc_struct(i64 56)
  %148 = bitcast i8* %147 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %148)
  store %struct.Map$f64$f64* %148, %struct.Map$f64$f64** %counts.addr, align 8
  %149 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %counts.addr, align 8
  %150 = load double, double* %z.addr, align 8
  %151 = fneg double %150
  call void @count(%struct.Map$f64$f64* %149, double %151)
  %152 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %counts.addr, align 8
  %153 = load double, double* %z.addr, align 8
  call void @count(%struct.Map$f64$f64* %152, double %153)
  %154 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %counts.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %154)
  %155 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %154, i32 0)
  store i32 %155, i32* %walk.idx.4, align 4
  br label %walk.cond.4

walk.cond.4:
  %156 = load i32, i32* %walk.idx.4, align 4
  %157 = icmp sge i32 %156, 0
  br i1 %157, label %walk.body.4, label %walk.end.4

walk.body.4:
  %158 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %154, i32 %156, double zeroinitializer)
  store double %158, double* %k.addr.3, align 8
  %159 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %160 = load i8*, i8** %159, align 8
  %161 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %162 = load i64, i64* %161, align 8
  %163 = load double, double* %k.addr.3, align 8
  %164 = fdiv double 0x3FF0000000000000, %163
  %165 = call i8* @nish_str_from_f64(double %164)
  %166 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %165)
  %167 = call i8* @nish_str_concat(i8* %166, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %168 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %counts.addr, align 8
  %169 = load double, double* %k.addr.3, align 8
  %170 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %168, double %169)
  %171 = icmp sge i64 %170, 0
  br i1 %171, label %nullish.value.2, label %nullish.default.2

nullish.value.2:
  %172 = trunc i64 %170 to i32
  %173 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %168, i32 %172, double zeroinitializer)
  br label %nullish.end.2

nullish.default.2:
  %174 = fneg double 0x3FF0000000000000
  br label %nullish.end.2

nullish.end.2:
  %175 = phi double [ %173, %nullish.value.2 ], [ %174, %nullish.default.2 ]
  %176 = call i8* @nish_str_from_f64(double %175)
  %177 = call i8* @nish_str_concat(i8* %167, i8* %176)
  call void @nish_print(i8* %177)
  %178 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %179 = load i8*, i8** %178, align 8
  %180 = icmp eq i8* %179, %160
  br i1 %180, label %pass.rewind.4, label %pass.free.4

pass.rewind.4:
  %181 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %162, i64* %181, align 8
  br label %pass.done.4

pass.free.4:
  %182 = ptrtoint i8* %160 to i64
  %183 = add i64 %182, %162
  call void @nish_arena_release(i64 %183)
  br label %pass.done.4

pass.done.4:
  br label %walk.inc.4

walk.inc.4:
  %184 = add i32 %156, 1
  %185 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %154, i32 %184)
  store i32 %185, i32* %walk.idx.4, align 4
  br label %walk.cond.4

walk.end.4:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %154)
  %186 = call i8* @nish_alloc_struct(i64 48)
  %187 = bitcast i8* %186 to %struct.Set$f64*
  call void @nish.Set$f64.constructor(%struct.Set$f64* %187)
  store %struct.Set$f64* %187, %struct.Set$f64** %seen.addr, align 8
  %188 = load %struct.Set$f64*, %struct.Set$f64** %seen.addr, align 8
  %189 = load double, double* %z.addr, align 8
  %190 = fneg double %189
  call void @firstOnly(%struct.Set$f64* %188, double %190)
  %191 = load %struct.Set$f64*, %struct.Set$f64** %seen.addr, align 8
  %192 = load double, double* %z.addr, align 8
  call void @firstOnly(%struct.Set$f64* %191, double %192)
  %193 = load %struct.Set$f64*, %struct.Set$f64** %seen.addr, align 8
  call void @nish.Set$f64.walkOpen(%struct.Set$f64* %193)
  %194 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %193, i32 0)
  store i32 %194, i32* %walk.idx.5, align 4
  br label %walk.cond.5

walk.cond.5:
  %195 = load i32, i32* %walk.idx.5, align 4
  %196 = icmp sge i32 %195, 0
  br i1 %196, label %walk.body.5, label %walk.end.5

walk.body.5:
  %197 = call double @nish.Set$f64.keyAt(%struct.Set$f64* %193, i32 %195, double zeroinitializer)
  store double %197, double* %v.addr.1, align 8
  %198 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %199 = load i8*, i8** %198, align 8
  %200 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %201 = load i64, i64* %200, align 8
  %202 = load double, double* %v.addr.1, align 8
  %203 = fdiv double 0x3FF0000000000000, %202
  %204 = call i8* @nish_str_from_f64(double %203)
  %205 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.9 to i8*), i8* %204)
  %206 = call i8* @nish_str_concat(i8* %205, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %207 = load %struct.Set$f64*, %struct.Set$f64** %seen.addr, align 8
  %208 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %207, i32 0, i32 0
  %209 = load double, double* %208, align 8, !tbaa !6
  %210 = call i8* @nish_str_from_f64(double %209)
  %211 = call i8* @nish_str_concat(i8* %206, i8* %210)
  call void @nish_print(i8* %211)
  %212 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %213 = load i8*, i8** %212, align 8
  %214 = icmp eq i8* %213, %199
  br i1 %214, label %pass.rewind.5, label %pass.free.5

pass.rewind.5:
  %215 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %201, i64* %215, align 8
  br label %pass.done.5

pass.free.5:
  %216 = ptrtoint i8* %199 to i64
  %217 = add i64 %216, %201
  call void @nish_arena_release(i64 %217)
  br label %pass.done.5

pass.done.5:
  br label %walk.inc.5

walk.inc.5:
  %218 = add i32 %195, 1
  %219 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %193, i32 %218)
  store i32 %219, i32* %walk.idx.5, align 4
  br label %walk.cond.5

walk.end.5:
  call void @nish.Set$f64.walkClose(%struct.Set$f64* %193)
  %220 = call i8* @nish_alloc_struct(i64 56)
  %221 = bitcast i8* %220 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %221)
  store %struct.Map$f64$f64* %221, %struct.Map$f64$f64** %firsts.addr, align 8
  %222 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %firsts.addr, align 8
  %223 = load double, double* %z.addr, align 8
  %224 = fneg double %223
  call void @firstValue(%struct.Map$f64$f64* %222, double %224, double 0x401C000000000000)
  %225 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %firsts.addr, align 8
  %226 = load double, double* %z.addr, align 8
  call void @firstValue(%struct.Map$f64$f64* %225, double %226, double 0x4020000000000000)
  %227 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %firsts.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %227)
  %228 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %227, i32 0)
  store i32 %228, i32* %walk.idx.6, align 4
  br label %walk.cond.6

walk.cond.6:
  %229 = load i32, i32* %walk.idx.6, align 4
  %230 = icmp sge i32 %229, 0
  br i1 %230, label %walk.body.6, label %walk.end.6

walk.body.6:
  %231 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %227, i32 %229, double zeroinitializer)
  store double %231, double* %k.addr.4, align 8
  %232 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %233 = load i8*, i8** %232, align 8
  %234 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %235 = load i64, i64* %234, align 8
  %236 = load double, double* %k.addr.4, align 8
  %237 = fdiv double 0x3FF0000000000000, %236
  %238 = call i8* @nish_str_from_f64(double %237)
  %239 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %238)
  %240 = call i8* @nish_str_concat(i8* %239, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %241 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %firsts.addr, align 8
  %242 = load double, double* %k.addr.4, align 8
  %243 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %241, double %242)
  %244 = icmp sge i64 %243, 0
  br i1 %244, label %nullish.value.3, label %nullish.default.3

nullish.value.3:
  %245 = trunc i64 %243 to i32
  %246 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %241, i32 %245, double zeroinitializer)
  br label %nullish.end.3

nullish.default.3:
  %247 = fneg double 0x3FF0000000000000
  br label %nullish.end.3

nullish.end.3:
  %248 = phi double [ %246, %nullish.value.3 ], [ %247, %nullish.default.3 ]
  %249 = call i8* @nish_str_from_f64(double %248)
  %250 = call i8* @nish_str_concat(i8* %240, i8* %249)
  call void @nish_print(i8* %250)
  %251 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %252 = load i8*, i8** %251, align 8
  %253 = icmp eq i8* %252, %233
  br i1 %253, label %pass.rewind.6, label %pass.free.6

pass.rewind.6:
  %254 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %235, i64* %254, align 8
  br label %pass.done.6

pass.free.6:
  %255 = ptrtoint i8* %233 to i64
  %256 = add i64 %255, %235
  call void @nish_arena_release(i64 %256)
  br label %pass.done.6

pass.done.6:
  br label %walk.inc.6

walk.inc.6:
  %257 = add i32 %229, 1
  %258 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %227, i32 %257)
  store i32 %258, i32* %walk.idx.6, align 4
  br label %walk.cond.6

walk.end.6:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %227)
  %259 = call i8* @nish_alloc_struct(i64 56)
  %260 = bitcast i8* %259 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %260)
  store %struct.Map$f64$f64* %260, %struct.Map$f64$f64** %ids.addr, align 8
  %261 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %ids.addr, align 8
  %262 = load double, double* %z.addr, align 8
  %263 = fneg double %262
  %264 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %261, double %263)
  %265 = icmp sge i64 %264, 0
  br i1 %265, label %get.found, label %get.insert

get.found:
  %266 = trunc i64 %264 to i32
  %267 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %261, i32 %266, double zeroinitializer)
  br label %get.end

get.insert:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %261, i64 %264, double %263, double 0x4008000000000000)
  br label %get.end

get.end:
  %268 = phi double [ %267, %get.found ], [ 0x4008000000000000, %get.insert ]
  %269 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %ids.addr, align 8
  %270 = load double, double* %z.addr, align 8
  %271 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %269, double %270)
  %272 = icmp sge i64 %271, 0
  br i1 %272, label %get.found.1, label %get.insert.1

get.found.1:
  %273 = trunc i64 %271 to i32
  %274 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %269, i32 %273, double zeroinitializer)
  br label %get.end.1

get.insert.1:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %269, i64 %271, double %270, double 0x4010000000000000)
  br label %get.end.1

get.end.1:
  %275 = phi double [ %274, %get.found.1 ], [ 0x4010000000000000, %get.insert.1 ]
  %276 = fadd double %268, %275
  store double %276, double* %id.addr, align 8
  %277 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %ids.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %277)
  %278 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %277, i32 0)
  store i32 %278, i32* %walk.idx.7, align 4
  br label %walk.cond.7

walk.cond.7:
  %279 = load i32, i32* %walk.idx.7, align 4
  %280 = icmp sge i32 %279, 0
  br i1 %280, label %walk.body.7, label %walk.end.7

walk.body.7:
  %281 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %277, i32 %279, double zeroinitializer)
  store double %281, double* %k.addr.5, align 8
  %282 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %283 = load i8*, i8** %282, align 8
  %284 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %285 = load i64, i64* %284, align 8
  %286 = load double, double* %k.addr.5, align 8
  %287 = fdiv double 0x3FF0000000000000, %286
  %288 = call i8* @nish_str_from_f64(double %287)
  %289 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.11 to i8*), i8* %288)
  %290 = call i8* @nish_str_concat(i8* %289, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %291 = load double, double* %id.addr, align 8
  %292 = call i8* @nish_str_from_f64(double %291)
  %293 = call i8* @nish_str_concat(i8* %290, i8* %292)
  call void @nish_print(i8* %293)
  %294 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %295 = load i8*, i8** %294, align 8
  %296 = icmp eq i8* %295, %283
  br i1 %296, label %pass.rewind.7, label %pass.free.7

pass.rewind.7:
  %297 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %285, i64* %297, align 8
  br label %pass.done.7

pass.free.7:
  %298 = ptrtoint i8* %283 to i64
  %299 = add i64 %298, %285
  call void @nish_arena_release(i64 %299)
  br label %pass.done.7

pass.done.7:
  br label %walk.inc.7

walk.inc.7:
  %300 = add i32 %279, 1
  %301 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %277, i32 %300)
  store i32 %301, i32* %walk.idx.7, align 4
  br label %walk.cond.7

walk.end.7:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %277)
  %302 = call i8* @nish_alloc_struct(i64 48)
  %303 = bitcast i8* %302 to %struct.Set$f64*
  call void @nish.Set$f64.constructor(%struct.Set$f64* %303)
  store %struct.Set$f64* %303, %struct.Set$f64** %nan.addr, align 8
  %304 = load %struct.Set$f64*, %struct.Set$f64** %nan.addr, align 8
  %305 = load double, double* %z.addr, align 8
  %306 = load double, double* %z.addr, align 8
  %307 = fdiv double %305, %306
  %308 = call %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* %304, double %307)
  %309 = load %struct.Set$f64*, %struct.Set$f64** %nan.addr, align 8
  %310 = load double, double* %z.addr, align 8
  %311 = load double, double* %z.addr, align 8
  %312 = fdiv double %310, %311
  %313 = fneg double %312
  %314 = call %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* %309, double %313)
  %315 = load %struct.Set$f64*, %struct.Set$f64** %nan.addr, align 8
  call void @nish.Set$f64.walkOpen(%struct.Set$f64* %315)
  %316 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %315, i32 0)
  store i32 %316, i32* %walk.idx.8, align 4
  br label %walk.cond.8

walk.cond.8:
  %317 = load i32, i32* %walk.idx.8, align 4
  %318 = icmp sge i32 %317, 0
  br i1 %318, label %walk.body.8, label %walk.end.8

walk.body.8:
  %319 = call double @nish.Set$f64.keyAt(%struct.Set$f64* %315, i32 %317, double zeroinitializer)
  store double %319, double* %v.addr.2, align 8
  %320 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %321 = load i8*, i8** %320, align 8
  %322 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %323 = load i64, i64* %322, align 8
  %324 = load double, double* %v.addr.2, align 8
  %325 = call i8* @nish_str_from_f64(double %324)
  %326 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.12 to i8*), i8* %325)
  %327 = call i8* @nish_str_concat(i8* %326, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %328 = load %struct.Set$f64*, %struct.Set$f64** %nan.addr, align 8
  %329 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %328, i32 0, i32 0
  %330 = load double, double* %329, align 8, !tbaa !6
  %331 = call i8* @nish_str_from_f64(double %330)
  %332 = call i8* @nish_str_concat(i8* %327, i8* %331)
  call void @nish_print(i8* %332)
  %333 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %334 = load i8*, i8** %333, align 8
  %335 = icmp eq i8* %334, %321
  br i1 %335, label %pass.rewind.8, label %pass.free.8

pass.rewind.8:
  %336 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %323, i64* %336, align 8
  br label %pass.done.8

pass.free.8:
  %337 = ptrtoint i8* %321 to i64
  %338 = add i64 %337, %323
  call void @nish_arena_release(i64 %338)
  br label %pass.done.8

pass.done.8:
  br label %walk.inc.8

walk.inc.8:
  %339 = add i32 %317, 1
  %340 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %315, i32 %339)
  store i32 %340, i32* %walk.idx.8, align 4
  br label %walk.cond.8

walk.end.8:
  call void @nish.Set$f64.walkClose(%struct.Set$f64* %315)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = sitofp i64 %4 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %b.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %19 = icmp eq i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %b.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i32, i32* %word.addr, align 4
  %23 = bitcast i8* %6 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %21
  store i32 %22, i32* %24, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  ret void

if.end:
  %25 = load i32, i32* %bucket.addr, align 4
  %26 = add i32 %25, 1
  %27 = load i32, i32* %low.addr, align 4
  %28 = and i32 %26, %27
  store i32 %28, i32* %bucket.addr, align 4
  %29 = load i32, i32* %bucket.addr, align 4
  store i32 %29, i32* %b.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %6 = load i32, i32* %from.addr, align 4
  %7 = load i32, i32* %used.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %to.addr, align 4
  %17 = icmp sge i32 %16, 0
  br label %land.end.1

land.end.1:
  %18 = phi i1 [ false, %for.body ], [ %17, %land.rhs.1 ]
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %to.addr, align 4
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp slt i32 %19, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i32, i32* %to.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %h.addr, align 4
  %26 = bitcast i8* %5 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %24
  store i32 %25, i32* %27, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %28 = load i32, i32* %to.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %from.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = fcmp ogt double %40, 0x0000000000000000
  br label %land.end.2

land.end.2:
  %42 = phi i1 [ false, %while.cond ], [ %41, %land.rhs.2 ]
  br i1 %42, label %while.body, label %while.end

while.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %45 = sub i64 %44, 1
  store i64 %45, i64* %43, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %45
  %50 = load i32, i32* %49, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %n.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %10, 32768
  br label %land.end

land.end:
  %12 = phi i1 [ false, %if.end ], [ %11, %land.rhs ]
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  %13 = load i32, i32* %n.addr, align 4
  %14 = mul nsw i32 %13, 2
  %15 = trunc i32 %14 to i16
  %16 = zext i16 %15 to i64
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 %16, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 %16, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %21 = mul i64 %16, 4
  %22 = call i8* @nish_alloc_struct(i64 %21)
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 %21, i1 false), !alias.scope !11, !noalias !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret %struct.nish_array* %18

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, %times
  br i1 %5, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body.1, label %for.end.1

for.body.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 0, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = sitofp i64 %18 to double
  br label %for.inc.1

for.inc.1:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %k.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = icmp ne i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %mask.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %20, i32 %21, i32 %22)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sitofp i64 %1 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %4, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sitofp i64 %1 to double
  %8 = call i32 @llvm.fptosi.sat.i32.f64(double %7)
  %9 = icmp slt i32 %6, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.cond ], [ %9, %land.rhs ]
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %16 = icmp ne i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  ret i32 %17

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %size.addr, align 4
  %8 = load i32, i32* %used.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = mul nsw i64 %9, 4
  %11 = load i32, i32* %size.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = mul nsw i64 %12, 3
  %14 = icmp sgt i64 %10, %13
  br i1 %14, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %15 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %16 = phi i1 [ true, %entry ], [ %15, %lor.rhs.1 ]
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = load i32, i32* %size.addr, align 4
  %18 = icmp sge i32 %bucket, %17
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %lor.end.1 ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp sgt i32 %20, 0
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = sext i32 %bucket to i64
  %23 = load i32, i32* %used.addr, align 4
  %24 = sub nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %25
  %30 = load i32, i32* %29, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %31 = load i32, i32* %used.addr, align 4
  %32 = sub nsw i32 %31, 1
  %33 = call i32 @nish.slotWord(i32 %30, i32 %mask, i32 %32)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %22
  store i32 %33, i32* %37, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !21
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !23
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !24
  %4 = fptosi double 0x4020000000000000 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !11, !noalias !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !25
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !26
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !27
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !28
  ret void
}

define internal noundef i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !28
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %this, double noundef %key, double noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* %this, i32 %4, double %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %this, i64 %5, double %key, double %value)
  br label %if.end

if.end:
  ret %struct.Map$f64$f64* %this
}

define internal void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !24
  ret void
}

define internal noundef i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !24
  ret void
}

define internal noundef double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal noundef double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !27
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !27
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, double noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = fadd double %key, 0.000000e+00
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to double*
  %12 = getelementptr inbounds double, double* %11, i64 %5
  store double %3, double* %12, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = sitofp i64 %13 to double
  %15 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !27
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %16, i64 8)
  br label %push.store.1

push.store.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = bitcast i8* %23 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %18
  store double %value, double* %25, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = sitofp i64 %26 to double
  %28 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !28
  %30 = load i64, i64* %packed.addr, align 8
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %29, i64 4)
  br label %push.store.2

push.store.2:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  store i32 %31, i32* %40, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %42 = sitofp i64 %41 to double
  call void @nish.Map$f64$f64.addOne(%struct.Map$f64$f64* %this)
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !25
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %46 = load i32, i32* %45, align 4, !tbaa !22
  %47 = load i64, i64* %packed.addr, align 8
  %48 = ashr i64 %47, 32
  %49 = trunc i64 %48 to i32
  %50 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !28
  %52 = call i1 @nish.fileAppended(%struct.nish_array* %44, i32 %46, i32 %49, %struct.nish_array* %51)
  %53 = xor i1 %52, true
  br i1 %53, label %if.then, label %if.end

if.then:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.addOne(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !23
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !23
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !21
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !21
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !24
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !23
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !23
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !26
  %27 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !28
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !28
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !28
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !25
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !22
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !28
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal void @nish.Set$f64.constructor(%struct.Set$f64* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !31
  %2 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !32
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !33
  %4 = fptosi double 0x4020000000000000 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !11, !noalias !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !34
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !35
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !36
  ret void
}

define internal noundef i64 @nish.Set$f64.probe(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, double noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !31
  %4 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !36
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !35
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) %this, double noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$f64.probe(%struct.Set$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$f64.insertAt(%struct.Set$f64* %this, i64 %3, double %key)
  br label %if.end

if.end:
  ret %struct.Set$f64* %this
}

define internal void @nish.Set$f64.walkOpen(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !33
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !33
  ret void
}

define internal noundef i32 @nish.Set$f64.walkNext(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$f64.walkClose(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !33
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !33
  ret void
}

define internal noundef double @nish.Set$f64.keyAt(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !35
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal void @nish.Set$f64.insertAt(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, double noundef %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = fadd double %key, 0.000000e+00
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to double*
  %12 = getelementptr inbounds double, double* %11, i64 %5
  store double %3, double* %12, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = sitofp i64 %13 to double
  %15 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !36
  %17 = load i64, i64* %packed.addr, align 8
  %18 = trunc i64 %17 to i32
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %16, i64 4)
  br label %push.store.1

push.store.1:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  store i32 %18, i32* %27, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %29 = sitofp i64 %28 to double
  call void @nish.Set$f64.addOne(%struct.Set$f64* %this)
  %30 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !34
  %32 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  %33 = load i32, i32* %32, align 4, !tbaa !31
  %34 = load i64, i64* %packed.addr, align 8
  %35 = ashr i64 %34, 32
  %36 = trunc i64 %35 to i32
  %37 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %38 = load %struct.nish_array*, %struct.nish_array** %37, align 8, !tbaa !36
  %39 = call i1 @nish.fileAppended(%struct.nish_array* %31, i32 %33, i32 %36, %struct.nish_array* %38)
  %40 = xor i1 %39, true
  br i1 %40, label %if.then, label %if.end

if.then:
  call void @nish.Set$f64.rebuild(%struct.Set$f64* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Set$f64.addOne(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !32
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !32
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !6
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !6
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Set$f64.rebuild(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %7 = load i32, i32* %6, align 4, !tbaa !33
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !34
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !32
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !32
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !35
  %27 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !36
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !36
  call void @nish.compactHashes(%struct.nish_array* %30)
  br label %if.end

if.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %32 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  store %struct.nish_array* %31, %struct.nish_array** %32, align 8, !tbaa !34
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %36 = sitofp i64 %35 to double
  %37 = call i32 @llvm.fptosi.sat.i32.f64(double %36)
  %38 = sub nsw i32 %37, 1
  %39 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  store i32 %38, i32* %39, align 4, !tbaa !31
  %40 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %41 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %42 = load %struct.nish_array*, %struct.nish_array** %41, align 8, !tbaa !36
  call void @nish.refile(%struct.nish_array* %40, %struct.nish_array* %42)
  ret void
}

define internal void @nish.Map$f64$str.constructor(%struct.Map$f64$str* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !38
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !39
  %2 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !40
  %3 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !41
  %4 = fptosi double 0x4020000000000000 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !11, !noalias !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !42
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !43
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !44
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !45
  ret void
}

define internal noundef i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !42
  %2 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !39
  %4 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !45
  %6 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !43
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) %this, double noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f64$str.setValueAt(%struct.Map$f64$str* %this, i32 %4, i8* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f64$str.insertAt(%struct.Map$f64$str* %this, i64 %5, double %key, i8* %value)
  br label %if.end

if.end:
  ret %struct.Map$f64$str* %this
}

define internal void @nish.Map$f64$str.walkOpen(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !41
  ret void
}

define internal noundef i32 @nish.Map$f64$str.walkNext(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !45
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f64$str.walkClose(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !41
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !41
  ret void
}

define internal noundef double @nish.Map$f64$str.keyAt(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !43
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !43
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal noundef nonnull align 8 i8* @nish.Map$f64$str.valueAt(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i8* noundef nonnull noalias readonly align 8 %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !44
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !44
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %11
  %16 = load i8*, i8** %15, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  ret i8* %16

if.end:
  ret i8* %none
}

define internal void @nish.Map$f64$str.setValueAt(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i8* noundef nonnull noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !44
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !44
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %11
  store i8* %value, i8** %15, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$str.insertAt(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !43
  %3 = fadd double %key, 0.000000e+00
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to double*
  %12 = getelementptr inbounds double, double* %11, i64 %5
  store double %3, double* %12, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = sitofp i64 %13 to double
  %15 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !44
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %16, i64 8)
  br label %push.store.1

push.store.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %18
  store i8* %value, i8** %25, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = sitofp i64 %26 to double
  %28 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !45
  %30 = load i64, i64* %packed.addr, align 8
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %29, i64 4)
  br label %push.store.2

push.store.2:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  store i32 %31, i32* %40, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %42 = sitofp i64 %41 to double
  call void @nish.Map$f64$str.addOne(%struct.Map$f64$str* %this)
  %43 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !42
  %45 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  %46 = load i32, i32* %45, align 4, !tbaa !39
  %47 = load i64, i64* %packed.addr, align 8
  %48 = ashr i64 %47, 32
  %49 = trunc i64 %48 to i32
  %50 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !45
  %52 = call i1 @nish.fileAppended(%struct.nish_array* %44, i32 %46, i32 %49, %struct.nish_array* %51)
  %53 = xor i1 %52, true
  br i1 %53, label %if.then, label %if.end

if.then:
  call void @nish.Map$f64$str.rebuild(%struct.Map$f64$str* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$str.addOne(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !40
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !40
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !38
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !38
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$f64$str.rebuild(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !43
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !41
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !42
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !40
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !40
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !43
  %27 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !45
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !44
  %31 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !45
  call void @nish.compactEntries$str(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !45
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !42
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !39
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !45
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal noundef i64 @nish.probeTable$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, double noundef %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = fadd double %key, 0.000000e+00
  %1 = fcmp uno double %0, %0
  %2 = bitcast double %0 to i64
  %3 = select i1 %1, i64 9221120237041090560, i64 %2
  %4 = lshr i64 %3, 33
  %5 = xor i64 %3, %4
  %6 = mul i64 %5, -49064778989728563
  %7 = lshr i64 %6, 33
  %8 = xor i64 %6, %7
  %9 = mul i64 %8, -4265267296055464877
  %10 = lshr i64 %9, 33
  %11 = xor i64 %9, %10
  %12 = trunc i64 %11 to i32
  %13 = lshr i64 %11, 32
  %14 = trunc i64 %13 to i32
  %15 = xor i32 %12, %14
  %16 = icmp eq i32 %15, 0
  %17 = select i1 %16, i32 1, i32 %15
  store i32 %17, i32* %h.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = load i32, i32* %low.addr, align 4
  %20 = xor i32 %19, -1
  %21 = and i32 %18, %20
  store i32 %21, i32* %fingerprint.addr, align 4
  %22 = load i32, i32* %h.addr, align 4
  %23 = call i32 @nish.homeBucket(i32 %22, i32 %mask)
  store i32 %23, i32* %bucket.addr, align 4
  %24 = load i32, i32* %bucket.addr, align 4
  store i32 %24, i32* %b.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %37 = load i32, i32* %b.addr, align 4
  %38 = icmp sge i32 %37, 0
  br i1 %38, label %land.rhs, label %land.end

land.rhs:
  %39 = load i32, i32* %b.addr, align 4
  %40 = sitofp i64 %26 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = icmp slt i32 %39, %41
  br label %land.end

land.end:
  %43 = phi i1 [ false, %while.cond ], [ %42, %land.rhs ]
  br i1 %43, label %while.body, label %while.end

while.body:
  %44 = load i32, i32* %b.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = bitcast i8* %28 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %45
  %48 = load i32, i32* %47, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %48, i32* %word.addr, align 4
  %49 = load i32, i32* %word.addr, align 4
  %50 = icmp eq i32 %49, 0
  br i1 %50, label %if.then, label %if.end

if.then:
  %51 = load i32, i32* %b.addr, align 4
  %52 = load i32, i32* %h.addr, align 4
  %53 = tail call i64 @nish.absentAt(i32 %51, i32 %52)
  ret i64 %53

if.end:
  %54 = load i32, i32* %word.addr, align 4
  %55 = load i32, i32* %low.addr, align 4
  %56 = xor i32 %55, -1
  %57 = and i32 %54, %56
  %58 = load i32, i32* %fingerprint.addr, align 4
  %59 = icmp eq i32 %57, %58
  br i1 %59, label %if.then.1, label %if.end.1

if.then.1:
  %60 = load i32, i32* %word.addr, align 4
  %61 = load i32, i32* %low.addr, align 4
  %62 = and i32 %60, %61
  %63 = sub i32 %62, 1
  store i32 %63, i32* %at.addr, align 4
  %64 = load i32, i32* %at.addr, align 4
  %65 = icmp sge i32 %64, 0
  br i1 %65, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %66 = load i32, i32* %at.addr, align 4
  %67 = sitofp i64 %30 to double
  %68 = call i32 @llvm.fptosi.sat.i32.f64(double %67)
  %69 = icmp slt i32 %66, %68
  br label %land.end.4

land.end.4:
  %70 = phi i1 [ false, %if.then.1 ], [ %69, %land.rhs.4 ]
  br i1 %70, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %71 = load i32, i32* %at.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = bitcast i8* %32 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 %72
  %75 = load i32, i32* %74, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %76 = load i32, i32* %h.addr, align 4
  %77 = icmp eq i32 %75, %76
  br label %land.end.3

land.end.3:
  %78 = phi i1 [ false, %land.end.4 ], [ %77, %land.rhs.3 ]
  br i1 %78, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %79 = load i32, i32* %at.addr, align 4
  %80 = sitofp i64 %34 to double
  %81 = call i32 @llvm.fptosi.sat.i32.f64(double %80)
  %82 = icmp slt i32 %79, %81
  br label %land.end.2

land.end.2:
  %83 = phi i1 [ false, %land.end.3 ], [ %82, %land.rhs.2 ]
  br i1 %83, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %84 = load i32, i32* %at.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = bitcast i8* %36 to double*
  %87 = getelementptr inbounds double, double* %86, i64 %85
  %88 = load double, double* %87, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %89 = fcmp oeq double %88, %key
  %90 = fcmp uno double %88, %88
  %91 = fcmp uno double %key, %key
  %92 = and i1 %90, %91
  %93 = or i1 %89, %92
  br label %land.end.1

land.end.1:
  %94 = phi i1 [ false, %land.end.2 ], [ %93, %land.rhs.1 ]
  br i1 %94, label %if.then.2, label %if.end.2

if.then.2:
  %95 = load i32, i32* %b.addr, align 4
  %96 = load i32, i32* %at.addr, align 4
  %97 = tail call i64 @nish.foundAt(i32 %95, i32 %96)
  ret i64 %97

if.end.2:
  br label %if.end.1

if.end.1:
  %98 = load i32, i32* %bucket.addr, align 4
  %99 = add i32 %98, 1
  %100 = load i32, i32* %low.addr, align 4
  %101 = and i32 %99, %100
  store i32 %101, i32* %bucket.addr, align 4
  %102 = load i32, i32* %bucket.addr, align 4
  store i32 %102, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %104 = load i64, i64* %103, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %105 = sitofp i64 %104 to double
  %106 = call i32 @llvm.fptosi.sat.i32.f64(double %105)
  %107 = load i32, i32* %h.addr, align 4
  %108 = tail call i64 @nish.absentAt(i32 %106, i32 %107)
  ret i64 %108
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = sitofp i64 %58 to double
  %60 = fcmp ogt double %59, 0x0000000000000000
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %while.cond ], [ %60, %land.rhs.4 ]
  br i1 %61, label %while.body, label %while.end

while.body:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %64 = sub i64 %63, 1
  store i64 %64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %67 = bitcast i8* %66 to double*
  %68 = getelementptr inbounds double, double* %67, i64 %64
  %69 = load double, double* %68, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %41
  %44 = load i8*, i8** %43, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = sitofp i64 %58 to double
  %60 = fcmp ogt double %59, 0x0000000000000000
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %while.cond ], [ %60, %land.rhs.4 ]
  br i1 %61, label %while.body, label %while.end

while.body:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %64 = sub i64 %63, 1
  store i64 %64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %67 = bitcast i8* %66 to i8**
  %68 = getelementptr inbounds i8*, i8** %67, i64 %64
  %69 = load i8*, i8** %68, align 8, !alias.scope !11, !noalias !10, !tbaa !47
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!48, !49, !50, !51, !52}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Set$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !4, i64 40}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!14, !12, i64 8}
!20 = !{!"Map$f64$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!21 = !{!20, !2, i64 0}
!22 = !{!20, !4, i64 16}
!23 = !{!20, !4, i64 20}
!24 = !{!20, !4, i64 48}
!25 = !{!20, !3, i64 8}
!26 = !{!20, !3, i64 24}
!27 = !{!20, !3, i64 32}
!28 = !{!20, !3, i64 40}
!29 = !{!"element double", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{!5, !4, i64 16}
!32 = !{!5, !4, i64 20}
!33 = !{!5, !4, i64 40}
!34 = !{!5, !3, i64 8}
!35 = !{!5, !3, i64 24}
!36 = !{!5, !3, i64 32}
!37 = !{!"Map$f64$str", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!38 = !{!37, !2, i64 0}
!39 = !{!37, !4, i64 16}
!40 = !{!37, !4, i64 20}
!41 = !{!37, !4, i64 48}
!42 = !{!37, !3, i64 8}
!43 = !{!37, !3, i64 24}
!44 = !{!37, !3, i64 32}
!45 = !{!37, !3, i64 40}
!46 = !{!"element ptr", !1, i64 0}
!47 = !{!46, !46, i64 0}
!48 = !{i32 8, !"cf-protection-branch", i32 1}
!49 = !{i32 8, !"cf-protection-return", i32 1}
!50 = !{i32 8, !"branch-target-enforcement", i32 1}
!51 = !{i32 8, !"sign-return-address", i32 1}
!52 = !{i32 4, !"probe-stack", !"inline-asm"}
