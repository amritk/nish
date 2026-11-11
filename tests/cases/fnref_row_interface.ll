%struct.Named = type { i32 }
%struct.Tool = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @u1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @u2(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @u3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define internal void @Tool.constructor(%struct.Tool* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %f) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tool, %struct.Tool* %this, i32 0, i32 0
  store i32 %f, i32* %0, align 4
  ret void
}

define internal void @storeThrough(%struct.Named* noundef nonnull align 8 dereferenceable(4) nocapture %n) #1 {
entry:
  %0 = getelementptr inbounds %struct.Named, %struct.Named* %n, i32 0, i32 0
  store i32 3, i32* %0, align 4
  ret void
}

define internal noundef i32 @callThrough(%struct.Named* noundef nonnull readonly align 8 dereferenceable(4) nocapture %n) #2 {
entry:
  %0 = getelementptr inbounds %struct.Named, %struct.Named* %n, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = call i32 @$ref.0.fr1.i32.i32.0(i32 %1, i32 10)
  ret i32 %2
}

define void @nish_main() #3 {
entry:
  %other.addr = alloca i32, align 4
  %t.addr = alloca %struct.Tool*, align 8
  %Tool.obj = alloca %struct.Tool, align 8
  %before.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %back.addr = alloca %struct.Tool*, align 8
  %Tool.obj.1 = alloca %struct.Tool, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  call void @Tool.constructor(%struct.Tool* %Tool.obj, i32 1)
  store %struct.Tool* %Tool.obj, %struct.Tool** %t.addr, align 8
  %0 = load %struct.Tool*, %struct.Tool** %t.addr, align 8
  %1 = getelementptr inbounds %struct.Tool, %struct.Tool* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = call i32 @$ref.0.fr1.i32.i32.0(i32 %2, i32 10)
  store i32 %3, i32* %before.addr, align 4
  %4 = load %struct.Tool*, %struct.Tool** %t.addr, align 8
  %5 = bitcast %struct.Tool* %4 to %struct.Named*
  call void @storeThrough(%struct.Named* %5)
  %6 = load %struct.Tool*, %struct.Tool** %t.addr, align 8
  %7 = getelementptr inbounds %struct.Tool, %struct.Tool* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = call i32 @$ref.0.fr1.i32.i32.0(i32 %8, i32 10)
  store i32 %9, i32* %after.addr, align 4
  call void @Tool.constructor(%struct.Tool* %Tool.obj.1, i32 1)
  store %struct.Tool* %Tool.obj.1, %struct.Tool** %back.addr, align 8
  %10 = load %struct.Tool*, %struct.Tool** %back.addr, align 8
  %11 = getelementptr inbounds %struct.Tool, %struct.Tool* %10, i32 0, i32 0
  store i32 3, i32* %11, align 4
  %12 = load i32, i32* %before.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i32, i32* %after.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = load %struct.Tool*, %struct.Tool** %back.addr, align 8
  %20 = bitcast %struct.Tool* %19 to %struct.Named*
  %21 = call i32 @callThrough(%struct.Named* %20)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %18, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load i32, i32* %other.addr, align 4
  %26 = call i32 @$ref.0.fr1.i32.i32.1(i32 %25, i32 10)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %24, i8* %27)
  call void @nish_print(i8* %28)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @u1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @u3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @u2(i32 %$a0)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
