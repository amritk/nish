%struct.Rng = type { i32 }

define internal noundef i32 @nish.mix(i32 noundef %h) #0 {
entry:
  %x.addr = alloca i32, align 4
  store i32 %h, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = load i32, i32* %x.addr, align 4
  %2 = lshr i32 %1, 16
  %3 = xor i32 %0, %2
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = mul i32 %4, -2048144789
  store i32 %5, i32* %x.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  %8 = lshr i32 %7, 13
  %9 = xor i32 %6, %8
  store i32 %9, i32* %x.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = mul i32 %10, -1028477387
  store i32 %11, i32* %x.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = lshr i32 %13, 16
  %15 = xor i32 %12, %14
  store i32 %15, i32* %x.addr, align 4
  %16 = load i32, i32* %x.addr, align 4
  ret i32 %16
}

define void @nish.Rng.constructor(%struct.Rng* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %seed) #1 {
entry:
  %0 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  store i32 %seed, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @nish.Rng.nextI32(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = add i32 %1, -1640531527
  %3 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  store i32 %2, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = tail call i32 @nish.mix(i32 %5)
  ret i32 %6
}

define noundef double @nish.Rng.nextF64(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %hi.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %0 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  %1 = lshr i32 %0, 5
  store i32 %1, i32* %hi.addr, align 4
  %2 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  %3 = lshr i32 %2, 6
  store i32 %3, i32* %lo.addr, align 4
  %4 = load i32, i32* %hi.addr, align 4
  %5 = sitofp i32 %4 to double
  %6 = fmul double %5, 0x4190000000000000
  %7 = load i32, i32* %lo.addr, align 4
  %8 = sitofp i32 %7 to double
  %9 = fadd double %6, %8
  %10 = fdiv double %9, 0x4340000000000000
  ret double %10
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Rng", !2, i64 0}
!4 = !{!3, !2, i64 0}
