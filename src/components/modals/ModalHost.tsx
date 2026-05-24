import { useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { PermissionModal } from './PermissionModal';
import { FaceObservationModal } from './FaceObservationModal';
import { VoiceListeningModal } from './VoiceListeningModal';
import { capturePhoto, requestCameraPermission } from '../../lib/capture';
import { startRecognition, type SttController } from '../../lib/stt';

const MAX_REC_SECONDS = 20;

/**
 * Bridges the presentational modals to real device APIs + the AppContext signal
 * flow: camera permission → photo capture → 望诊; mic permission → speech-to-text → 闻诊.
 */
export function ModalHost() {
  const app = useApp();
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sttRef = useRef<SttController | null>(null);
  const transcriptRef = useRef('');
  const submittedRef = useRef(false);

  const clearTimer = () => {
    if (recTimer.current) {
      clearInterval(recTimer.current);
      recTimer.current = null;
    }
  };

  const stopVoiceCapture = () => {
    clearTimer();
    sttRef.current?.stop();
    sttRef.current = null;
  };

  const finishVoice = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    stopVoiceCapture();
    app.submitVoiceResult(transcriptRef.current);
  };

  useEffect(
    () => () => {
      clearTimer();
      sttRef.current?.stop();
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

  // ─── Face / tongue capture ────────────────────────────────
  const onFaceStart = async () => {
    try {
      const image = await capturePhoto();
      app.submitFaceResult(image);
    } catch {
      app.cancelFace();
    }
  };

  // ─── Voice recording ──────────────────────────────────────
  const onVoiceStart = () => {
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
        onStart={onFaceStart}
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
