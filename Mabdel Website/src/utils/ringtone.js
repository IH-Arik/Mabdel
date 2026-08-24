// A ringtone synthesised with the Web Audio API rather than shipped as an audio
// file: nothing extra to download, nothing to 404, and it still rings on a slow
// connection. The incoming-call overlay was silent before this, so a call landing
// while the user was reading another part of the page went unnoticed.

const RING_TONE_HZ = [440, 480]; // the two tones of a standard telephone ring
const PULSE_SECONDS = 0.4;
const GAP_SECONDS = 0.2;
const CYCLE_MS = 3000; // ring, ring ... pause, the way a phone does

export function createRingtone() {
  let context = null;
  let cycleTimer = null;
  let running = false;

  const pulse = (startAt) => {
    if (!context) return;
    const gain = context.createGain();
    gain.connect(context.destination);
    // Ramp instead of switching abruptly — a hard start/stop on a sine wave
    // produces an audible click.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.18, startAt + 0.02);
    gain.gain.setValueAtTime(0.18, startAt + PULSE_SECONDS - 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + PULSE_SECONDS);

    RING_TONE_HZ.forEach((frequency) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.connect(gain);
      oscillator.start(startAt);
      oscillator.stop(startAt + PULSE_SECONDS);
    });
  };

  const ringOnce = () => {
    if (!context || !running) return;
    const now = context.currentTime;
    pulse(now);
    pulse(now + PULSE_SECONDS + GAP_SECONDS);
  };

  return {
    start() {
      if (running) return;
      running = true;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        context = context || new AudioCtx();
        // Browsers suspend audio until the page has had a user gesture. The user
        // has normally clicked something by the time a call arrives, but if not
        // this resolves to a rejected promise and we simply stay silent — the
        // overlay and the tab title still announce the call.
        if (context.state === 'suspended') context.resume().catch(() => {});
        ringOnce();
        cycleTimer = window.setInterval(ringOnce, CYCLE_MS);
      } catch {
        // Audio is a nicety here, never a requirement — never break the call UI.
      }
    },
    stop() {
      running = false;
      if (cycleTimer) {
        window.clearInterval(cycleTimer);
        cycleTimer = null;
      }
      if (context) {
        try {
          context.close();
        } catch {
          // already closed
        }
        context = null;
      }
    },
  };
}

// Flashes the browser tab so a call is noticeable even from another tab, where
// neither the overlay nor (on a muted tab) the ringtone can be perceived.
export function createTitleAlert() {
  let timer = null;
  let originalTitle = '';

  return {
    start(message) {
      if (timer) return;
      originalTitle = document.title;
      let showingMessage = false;
      timer = window.setInterval(() => {
        document.title = showingMessage ? originalTitle : message;
        showingMessage = !showingMessage;
      }, 1000);
    },
    stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
      if (originalTitle) document.title = originalTitle;
    },
  };
}
