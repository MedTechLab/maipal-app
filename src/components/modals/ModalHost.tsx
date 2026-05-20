import { useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { PermissionModal } from './PermissionModal';
import { FaceObservationModal } from './FaceObservationModal';
import { VoiceListeningModal } from './VoiceListeningModal';

/**
 * Orchestrates the global modal flow:
 *   camera permission → face observation → mic permission → voice listening → finish
 */
export function ModalHost() {
  const app = useApp();
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // After face-observation auto-advances through its states, kick to voice
  const faceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const onFaceStart = () => {
    app.openFaceModal('observing');
    faceTimers.current = [
      setTimeout(() => app.openFaceModal('holding'), 1800),
      setTimeout(() => app.openFaceModal('done'), 3600),
      setTimeout(() => {
        app.openFaceModal(null);
        if (app.micPerm === null) app.openPermModal('mic');
        else if (app.micPerm) app.openVoiceModal('ready');
        else app.finishCheckup();
      }, 5000),
    ];
  };

  const onVoiceStart = () => {
    app.openVoiceModal('recording');
    app.setRecTime(0);
    let t = 0;
    recTimer.current = setInterval(() => {
      t += 1;
      app.setRecTime(t);
    }, 1000);
    setTimeout(() => {
      if (recTimer.current) clearInterval(recTimer.current);
      app.openVoiceModal('done');
      setTimeout(() => {
        app.openVoiceModal(null);
        app.finishCheckup();
      }, 900);
    }, 3000);
  };

  useEffect(
    () => () => {
      faceTimers.current.forEach(clearTimeout);
      if (recTimer.current) clearInterval(recTimer.current);
    },
    [],
  );

  return (
    <>
      <PermissionModal
        open={app.permModal === 'camera'}
        type="camera"
        onAllow={() => {
          app.setCameraPerm(true);
          app.openPermModal(null);
          setTimeout(() => app.openFaceModal('ready'), 300);
        }}
        onDeny={() => {
          app.setCameraPerm(false);
          app.openPermModal(null);
          setTimeout(() => {
            if (app.micPerm === null) app.openPermModal('mic');
            else if (app.micPerm) app.openVoiceModal('ready');
            else app.finishCheckup();
          }, 300);
        }}
      />
      <PermissionModal
        open={app.permModal === 'mic'}
        type="mic"
        onAllow={() => {
          app.setMicPerm(true);
          app.openPermModal(null);
          setTimeout(() => app.openVoiceModal('ready'), 300);
        }}
        onDeny={() => {
          app.setMicPerm(false);
          app.openPermModal(null);
          setTimeout(() => app.finishCheckup(), 300);
        }}
      />
      <FaceObservationModal
        open={!!app.faceModal}
        state={app.faceModal || 'ready'}
        onStart={onFaceStart}
        onClose={() => {
          faceTimers.current.forEach(clearTimeout);
          app.openFaceModal(null);
          app.resolveCheckup();
        }}
      />
      <VoiceListeningModal
        open={!!app.voiceModal}
        state={app.voiceModal || 'ready'}
        onStart={onVoiceStart}
        onSkip={() => {
          if (recTimer.current) clearInterval(recTimer.current);
          app.openVoiceModal(null);
          app.finishCheckup();
        }}
        time={app.recTime}
      />
    </>
  );
}
