try {
  await import("@effect/platform-bun/BunServices");
  console.log("BunServices OK");
} catch (e) {
  console.log("FAIL:", e.message.split("\n")[0]);
}
