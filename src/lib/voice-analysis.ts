/**
 * 声学分析模块 — 前端 Web Audio API 实现
 * 替代 Python Parselmouth/Praat 的功能：
 *  - RMS 音量 (dB)
 *  - 基频 F0 (Hz) via autocorrelation
 *  - F0 标准差 (Hz) — 用于声颤判定
 *  - 有声帧比率 — 用于语速判定
 *  - 停顿次数 — 用于流畅度/换气频率判定
 *  - 频谱倾斜度 — 用于嘶哑判定 (类似 HNR 替代)
 */

export interface VoiceMetrics {
  /** 录音总时长 (秒) */
  duration_sec: number;
  /** 平均音量 (dB SPL 相对满幅) */
  intensity_db: number;
  /** 基频均值 (Hz)，0 = 未检出 */
  f0_mean_hz: number;
  /** 基频标准差 (Hz) */
  f0_sd_hz: number;
  /** 有声时长占比 (0-1) */
  voiced_ratio: number;
  /** 停顿次数 (静音段 >= 200ms) */
  pause_count: number;
  /** 频谱倾斜度 (-1 ~ +1)，越负表示越沙哑 */
  spectral_tilt: number;
  /** Jitter 近似值 (%)  — F0 帧间变异系数 */
  jitter_approx: number;
}

const FRAME_SIZE = 2048;
const HOP_SIZE = 512;  // ~32ms at 16kHz
const SAMPLE_RATE = 16000;
const MIN_F0 = 75;
const MAX_F0 = 500;

/**
 * 从 AudioBuffer（单声道 16kHz）中提取所有声学指标
 */
export function analyzeAudioBuffer(buffer: AudioBuffer): VoiceMetrics {
  // Ensure mono 16kHz
  const raw = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const samples = sr === SAMPLE_RATE ? raw : resample(raw, sr, SAMPLE_RATE);
  const totalFrames = Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE);
  if (totalFrames < 5) {
    return emptyMetrics(samples.length / SAMPLE_RATE);
  }

  const rmsValues: number[] = [];
  const f0Values: number[] = []; // only voiced frames
  const voicedMask: boolean[] = [];
  const spectralTilts: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const start = i * HOP_SIZE;
    const frame = samples.slice(start, start + FRAME_SIZE);

    // RMS
    const rms = computeRms(frame);
    rmsValues.push(rms);

    // F0 via autocorrelation
    const f0 = estimateF0(frame, SAMPLE_RATE, MIN_F0, MAX_F0);
    const isVoiced = rms > 0.01 && f0 > 0;
    voicedMask.push(isVoiced);
    if (isVoiced) f0Values.push(f0);

    // Spectral tilt (every 4th frame to save compute)
    if (i % 4 === 0 && isVoiced) {
      spectralTilts.push(computeSpectralTilt(frame, SAMPLE_RATE));
    }
  }

  const duration = samples.length / SAMPLE_RATE;
  const voicedCount = voicedMask.filter(Boolean).length;
  const voicedRatio = voicedCount / totalFrames;

  // Mean intensity (dB relative to full scale)
  const validRms = rmsValues.filter((r) => r > 0.001);
  const meanRms = validRms.length ? validRms.reduce((a, b) => a + b, 0) / validRms.length : 0;
  const intensityDb = meanRms > 0 ? 20 * Math.log10(meanRms) + 90 : 0; // offset to ~dB SPL range

  // F0 stats
  const f0Mean = f0Values.length ? f0Values.reduce((a, b) => a + b, 0) / f0Values.length : 0;
  const f0Sd =
    f0Values.length > 2
      ? Math.sqrt(f0Values.reduce((s, v) => s + (v - f0Mean) ** 2, 0) / (f0Values.length - 1))
      : 0;

  // Jitter approximation: mean absolute difference between consecutive F0 / mean F0
  let jitterApprox = 0;
  if (f0Values.length > 2 && f0Mean > 0) {
    let sumDiff = 0;
    for (let i = 1; i < f0Values.length; i++) {
      sumDiff += Math.abs(f0Values[i] - f0Values[i - 1]);
    }
    jitterApprox = (sumDiff / (f0Values.length - 1) / f0Mean) * 100;
  }

  // Pause count: runs of unvoiced frames >= 200ms
  const minPauseFrames = Math.ceil(0.2 / (HOP_SIZE / SAMPLE_RATE));
  let pauseCount = 0;
  let silRun = 0;
  for (const v of voicedMask) {
    if (!v) {
      silRun++;
    } else {
      if (silRun >= minPauseFrames) pauseCount++;
      silRun = 0;
    }
  }

  // Spectral tilt mean
  const spectralTilt = spectralTilts.length
    ? spectralTilts.reduce((a, b) => a + b, 0) / spectralTilts.length
    : 0;

  return {
    duration_sec: Math.round(duration * 100) / 100,
    intensity_db: Math.round(intensityDb * 10) / 10,
    f0_mean_hz: Math.round(f0Mean * 10) / 10,
    f0_sd_hz: Math.round(f0Sd * 10) / 10,
    voiced_ratio: Math.round(voicedRatio * 1000) / 1000,
    pause_count: pauseCount,
    spectral_tilt: Math.round(spectralTilt * 1000) / 1000,
    jitter_approx: Math.round(jitterApprox * 100) / 100,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function computeRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Autocorrelation-based F0 estimation.
 * Returns 0 if no clear pitch detected.
 */
function estimateF0(frame: Float32Array, sr: number, minF0: number, maxF0: number): number {
  const minLag = Math.floor(sr / maxF0);
  const maxLag = Math.floor(sr / minF0);
  const n = frame.length;

  // Apply Hanning window
  const windowed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    windowed[i] = frame[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  // Normalized autocorrelation
  let r0 = 0;
  for (let i = 0; i < n; i++) r0 += windowed[i] * windowed[i];
  if (r0 < 1e-10) return 0;

  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let corr = 0;
    let denom = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += windowed[i] * windowed[i + lag];
      denom += windowed[i + lag] * windowed[i + lag];
    }
    if (denom < 1e-10) continue;
    const norm = corr / Math.sqrt(r0 * denom);
    if (norm > bestCorr) {
      bestCorr = norm;
      bestLag = lag;
    }
  }

  // Threshold: correlation must be > 0.3 to be considered periodic
  if (bestCorr < 0.3 || bestLag === 0) return 0;

  // Parabolic interpolation for sub-sample accuracy
  return sr / bestLag;
}

/**
 * Spectral tilt: ratio of low-freq energy to high-freq energy.
 * Negative tilt → breathy/hoarse, Positive → clear/nasal.
 * Returns value in range roughly -1 to +1.
 */
function computeSpectralTilt(frame: Float32Array, sr: number): number {
  const n = frame.length;
  // Simple DFT magnitude (first half)
  const halfN = Math.floor(n / 2);
  const mags = new Float32Array(halfN);
  for (let k = 0; k < halfN; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += frame[t] * Math.cos(angle);
      im -= frame[t] * Math.sin(angle);
    }
    mags[k] = Math.sqrt(re * re + im * im);
  }

  // Split at 2kHz
  const splitBin = Math.floor((2000 / sr) * n);
  let lowEnergy = 0, highEnergy = 0;
  for (let k = 1; k < splitBin && k < halfN; k++) lowEnergy += mags[k] * mags[k];
  for (let k = splitBin; k < halfN; k++) highEnergy += mags[k] * mags[k];

  if (lowEnergy + highEnergy < 1e-10) return 0;
  // Normalize to [-1, 1]: positive = more low freq, negative = more high freq
  return (lowEnergy - highEnergy) / (lowEnergy + highEnergy);
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const newLen = Math.floor(input.length / ratio);
  const output = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = srcIdx - lo;
    output[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return output;
}

function emptyMetrics(duration: number): VoiceMetrics {
  return {
    duration_sec: Math.round(duration * 100) / 100,
    intensity_db: 0,
    f0_mean_hz: 0,
    f0_sd_hz: 0,
    voiced_ratio: 0,
    pause_count: 0,
    spectral_tilt: 0,
    jitter_approx: 0,
  };
}

/**
 * Record audio using MediaRecorder, then analyze.
 * Returns both the transcript (from callback) and voice metrics.
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: false, noiseSuppression: false },
    });
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start(250); // chunk every 250ms
  }

  stop(): Promise<VoiceMetrics> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('Not recording'));
        return;
      }
      this.mediaRecorder.onstop = async () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const metrics = await this.analyzeBlob(blob);
          resolve(metrics);
        } catch (e) {
          reject(e);
        }
      };
      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    try {
      this.mediaRecorder?.stop();
    } catch { /* already stopped */ }
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  private async analyzeBlob(blob: Blob): Promise<VoiceMetrics> {
    const arrayBuf = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      sampleRate: 16000,
    });
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      return analyzeAudioBuffer(audioBuffer);
    } finally {
      await audioCtx.close();
    }
  }
}
