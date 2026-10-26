// The transport is injected so lifecycle and call-control races can be tested
// without loading native WebRTC or contacting a telephony provider.
const TERMINAL = new Set(['ENDED', 'FAILED', 'DROPPED']);
const initialState = () => ({ status: 'DISCONNECTED', error: '', call: null, state: '', muted: false, held: false, duration: 0 });

class VoiceController {
  constructor({ client, getToken, register, permission, tokenConfig, launchedFromPush, clearStoredConfig }) {
    Object.assign(this, { client, getToken, register, permission, tokenConfig, launchedFromPush, clearStoredConfig });
    this.snapshot = initialState();
    this.listeners = new Set();
    this.subscriptions = [];
    this.callSubscriptions = [];
    this.generation = 0;
    this.identity = '';
    this.expiresAt = 0;
    this.pending = null;
    this.timer = null;
  }
  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  publish(change) { this.snapshot = { ...this.snapshot, ...change }; this.listeners.forEach((fn) => fn()); }
  async start() {
    if (this.pending) return this.pending;
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.pending = (async () => {
      this.publish({ status: 'CONNECTING', error: '' });
      try {
        const credentials = await this.getToken();
        if (!current()) return;
        if (!credentials?.token || !credentials?.identity) throw new Error('Voice credentials are unavailable. Check account calling settings.');
        this.identity = credentials.identity;
        this.callerNumber = credentials.phone_number || '';
        this.expiresAt = Date.now() + Math.max(60, Number(credentials.refresh_after_seconds) || 3600) * 1000;
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions = [
          this.client.connectionState$.subscribe((status) => {
            if (!current()) return;
            this.publish({ status, error: status === 'ERROR' ? 'Calling connection failed. Tap reconnect to try again.' : '' });
            this.updateRegistration(status === 'CONNECTED', generation);
          }),
          this.client.activeCall$.subscribe((call) => { if (current()) this.observeCall(call); }),
        ];
        // A native push may already be restoring a call. A second login would
        // replace that SIP session and drop the incoming call.
        if (!(await this.launchedFromPush())) {
          if (!current()) return;
          await this.client.loginWithToken(this.tokenConfig(credentials.token));
        }
        if (!current()) { await this.client.logout(); return; }
        this.observeCall(this.client.currentActiveCall);
        clearInterval(this.timer);
        this.timer = setInterval(() => {
          if (!current()) return;
          this.updateRegistration(this.client.currentConnectionState === 'CONNECTED', generation);
          if (Date.now() >= this.expiresAt && !this.snapshot.call) this.reconnect().catch(() => {});
        }, 45000);
      } catch (error) {
        if (current()) this.publish({ status: 'ERROR', error: error?.data?.message || error?.message || 'Calling could not connect.' });
      }
    })().finally(() => { if (current()) this.pending = null; });
    return this.pending;
  }
  async updateRegistration(active, generation = this.generation) {
    if (!this.identity || generation !== this.generation) return;
    try { await this.register({ identity: this.identity, active }); }
    catch (error) {
      if (active && generation === this.generation) this.publish({ error: 'Connected, but incoming call routing could not be registered. Tap reconnect.' });
    }
  }
  observeCall(call) {
    if (call === this.call) return;
    this.callSubscriptions.forEach((sub) => sub.unsubscribe()); this.callSubscriptions = [];
    this.call = call;
    if (!call || TERMINAL.has(call.currentState)) {
      this.publish({ call: null, state: '', muted: false, held: false, duration: 0 });
      return;
    }
    this.publish({ call: { id: call.callId, incoming: call.isIncoming, name: call.callerName, number: call.callerNumber || call.destination }, state: call.currentState, muted: call.currentIsMuted, held: call.currentIsHeld, duration: call.currentDuration });
    this.callSubscriptions = [
      call.callState$.subscribe((state) => {
        if (this.call !== call) return;
        if (TERMINAL.has(state)) {
          this.publish({ call: null, state, duration: 0, error: state === 'ENDED' ? '' : 'The call ended because the connection failed.' });
        } else this.publish({ state });
      }),
      call.isMuted$.subscribe((muted) => { if (this.call === call) this.publish({ muted }); }),
      call.isHeld$.subscribe((held) => { if (this.call === call) this.publish({ held }); }),
      call.duration$.subscribe((duration) => { if (this.call === call) this.publish({ duration }); }),
    ];
  }
  async dial(number, name) {
    if (!/^\+[1-9]\d{6,14}$/.test(String(number).replace(/[\s()-]/g, ''))) throw new Error('Use a phone number with its country code, for example +12025550123.');
    if (this.snapshot.status !== 'CONNECTED') throw new Error('Calling is not connected yet. Reconnect and try again.');
    if (this.snapshot.call) throw new Error('Finish the current call before starting another.');
    if (!(await this.permission())) throw new Error('Microphone permission is required to make calls.');
    // Reserve locally before awaiting signaling to prevent two rapid taps.
    if (this.dialing) throw new Error('A call is already starting.');
    this.dialing = true;
    try {
      const call = await this.client.newCall(String(number).replace(/[\s()-]/g, ''), name || '', this.callerNumber);
      this.observeCall(call); return call.callId;
    } finally { this.dialing = false; }
  }
  async control(action, id) {
    const call = this.call;
    if (!call || TERMINAL.has(call.currentState) || (id && call.callId !== id)) throw new Error('This call is no longer available on this device.');
    if (action === 'answer') {
      if (!call.isIncoming || call.currentState !== 'RINGING') throw new Error('This call cannot be answered now.');
      if (!(await this.permission())) throw new Error('Microphone permission is required to answer.');
      return call.answer();
    }
    if (action === 'hangup') return call.hangup();
    if (action === 'mute') return call.toggleMute();
    if (action === 'hold') return call.currentIsHeld ? call.resume() : call.hold();
    throw new Error('Unsupported call action.');
  }
  async stop({ clear = false } = {}) {
    const pending = this.pending;
    ++this.generation; this.pending = null;
    clearInterval(this.timer); this.timer = null;
    this.subscriptions.forEach((sub) => sub.unsubscribe()); this.subscriptions = [];
    this.callSubscriptions.forEach((sub) => sub.unsubscribe()); this.callSubscriptions = [];
    const identity = this.identity; this.identity = ''; this.call = null;
    this.publish(initialState());
    if (pending) await pending.catch(() => {});
    if (identity) await this.register({ identity, active: false }).catch(() => {});
    this.client.disablePushNotifications();
    await this.client.logout().catch(() => {});
    if (clear) await this.clearStoredConfig();
  }
  async reconnect() {
    if (this.snapshot.call) throw new Error('Finish your call before reconnecting.');
    await this.stop(); await this.start();
  }
}
module.exports = { VoiceController, TERMINAL };
