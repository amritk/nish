%struct.Node = type { i32, %struct.Node* }
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"node \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #4
declare void @sts_free_arena() #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
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

define void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4
  ret void
}

define noundef i32 @sum(%struct.Node* noundef align 8 %head) #1 {
entry:
  %total.addr = alloca i32, align 4
  %cur.addr = alloca %struct.Node*, align 8
  store i32 0, i32* %total.addr, align 4
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = icmp ne %struct.Node* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %4 = getelementptr inbounds %struct.Node, %struct.Node* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = add i32 %2, %5
  store i32 %6, i32* %total.addr, align 4
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load i32, i32* %total.addr, align 4
  ret i32 %10
}

define noundef align 8 %struct.Node* @find(%struct.Node* noundef align 8 %head, i32 noundef %want) #1 {
entry:
  %cur.addr = alloca %struct.Node*, align 8
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = icmp ne %struct.Node* %0, null
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %3 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp ne i32 %4, %want
  br label %land.end

land.end:
  %6 = phi i1 [ false, %while.cond ], [ %5, %land.rhs ]
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  ret %struct.Node* %10
}

define noundef nonnull align 8 i8* @describe(%struct.Node* noundef readonly align 8 nocapture %n) #0 {
entry:
  %0 = icmp eq %struct.Node* %n, null
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)

if.end:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = call i8* @sts_str_from_i32(i32 %2)
  %4 = call i8* @sts_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %3)
  ret i8* %4
}

define noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #2 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %fallback, %cond.false ]
  ret i32 %3
}

define noundef nonnull align 8 dereferenceable(16) %struct.Node* @last(%struct.Node* noundef nonnull align 8 dereferenceable(16) %head) #1 {
entry:
  %cur.addr = alloca %struct.Node*, align 8
  %next.addr = alloca %struct.Node*, align 8
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %0, i32 0, i32 1
  %2 = load %struct.Node*, %struct.Node** %1, align 8
  store %struct.Node* %2, %struct.Node** %next.addr, align 8
  br label %while.cond

while.cond:
  %3 = load %struct.Node*, %struct.Node** %next.addr, align 8
  %4 = icmp ne %struct.Node* %3, null
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load %struct.Node*, %struct.Node** %next.addr, align 8
  store %struct.Node* %5, %struct.Node** %cur.addr, align 8
  %6 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 1
  %8 = load %struct.Node*, %struct.Node** %7, align 8
  store %struct.Node* %8, %struct.Node** %next.addr, align 8
  br label %while.cond

while.end:
  %9 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  ret %struct.Node* %9
}

define noundef i32 @sts_main() #3 {
entry:
  %a.addr = alloca %struct.Node*, align 8
  %b.addr = alloca %struct.Node*, align 8
  %c.addr = alloca %struct.Node*, align 8
  %s.addr = alloca i8*, align 8
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [2 x %struct.Node*], align 8
  %x0.addr = alloca %struct.Node*, align 8
  %x1.addr = alloca %struct.Node*, align 8
  %0 = call i8* @sts_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 1)
  store %struct.Node* %1, %struct.Node** %a.addr, align 8
  %2 = call i8* @sts_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.Node*
  call void @Node.constructor(%struct.Node* %3, i32 2)
  store %struct.Node* %3, %struct.Node** %b.addr, align 8
  %4 = call i8* @sts_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.Node*
  call void @Node.constructor(%struct.Node* %5, i32 3)
  store %struct.Node* %5, %struct.Node** %c.addr, align 8
  %6 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %7 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 1
  store %struct.Node* %7, %struct.Node** %8, align 8
  %9 = load %struct.Node*, %struct.Node** %b.addr, align 8
  %10 = load %struct.Node*, %struct.Node** %c.addr, align 8
  %11 = getelementptr inbounds %struct.Node, %struct.Node* %9, i32 0, i32 1
  store %struct.Node* %10, %struct.Node** %11, align 8
  %12 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %13 = call i32 @sum(%struct.Node* %12)
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = call i32 @sum(%struct.Node* null)
  %16 = call i8* @sts_str_from_i32(i32 %15)
  call void @sts_print(i8* %16)
  %17 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %18 = call %struct.Node* @find(%struct.Node* %17, i32 2)
  %19 = call i8* @describe(%struct.Node* %18)
  call void @sts_print(i8* %19)
  %20 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %21 = call %struct.Node* @find(%struct.Node* %20, i32 9)
  %22 = call i8* @describe(%struct.Node* %21)
  call void @sts_print(i8* %22)
  %23 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %24 = call %struct.Node* @find(%struct.Node* %23, i32 3)
  %25 = sub i32 0, 1
  %26 = call i32 @valueOr(%struct.Node* %24, i32 %25)
  %27 = call i8* @sts_str_from_i32(i32 %26)
  call void @sts_print(i8* %27)
  %28 = sub i32 0, 1
  %29 = call i32 @valueOr(%struct.Node* null, i32 %28)
  %30 = call i8* @sts_str_from_i32(i32 %29)
  call void @sts_print(i8* %30)
  %31 = load %struct.Node*, %struct.Node** %a.addr, align 8
  %32 = call %struct.Node* @last(%struct.Node* %31)
  %33 = getelementptr inbounds %struct.Node, %struct.Node* %32, i32 0, i32 0
  %34 = load i32, i32* %33, align 4
  %35 = call i8* @sts_str_from_i32(i32 %34)
  call void @sts_print(i8* %35)
  store i8* null, i8** %s.addr, align 8
  %36 = load i8*, i8** %s.addr, align 8
  %37 = icmp eq i8* %36, null
  %38 = select i1 %37, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @sts_print(i8* %38)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8** %s.addr, align 8
  %39 = load i8*, i8** %s.addr, align 8
  %40 = icmp ne i8* %39, null
  br i1 %40, label %if.then, label %if.end

if.then:
  %41 = load i8*, i8** %s.addr, align 8
  %42 = bitcast i8* %41 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = trunc i64 %43 to i32
  %45 = call i8* @sts_str_from_i32(i32 %44)
  call void @sts_print(i8* %45)
  br label %if.end

if.end:
  %46 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %46, align 8
  %47 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %47, align 8
  %48 = mul i64 2, 8
  %49 = bitcast [2 x %struct.Node*]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %49, i8 0, i64 %48, i1 false)
  %50 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %49, i8** %50, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  %51 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %52 = load %struct.Node*, %struct.Node** %c.addr, align 8
  %53 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %51, i64 0, i32 0
  %54 = load i64, i64* %53, align 8
  %55 = icmp ult i64 1, %54
  br i1 %55, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 1, i64 %54)
  unreachable

bounds.ok:
  %56 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %51, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8
  %58 = bitcast i8* %57 to %struct.Node**
  %59 = getelementptr inbounds %struct.Node*, %struct.Node** %58, i64 1
  store %struct.Node* %52, %struct.Node** %59, align 8
  %60 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %61 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8
  %63 = icmp ult i64 0, %62
  br i1 %63, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 0, i64 %62)
  unreachable

bounds.ok.1:
  %64 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8
  %66 = bitcast i8* %65 to %struct.Node**
  %67 = getelementptr inbounds %struct.Node*, %struct.Node** %66, i64 0
  %68 = load %struct.Node*, %struct.Node** %67, align 8
  store %struct.Node* %68, %struct.Node** %x0.addr, align 8
  %69 = load %struct.Node*, %struct.Node** %x0.addr, align 8
  %70 = icmp eq %struct.Node* %69, null
  %71 = select i1 %70, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @sts_print(i8* %71)
  %72 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %73 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8
  %75 = icmp ult i64 1, %74
  br i1 %75, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 1, i64 %74)
  unreachable

bounds.ok.2:
  %76 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8
  %78 = bitcast i8* %77 to %struct.Node**
  %79 = getelementptr inbounds %struct.Node*, %struct.Node** %78, i64 1
  %80 = load %struct.Node*, %struct.Node** %79, align 8
  store %struct.Node* %80, %struct.Node** %x1.addr, align 8
  %81 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %82 = icmp ne %struct.Node* %81, null
  br i1 %82, label %if.then.1, label %if.end.1

if.then.1:
  %83 = load %struct.Node*, %struct.Node** %x1.addr, align 8
  %84 = getelementptr inbounds %struct.Node, %struct.Node* %83, i32 0, i32 0
  %85 = load i32, i32* %84, align 4
  %86 = call i8* @sts_str_from_i32(i32 %85)
  call void @sts_print(i8* %86)
  br label %if.end.1

if.end.1:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }
