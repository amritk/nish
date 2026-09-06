class Base {
  ping(): number {
    return 1;
  }
}

function pong(): number {
  return super.ping();
}
