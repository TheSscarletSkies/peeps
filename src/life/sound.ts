const KEY = "peeps.sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Without storage the setting simply does not stick.
  }
}

/** A soft two-note boop, made on the fly so no sound files ship with the app. */
export function boop(): void {
  const audio = new AudioContext();
  const now = audio.currentTime;
  [660, 880].forEach((frequency, index) => {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency;
    const start = now + index * 0.12;
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    tone.connect(volume).connect(audio.destination);
    tone.start(start);
    tone.stop(start + 0.2);
  });
  window.setTimeout(() => void audio.close(), 600);
}
