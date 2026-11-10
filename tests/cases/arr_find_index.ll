%struct.User = type { i8*, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ann\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bob\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" is \00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define void @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %users.addr = alloca %struct.nish_array*, align 8
  %User.obj = alloca %struct.User, align 8
  %User.obj.1 = alloca %struct.User, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %struct.User], align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 4, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 9, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 9, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = call i32 @nish.findIndex$i32$fn.16.nish_main$arrow0(%struct.nish_array* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = call i32 @nish.findIndex$i32$fn.16.nish_main$arrow1(%struct.nish_array* %13)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %12, i8* %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %18 = call i32 @nish.findIndexIndexed$i32$fn.16.nish_main$arrow2(%struct.nish_array* %17)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = getelementptr inbounds %struct.User, %struct.User* %User.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %20, align 8
  %21 = getelementptr inbounds %struct.User, %struct.User* %User.obj, i32 0, i32 1
  store i32 31, i32* %21, align 4
  %22 = getelementptr inbounds %struct.User, %struct.User* %User.obj.1, i32 0, i32 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %22, align 8
  %23 = getelementptr inbounds %struct.User, %struct.User* %User.obj.1, i32 0, i32 1
  store i32 17, i32* %23, align 4
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast [2 x %struct.User]* %arr.data.1 to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %26 to %struct.User*
  %29 = getelementptr inbounds %struct.User, %struct.User* %28, i64 0
  %30 = bitcast %struct.User* %29 to i8*
  %31 = bitcast %struct.User* %User.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %30, i8* align 8 %31, i64 16, i1 false), !alias.scope !4, !noalias !3
  %32 = getelementptr inbounds %struct.User, %struct.User* %28, i64 1
  %33 = bitcast %struct.User* %32 to i8*
  %34 = bitcast %struct.User* %User.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %33, i8* align 8 %34, i64 16, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %users.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %users.addr, align 8
  %36 = call i32 @nish.findIndex$$User$fn.16.nish_main$arrow3(%struct.nish_array* %35)
  store i32 %36, i32* %i.addr, align 4
  %37 = load i32, i32* %i.addr, align 4
  %38 = icmp sge i32 %37, 0
  br i1 %38, label %if.then, label %if.end

if.then:
  %39 = load %struct.nish_array*, %struct.nish_array** %users.addr, align 8
  %40 = load i32, i32* %i.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 %41, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %41, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to %struct.User*
  %48 = getelementptr inbounds %struct.User, %struct.User* %47, i64 %41
  %49 = getelementptr inbounds %struct.User, %struct.User* %48, i32 0, i32 0
  %50 = load i8*, i8** %49, align 8
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  %52 = load %struct.nish_array*, %struct.nish_array** %users.addr, align 8
  %53 = load i32, i32* %i.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to %struct.User*
  %58 = getelementptr inbounds %struct.User, %struct.User* %57, i64 %54
  %59 = getelementptr inbounds %struct.User, %struct.User* %58, i32 0, i32 1
  %60 = load i32, i32* %59, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %51, i8* %61)
  call void @nish_print(i8* %62)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden noundef zeroext i1 @nish_main$arrow0(i32 noundef %x) #1 {
entry:
  %0 = icmp eq i32 %x, 9
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow1(i32 noundef %x) #1 {
entry:
  %0 = icmp eq i32 %x, 7
  ret i1 %0
}

define hidden noundef zeroext i1 @nish_main$arrow2(i32 noundef %x, i32 noundef %i) #1 {
entry:
  %0 = icmp sgt i32 %i, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %x, 5
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define hidden noundef zeroext i1 @nish_main$arrow3(%struct.User* noundef nonnull readonly align 8 dereferenceable(16) nocapture %u) #2 {
entry:
  %0 = getelementptr inbounds %struct.User, %struct.User* %u, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = icmp slt i32 %1, 18
  ret i1 %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.findIndex$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow0(i32 %18)
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %i.addr, align 4
  ret i32 %20

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef i32 @nish.findIndex$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = call i1 @nish_main$arrow1(i32 %18)
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %i.addr, align 4
  ret i32 %20

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef i32 @nish.findIndexIndexed$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = load i32, i32* %i.addr, align 4
  %20 = call i1 @nish_main$arrow2(i32 %18, i32 %19)
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load i32, i32* %i.addr, align 4
  ret i32 %21

if.end:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef i32 @nish.findIndex$$User$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #3 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to %struct.User*
  %17 = getelementptr inbounds %struct.User, %struct.User* %16, i64 %15
  %18 = call i1 @nish_main$arrow3(%struct.User* %17)
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %i.addr, align 4
  ret i32 %19

if.end:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
