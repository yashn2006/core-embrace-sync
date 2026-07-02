import confetti from "canvas-confetti";

export function celebrateWin() {
  const magenta = ["#EC4899", "#F472B6", "#FBCFE8", "#FDF2F8", "#BE185D"];
  const shoot = (originX: number) =>
    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 45,
      ticks: 200,
      origin: { x: originX, y: 0.7 },
      colors: magenta,
      scalar: 0.9,
      disableForReducedMotion: true,
    });
  shoot(0.2);
  setTimeout(() => shoot(0.5), 120);
  setTimeout(() => shoot(0.8), 240);
}