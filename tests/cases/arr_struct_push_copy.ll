%struct.Cell = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @test() #0 {
entry:
  %cells.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %Cell.obj.1 = alloca %struct.Cell, align 8
  %Cell.obj.2 = alloca %struct.Cell, align 8
  %found.addr = alloca i32, align 4
  %idx.at = alloca i64, align 8
  %last.addr = alloca %struct.Cell*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %cells.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %4 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store i32 1, i32* %4, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 4)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast i8* %11 to %struct.Cell*
  %13 = getelementptr inbounds %struct.Cell, %struct.Cell* %12, i64 %6
  %14 = bitcast %struct.Cell* %13 to i8*
  %15 = bitcast %struct.Cell* %Cell.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %14, i8* align 4 %15, i64 4, i1 false), !alias.scope !4, !noalias !3
  %16 = add i64 %6, 1
  store i64 %16, i64* %5, align 8, !alias.scope !3, !noalias !4
  %17 = trunc i64 %16 to i32
  %18 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %19 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj.1, i32 0, i32 0
  store i32 2, i32* %19, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %18, i64 4)
  br label %push.store.1

push.store.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4
  %27 = bitcast i8* %26 to %struct.Cell*
  %28 = getelementptr inbounds %struct.Cell, %struct.Cell* %27, i64 %21
  %29 = bitcast %struct.Cell* %28 to i8*
  %30 = bitcast %struct.Cell* %Cell.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %29, i8* align 4 %30, i64 4, i1 false), !alias.scope !4, !noalias !3
  %31 = add i64 %21, 1
  store i64 %31, i64* %20, align 8, !alias.scope !3, !noalias !4
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %34 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj.2, i32 0, i32 0
  store i32 3, i32* %34, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.2

push.store.2:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4
  %42 = bitcast i8* %41 to %struct.Cell*
  %43 = getelementptr inbounds %struct.Cell, %struct.Cell* %42, i64 %36
  %44 = bitcast %struct.Cell* %43 to i8*
  %45 = bitcast %struct.Cell* %Cell.obj.2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %44, i8* align 4 %45, i64 4, i1 false), !alias.scope !4, !noalias !3
  %46 = add i64 %36, 1
  store i64 %46, i64* %35, align 8, !alias.scope !3, !noalias !4
  %47 = trunc i64 %46 to i32
  %48 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4
  %51 = icmp ult i64 0, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4
  %54 = bitcast i8* %53 to %struct.Cell*
  %55 = getelementptr inbounds %struct.Cell, %struct.Cell* %54, i64 0
  %56 = getelementptr inbounds %struct.Cell, %struct.Cell* %55, i32 0, i32 0
  store i32 40, i32* %56, align 4
  %57 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4
  %61 = icmp ult i64 2, %60
  br i1 %61, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %60)
  unreachable

bounds.ok.1:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4
  %64 = bitcast i8* %63 to %struct.Cell*
  %65 = getelementptr inbounds %struct.Cell, %struct.Cell* %64, i64 2
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %68 = load i64, i64* %idx.at, align 8
  %69 = icmp ult i64 %68, %67
  br i1 %69, label %idx.test, label %idx.miss

idx.test:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4
  %72 = bitcast i8* %71 to %struct.Cell*
  %73 = getelementptr inbounds %struct.Cell, %struct.Cell* %72, i64 %68
  %74 = icmp eq %struct.Cell* %73, %65
  br i1 %74, label %idx.found, label %idx.next

idx.next:
  %75 = add i64 %68, 1
  store i64 %75, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %76 = phi i64 [ %68, %idx.test ], [ -1, %idx.miss ]
  %77 = trunc i64 %76 to i32
  store i32 %77, i32* %found.addr, align 4
  %78 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4
  %81 = icmp eq i64 %80, 0
  br i1 %81, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %82 = sub i64 %80, 1
  store i64 %82, i64* %79, align 8, !alias.scope !3, !noalias !4
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4
  %85 = bitcast i8* %84 to %struct.Cell*
  %86 = getelementptr inbounds %struct.Cell, %struct.Cell* %85, i64 %82
  store %struct.Cell* %86, %struct.Cell** %last.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4
  %90 = icmp ult i64 0, %89
  br i1 %90, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %89)
  unreachable

bounds.ok.2:
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4
  %93 = bitcast i8* %92 to %struct.Cell*
  %94 = getelementptr inbounds %struct.Cell, %struct.Cell* %93, i64 0
  %95 = getelementptr inbounds %struct.Cell, %struct.Cell* %94, i32 0, i32 0
  %96 = load i32, i32* %95, align 4
  %97 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4
  %100 = icmp ult i64 1, %99
  br i1 %100, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %99)
  unreachable

bounds.ok.3:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4
  %103 = bitcast i8* %102 to %struct.Cell*
  %104 = getelementptr inbounds %struct.Cell, %struct.Cell* %103, i64 1
  %105 = getelementptr inbounds %struct.Cell, %struct.Cell* %104, i32 0, i32 0
  %106 = load i32, i32* %105, align 4
  %107 = add nsw i32 %96, %106
  %108 = load %struct.Cell*, %struct.Cell** %last.addr, align 8
  %109 = getelementptr inbounds %struct.Cell, %struct.Cell* %108, i32 0, i32 0
  %110 = load i32, i32* %109, align 4
  %111 = add nsw i32 %107, %110
  %112 = load i32, i32* %found.addr, align 4
  %113 = add nsw i32 %111, %112
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %113
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
