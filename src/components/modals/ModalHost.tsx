import { useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { PermissionModal } from './PermissionModal';
import { FaceObservationModal } from './FaceObservationModal';
import { VoiceListeningModal } from './VoiceListeningModal';
import { requestCameraPermission } from '../../lib/capture';
import { startRecognition, type SttController } from '../../lib/stt';
import { VoiceRecorder, type VoiceMetrics } from '../../lib/voice-analysis';

const MAX_REC_SECONDS = 20;

/**
 * Bridges the presentational modals to real device APIs + the AppContext signal
 * flow: camera permission → photo capture → 望诊; mic permission → speech-to-text + audio analysis → 闻诊.
 */
export function ModalHost() {
  const app = useApp();
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sttRef = useRef<SttController | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const transcriptRef = useRef('');
  const submittedRef = useRef(false);

  const clearTimer = () => {
    if (recTimer.current) {
      clearInterval(recTimer.current);
      recTimer.current = null;
    }
  };

  const stopVoiceCapture = async (): Promise<VoiceMetrics | null> => {
    clearTimer();
    sttRef.current?.stop();
    sttRef.current = null;
    // Stop audio recorder and get metrics
    try {
      const metrics = await recorderRef.current?.stop();
      recorderRef.current = null;
      return metrics ?? null;
    } catch {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      return null;
    }
  };

  const finishVoice = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const metrics = await stopVoiceCapture();
    app.submitVoiceResult(transcriptRef.current, metrics ?? undefined);
  };

  useEffect(
    () => () => {
      clearTimer();
      sttRef.current?.stop();
      recorderRef.current?.cancel();
    },
    [],
  );

  // ─── Permissions ──────────────────────────────────────────
  const onCameraAllow = async () => {
    const granted = await requestCameraPermission().catch(() => false);
    app.onPermissionResult('camera', granted);
  };

  const onMicAllow = async () => {
    let granted = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      granted = true;
    } catch {
      granted = false;
    }
    app.onPermissionResult('mic', granted);
  };

  // ─── Voice recording (STT + audio analysis in parallel) ───
  const onVoiceStart = async () => {
    submittedRef.current = false;
    transcriptRef.current = '';
    app.openVoiceModal('recording');
    app.setRecTime(0);
    let t = 0;
    recTimer.current = setInterval(() => {
      t += 1;
      app.setRecTime(t);
      if (t >= MAX_REC_SECONDS) finishVoice();
    }, 1000);

    // Start audio recorder for real acoustic analysis
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
      recorderRef.current = recorder;
    } catch {
      // If audio recording fails, continue with STT only
      recorderRef.current = null;
    }

    // Start STT in parallel
    sttRef.current = startRecognition({
      onPartial: (text) => {
        transcriptRef.current = text;
      },
      onEnd: (finalText) => {
        if (finalText) transcriptRef.current = finalText;
        finishVoice();
      },
      onError: () => {
        // keep the timer running — the user can stop manually
      },
    });
  };

  return (
    <>
      <PermissionModal
        open={app.permModal === 'camera'}
        type="camera"
        onAllow={onCameraAllow}
        onDeny={() => app.onPermissionResult('camera', false)}
      />
      <PermissionModal
        open={app.permModal === 'mic'}
        type="mic"
        onAllow={onMicAllow}
        onDeny={() => app.onPermissionResult('mic', false)}
      />
      <FaceObservationModal
        open={!!app.faceModal}
        state={app.faceModal || 'ready'}
        kind={app.faceKind}
        onCapture={app.submitFaceResult}
        onClose={app.cancelFace}
      />
      <VoiceListeningModal
        open={!!app.voiceModal}
        state={app.voiceModal || 'ready'}
        guidance={app.voiceGuidance}
        time={app.recTime}
        onStart={onVoiceStart}
        onStop={finishVoice}
        onSkip={app.cancelVoice}
      />
    </>
  );
}
