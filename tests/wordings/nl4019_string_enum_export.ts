// NL4019 (with --emit-header): an exported function that returns a string enum.
enum Role {
  Admin = "admin",
  Guest = "guest",
}

export const fallback = (): Role => Role.Guest
