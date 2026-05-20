import { Howl, Howler } from 'howler';
import {
  pickFirstExisting,
  resolveBGM,
  resolveFrameBGM,
  resolveS11BlueDotSpecialAudio,
  resolveSFX,
  resolveVoice,
} from '@/engine/assetResolver';

const BGM_TARGET_VOLUME = 0.02;
const VOICE_TARGET_VOLUME = 1;
const VOICE_GAIN_MULTIPLIER = 2;

class AudioManager {
  private bgm: Howl | null = null;
  private bgmKey: string | null = null;
  private bgmRequestToken = 0;
  private currentVoice: Howl | null = null;
  private specialVoice: Howl | null = null;
  private specialVoiceKey: string | null = null;
  private unlocked = false;
  private voiceRequestToken = 0;
  private specialVoiceRequestToken = 0;

  unlock() {
    this.unlocked = true;
    // 明确恢复 Howler 自己的 Web Audio context；比手动 new AudioContext 更稳定。
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

  async syncBGM(params: {
    sceneId: string;
    frameId: string;
    sceneHint?: string;
    frameHint?: string;
    sceneChanged: boolean;
  }): Promise<boolean> {
    const { sceneId, frameId, sceneHint, frameHint, sceneChanged } = params;
    const requestToken = ++this.bgmRequestToken;
    let switched = false;

    if (sceneChanged) {
      const sceneKey = sceneHint || sceneId;
      if (!(this.bgmKey === sceneKey && this.bgm)) {
        const sceneUrl = await pickFirstExisting(resolveBGM(sceneId, sceneHint));
        if (requestToken !== this.bgmRequestToken) return false;
        if (sceneUrl) {
          this.startBGM(sceneUrl, sceneKey);
          switched = true;
        }
      } else {
        switched = true;
      }
    }

    const frameKey = frameHint || `${sceneId}-${frameId}`;
    if (!(this.bgmKey === frameKey && this.bgm)) {
      const frameUrl = await pickFirstExisting(resolveFrameBGM(sceneId, frameId, frameHint));
      if (requestToken !== this.bgmRequestToken) return switched;
      if (frameUrl) {
        this.startBGM(frameUrl, frameKey);
        return true;
      }
    } else {
      return true;
    }

    return switched;
  }

  stopBGM() {
    this.bgmRequestToken += 1;
    if (this.bgm) {
      this.bgm.fade(this.bgm.volume(), 0, 600);
      const old = this.bgm;
      setTimeout(() => old.unload(), 650);
      this.bgm = null;
      this.bgmKey = null;
    }
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
    const howl = new Howl({ src: [src], volume: VOICE_TARGET_VOLUME, html5: false });
    this.currentVoice = howl;
    const soundId = howl.play();
    this.applyVoiceGain(howl, soundId);
  }

  stopVoice(invalidatePending = true) {
    if (invalidatePending) {
      this.voiceRequestToken += 1;
    }
    if (this.currentVoice) {
      this.currentVoice.stop();
      this.currentVoice.unload();
      this.currentVoice = null;
    }
  }

  async playS11BlueDotSpecialVoice(cacheBust?: number) {
    const key = 'S11-11.4-blue-dot';
    if (this.specialVoice && this.specialVoiceKey === key) return;
    this.stopSpecialVoice(false);
    const requestToken = ++this.specialVoiceRequestToken;
    const url = await pickFirstExisting(resolveS11BlueDotSpecialAudio());
    if (!url || requestToken !== this.specialVoiceRequestToken) return;
    const src = cacheBust ? `${url}?v=${cacheBust}` : url;
    const howl = new Howl({ src: [src], volume: VOICE_TARGET_VOLUME, html5: false });
    this.specialVoice = howl;
    this.specialVoiceKey = key;
    const soundId = howl.play();
    this.applyVoiceGain(howl, soundId);
    howl.once('end', () => {
      if (this.specialVoice === howl) {
        this.specialVoice = null;
        this.specialVoiceKey = null;
      }
      howl.unload();
    });
  }

  stopSpecialVoice(invalidatePending = true) {
    if (invalidatePending) {
      this.specialVoiceRequestToken += 1;
    }
    if (this.specialVoice) {
      this.specialVoice.stop();
      this.specialVoice.unload();
      this.specialVoice = null;
      this.specialVoiceKey = null;
    }
  }

  isUnlocked() {
    return this.unlocked;
  }

  private applyVoiceGain(howl: Howl, soundId: number) {
    const tune = () => {
      const sound = (howl as Howl & {
        _soundById?: (id: number) => {
          _node?: { gain?: { gain?: { value: number; setValueAtTime?: (value: number, time: number) => void } } };
        } | null;
      })._soundById?.(soundId);
      const gainNode = sound?._node?.gain?.gain;
      if (!gainNode) return;
      if (typeof gainNode.setValueAtTime === 'function') {
        gainNode.setValueAtTime(VOICE_GAIN_MULTIPLIER, Howler.ctx.currentTime);
      } else {
        gainNode.value = VOICE_GAIN_MULTIPLIER;
      }
    };

    if (howl.state() === 'loaded') {
      tune();
    } else {
      howl.once('load', tune);
    }
    howl.once('play', tune);
  }

  private startBGM(url: string, key: string) {
    if (this.bgm) {
      const old = this.bgm;
      old.fade(old.volume(), 0, 800);
      setTimeout(() => old.unload(), 850);
    }
    const howl = new Howl({
      src: [url],
      loop: true,
      volume: 0,
      html5: false,
      onplayerror: () => {
        howl.once('unlock', () => {
          const retryId = howl.play();
          if (typeof retryId === 'number') {
            howl.fade(0, BGM_TARGET_VOLUME, 1200, retryId);
          } else {
            howl.fade(0, BGM_TARGET_VOLUME, 1200);
          }
        });
      },
    });
    this.bgm = howl;
    this.bgmKey = key;

    const start = () => {
      const soundId = howl.play();
      if (typeof soundId === 'number') {
        howl.fade(0, BGM_TARGET_VOLUME, 1200, soundId);
      } else {
        howl.fade(0, BGM_TARGET_VOLUME, 1200);
      }
    };

    if (howl.state() === 'loaded') {
      start();
    } else {
      howl.once('load', start);
    }
  }
}

export const audio = new AudioManager();
