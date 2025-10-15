const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SpeedController {
  constructor({
    baseDuration = 550,
    minMultiplier = 0.25,
    maxMultiplier = 2,
    defaultMultiplier = 1,
    interactionWindowMs = 750
  } = {}) {
    this.baseDuration = Math.max(100, Math.round(baseDuration));
    this.minMultiplier = minMultiplier;
    this.maxMultiplier = maxMultiplier;
    this.multiplier = clamp(defaultMultiplier, this.minMultiplier, this.maxMultiplier);
    this.baseInteractionWindowMs = Math.max(200, Math.round(interactionWindowMs));
  }

  setMultiplier(multiplier) {
    const numeric = Number(multiplier);
    const safe = Number.isFinite(numeric) && numeric > 0 ? numeric : this.minMultiplier;
    const clamped = clamp(safe, this.minMultiplier, this.maxMultiplier);
    this.multiplier = clamped;
    return this.multiplier;
  }

  getMultiplier() {
    return this.multiplier;
  }

  updateBaseDuration(durationMs) {
    if (!Number.isFinite(durationMs)) {
      return;
    }
    this.baseDuration = Math.max(100, Math.round(durationMs));
  }

  getStepDuration() {
    return Math.max(100, Math.round(this.baseDuration / this.multiplier));
  }

  getInteractionWindow() {
    const scaled = this.baseInteractionWindowMs / Math.max(this.multiplier, 0.01);
    const clamped = Math.min(1200, scaled);
    return Math.max(150, Math.round(clamped));
  }

  async waitForWindow() {
    const windowDelay = this.getInteractionWindow();
    if (windowDelay <= 0) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, windowDelay));
  }
}
