%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp ult i64 %7, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  store i32 %8, i32* %11, align 4, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %total.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %8
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3
  %13 = add nsw i32 %6, %12
  store i32 %13, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 1000, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = mul i64 %1, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  call void @fill(%struct.nish_array* %9, i32 %10)
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = load i32, i32* %n.addr, align 4
  %13 = call i32 @sum(%struct.nish_array* %11, i32 %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
