import { Howl, Howler } from 'howler';
import {
  pickFirstExisting,
  resolveBGM,
  resolveFrameBGM,
  resolveS11BlueDotSpecialAudio,
  resolveSFX,
  resolveVoice,
} from '@/engine/assetResolver';

const BGM_TARGET_VOLUME = 0.12;
const VOICE_TARGET_VOLUME = 1;
const VOICE_GAIN_MULTIPLIER = 5;
const BGM_FADE_IN_MS = 1800;
const BGM_FADE_OUT_MS = 1400;
const VOICE_FADE_OUT_MS = 180;
const SPECIAL_VOICE_FADE_IN_MS = 500;
const SPECIAL_VOICE_FADE_OUT_MS = 700;

class AudioManager {
  private bgm: Howl | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmSource: MediaElementAudioSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmKey: string | null = null;
  private bgmRequestToken = 0;
  private currentVoice: Howl | null = null;
  private currentVoiceSource: AudioBufferSourceNode | null = null;
  private currentVoiceGain: GainNode | null = null;
  private specialVoice: Howl | null = null;
  private specialVoiceSource: AudioBufferSourceNode | null = null;
  private specialVoiceGain: GainNode | null = null;
  private specialVoiceKey: string | null = null;
  private unlocked = false;
  private voiceRequestToken = 0;
  private specialVoiceRequestToken = 0;

  unlock() {
    this.unlocked = true;
    try {
      if (Howler.ctx?.state === 'suspended') {
        void Howler.ctx.resume();
      }
    } catch {
      // ignore
    }
  }

  async playBGM(sceneId: string, hint?: string): Promise<boolean> {
    return this.syncBGM({
      sceneId,
      frameId: '__scene__',
      sceneHint: hint,
      frameHint: undefined,
      sceneChanged: true,
    });
  }

  playKnownBGM(url: string, key: string, cacheBust?: number) {
    void this.startBGM(withCacheBust(url, cacheBust), cacheKey(key, cacheBust));
  }

  async syncBGM(params: {
    sceneId: string;
    frameId: string;
    sceneHint?: string;
    frameHint?: string;
    sceneChanged: boolean;
    cacheBust?: number;
  }): Promise<boolean> {
    const { sceneId, frameId, sceneHint, frameHint, sceneChanged, cacheBust } = params;
    const requestToken = ++this.bgmRequestToken;
    let switched = false;

    if (sceneChanged) {
      const sceneKey = cacheKey(sceneHint || sceneId, cacheBust);
      if (!(this.bgmKey === sceneKey && this.hasActiveBGM())) {
        const sceneUrl = await pickFirstExisting(resolveBGM(sceneId, sceneHint));
        if (requestToken !== this.bgmRequestToken) return false;
        if (sceneUrl) {
          void this.startBGM(withCacheBust(sceneUrl, cacheBust), sceneKey);
          switched = true;
        }
      } else {
        this.setBGMVolume(BGM_TARGET_VOLUME);
        switched = true;
      }
    }

    const frameKey = cacheKey(frameHint || `${sceneId}-${frameId}`, cacheBust);
    if (!(this.bgmKey === frameKey && this.hasActiveBGM())) {
      const frameUrl = await pickFirstExisting(resolveFrameBGM(sceneId, frameId, frameHint));
      if (requestToken !== this.bgmRequestToken) return switched;
      if (frameUrl) {
        void this.startBGM(withCacheBust(frameUrl, cacheBust), frameKey);
        return true;
      }
    } else {
      this.setBGMVolume(BGM_TARGET_VOLUME);
      return true;
    }

    return switched;
  }

  stopBGM() {
    this.bgmRequestToken += 1;
    if (this.bgm) {
      this.bgm.fade(this.bgm.volume(), 0, BGM_FADE_OUT_MS);
      const old = this.bgm;
      setTimeout(() => old.unload(), BGM_FADE_OUT_MS + 80);
      this.bgm = null;
    }
    if (this.bgmGain) {
      const gain = this.bgmGain.gain;
      const now = Howler.ctx.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + BGM_FADE_OUT_MS / 1000);
    }
    if (this.bgmAudio) {
      const oldAudio = this.bgmAudio;
      setTimeout(() => {
        oldAudio.pause();
        oldAudio.src = '';
        oldAudio.load();
      }, BGM_FADE_OUT_MS + 80);
      this.bgmAudio = null;
      this.bgmSource = null;
      this.bgmGain = null;
    }
    this.bgmKey = null;
  }

  playSFX(hint: string, volume = 1) {
    if (!hint) return;
    const url = resolveSFX(hint);
    const h = new Howl({ src: [url], volume, html5: true });
    h.play();
    h.once('end', () => h.unload());
  }

  async playVoice(
    sceneId: string,
    frameId: string,
    maleLineIdx: number,
    hint?: string,
    cacheBust?: number,
    voiceKey?: string,
  ) {
    this.stopVoice(false);
    const requestToken = ++this.voiceRequestToken;
    const candidates = resolveVoice(sceneId, frameId, maleLineIdx, hint, voiceKey);
    const url = await pickFirstExisting(candidates);
    if (!url || requestToken !== this.voiceRequestToken) return;
    const src = cacheBust ? `${url}?v=${cacheBust}` : url;
    void this.playBoostedVoice(src, requestToken);
  }

  stopVoice(invalidatePending = true) {
    if (invalidatePending) {
      this.voiceRequestToken += 1;
    }
    if (this.currentVoice) {
      this.fadeOutAndUnload(this.currentVoice, VOICE_FADE_OUT_MS);
      this.currentVoice = null;
    }
    this.stopVoiceBuffer();
  }

  async playS11BlueDotSpecialVoice(cacheBust?: number) {
    const key = 'S11-11.4-blue-dot';
    if (this.specialVoice && this.specialVoiceKey === key) return;
    this.stopSpecialVoice(false);
    const requestToken = ++this.specialVoiceRequestToken;
    const url = await pickFirstExisting(resolveS11BlueDotSpecialAudio());
    if (!url || requestToken !== this.specialVoiceRequestToken) return;
    const src = cacheBust ? `${url}?v=${cacheBust}` : url;
    this.specialVoiceKey = key;
    void this.playBoostedSpecialVoice(src, requestToken, key);
  }

  stopSpecialVoice(invalidatePending = true) {
    if (invalidatePending) {
      this.specialVoiceRequestToken += 1;
    }
    if (this.specialVoice) {
      this.fadeOutAndUnload(this.specialVoice, SPECIAL_VOICE_FADE_OUT_MS);
      this.specialVoice = null;
      this.specialVoiceKey = null;
    }
    this.stopSpecialVoiceBuffer();
  }

  isUnlocked() {
    return this.unlocked;
  }

  private async playBoostedVoice(src: string, requestToken: number) {
    try {
      const { source, gain } = await this.startBufferAudio(src, VOICE_GAIN_MULTIPLIER);
      if (requestToken !== this.voiceRequestToken) {
        source.stop();
        return;
      }
      this.currentVoiceSource = source;
      this.currentVoiceGain = gain;
      source.onended = () => {
        if (this.currentVoiceSource === source) {
          this.currentVoiceSource = null;
          this.currentVoiceGain = null;
        }
      };
    } catch {
      if (requestToken !== this.voiceRequestToken) return;
      const howl = new Howl({ src: [src], volume: VOICE_TARGET_VOLUME, html5: true });
      this.currentVoice = howl;
      howl.play();
    }
  }

  private async playBoostedSpecialVoice(src: string, requestToken: number, key: string) {
    try {
      const { source, gain } = await this.startBufferAudio(src, VOICE_GAIN_MULTIPLIER, SPECIAL_VOICE_FADE_IN_MS);
      if (requestToken !== this.specialVoiceRequestToken || this.specialVoiceKey !== key) {
        source.stop();
        return;
      }
      this.specialVoiceSource = source;
      this.specialVoiceGain = gain;
      source.onended = () => {
        if (this.specialVoiceSource === source) {
          this.specialVoiceSource = null;
          this.specialVoiceGain = null;
          this.specialVoiceKey = null;
        }
      };
    } catch {
      if (requestToken !== this.specialVoiceRequestToken || this.specialVoiceKey !== key) return;
      const howl = new Howl({ src: [src], volume: 0, html5: true });
      this.specialVoice = howl;
      const soundId = howl.play();
      this.fadeIn(howl, VOICE_TARGET_VOLUME, SPECIAL_VOICE_FADE_IN_MS, soundId);
      howl.once('end', () => {
        if (this.specialVoice === howl) {
          this.specialVoice = null;
          this.specialVoiceKey = null;
        }
        howl.unload();
      });
    }
  }

  private async startBufferAudio(src: string, targetGain: number, fadeInMs = 0) {
    if (Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume();
    }
    const buffer = await fetch(src).then((r) => r.arrayBuffer()).then((data) => Howler.ctx.decodeAudioData(data));
    const source = Howler.ctx.createBufferSource();
    const gain = Howler.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(fadeInMs > 0 ? 0 : targetGain, Howler.ctx.currentTime);
    if (fadeInMs > 0) {
      gain.gain.linearRampToValueAtTime(targetGain, Howler.ctx.currentTime + fadeInMs / 1000);
    }
    source.connect(gain);
    gain.connect(Howler.ctx.destination);
    source.start();
    return { source, gain };
  }

  private stopVoiceBuffer() {
    if (this.currentVoiceGain) {
      this.currentVoiceGain.gain.setValueAtTime(0, Howler.ctx.currentTime);
    }
    if (this.currentVoiceSource) {
      try {
        this.currentVoiceSource.stop();
      } catch {
        // ignore already-stopped source
      }
      this.currentVoiceSource = null;
      this.currentVoiceGain = null;
    }
  }

  private stopSpecialVoiceBuffer() {
    if (this.specialVoiceGain) {
      this.specialVoiceGain.gain.setValueAtTime(0, Howler.ctx.currentTime);
    }
    if (this.specialVoiceSource) {
      try {
        this.specialVoiceSource.stop();
      } catch {
        // ignore already-stopped source
      }
      this.specialVoiceSource = null;
      this.specialVoiceGain = null;
    }
  }

  private async startBGM(url: string, key: string) {
    this.stopBGM();
    this.bgmKey = key;
    try {
      if (Howler.ctx.state === 'suspended') {
        await Howler.ctx.resume();
      }
      if (this.bgmKey !== key) return;
      const audio = new Audio(url);
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.muted = false;
      audio.volume = 1;
      const source = Howler.ctx.createMediaElementSource(audio);
      const gain = Howler.ctx.createGain();
      gain.gain.setValueAtTime(0, Howler.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(BGM_TARGET_VOLUME, Howler.ctx.currentTime + BGM_FADE_IN_MS / 1000);
      source.connect(gain);
      gain.connect(Howler.ctx.destination);
      this.bgmAudio = audio;
      this.bgmSource = source;
      this.bgmGain = gain;
      await audio.play();
    } catch {
      this.bgmAudio = null;
      this.bgmSource = null;
      this.bgmGain = null;
      this.startBGMFallback(url, key);
    }
  }

  private startBGMFallback(url: string, key: string) {
    const howl = new Howl({
      src: [url],
      loop: true,
      volume: 0,
      html5: true,
    });
    this.bgm = howl;
    this.bgmKey = key;
    const soundId = howl.play();
    if (typeof soundId === 'number') {
      howl.fade(0, BGM_TARGET_VOLUME, BGM_FADE_IN_MS, soundId);
    } else {
      howl.fade(0, BGM_TARGET_VOLUME, BGM_FADE_IN_MS);
    }
  }

  private hasActiveBGM() {
    return Boolean(this.bgm || this.bgmAudio);
  }

  private setBGMVolume(volume: number) {
    this.bgm?.volume(volume);
    if (this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(volume, Howler.ctx.currentTime);
    }
  }

  private fadeIn(howl: Howl, targetVolume: number, duration: number, soundId?: number) {
    const start = () => {
      if (typeof soundId === 'number') {
        howl.fade(0, targetVolume, duration, soundId);
      } else {
        howl.fade(0, targetVolume, duration);
      }
    };
    if (howl.state() === 'loaded') {
      start();
    } else {
      howl.once('load', start);
    }
    howl.once('play', start);
  }

  private fadeOutAndUnload(howl: Howl, duration: number) {
    howl.fade(howl.volume(), 0, duration);
    setTimeout(() => {
      howl.stop();
      howl.unload();
    }, duration + 60);
  }
}

function withCacheBust(url: string, cacheBust?: number) {
  return cacheBust ? `${url}?v=${cacheBust}` : url;
}

function cacheKey(key: string, cacheBust?: number) {
  return cacheBust ? `${key}?v=${cacheBust}` : key;
}

export const audio = new AudioManager();
