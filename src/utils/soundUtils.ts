/**
 * Plays a crisp, modern success chime using the browser's native Web Audio API.
 * 100% offline, zero external dependencies or media file loading.
 * Ascending harmonic triad chime (D5 -> A5 -> D6) for clear auditory feedback.
 */
export function playSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Helper to schedule a smooth sine tone note
    const playNote = (frequency: number, startTime: number, duration: number, volume = 0.15) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);

      // Smooth envelope attack and exponential decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Crisp 3-note ascending success chord: D5 (587.33Hz) -> A5 (880Hz) -> D6 (1174.66Hz)
    playNote(587.33, now, 0.18, 0.12);
    playNote(880.00, now + 0.08, 0.22, 0.15);
    playNote(1174.66, now + 0.18, 0.45, 0.18);
  } catch (e) {
    // Fail silently if browser audio policy blocks un-triggered audio
  }
}

/**
 * Plays a subtle, gentle feedback click sound for button interactions.
 */
export function playClickSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    // Fail silently
  }
}
