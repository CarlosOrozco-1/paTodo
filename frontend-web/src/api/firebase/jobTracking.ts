import {
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './init';

export interface JobTrackingPosition {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
}

export interface JobTrackingSnapshot extends JobTrackingPosition {
  updatedAt: string;
}

function trackingRef(jobId: string) {
  return doc(db, 'jobs', jobId, 'tracking', 'current');
}

export async function publishJobTrackingPosition(
  jobId: string,
  position: JobTrackingPosition,
): Promise<void> {
  const workerId = auth.currentUser?.uid;
  if (!workerId) throw new Error('La sesión no está disponible.');

  const data: Record<string, unknown> = {
    workerId,
    latitude: position.latitude,
    longitude: position.longitude,
    updatedAt: serverTimestamp(),
  };

  if (
    position.accuracyMeters !== undefined &&
    Number.isFinite(position.accuracyMeters) &&
    position.accuracyMeters >= 0 &&
    position.accuracyMeters <= 10000
  ) {
    data.accuracyMeters = position.accuracyMeters;
  }
  if (
    position.headingDegrees !== undefined &&
    Number.isFinite(position.headingDegrees) &&
    position.headingDegrees >= 0 &&
    position.headingDegrees <= 360
  ) {
    data.headingDegrees = position.headingDegrees;
  }
  if (
    position.speedMetersPerSecond !== undefined &&
    Number.isFinite(position.speedMetersPerSecond) &&
    position.speedMetersPerSecond >= 0 &&
    position.speedMetersPerSecond <= 100
  ) {
    data.speedMetersPerSecond = position.speedMetersPerSecond;
  }

  await setDoc(trackingRef(jobId), data);
}

export function subscribeToJobTracking(
  jobId: string,
  onPosition: (position: JobTrackingSnapshot | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    trackingRef(jobId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onPosition(null);
        return;
      }

      const data = snapshot.data();
      const updatedAt = data.updatedAt;
      if (
        typeof data.latitude !== 'number' ||
        typeof data.longitude !== 'number' ||
        !(updatedAt instanceof Timestamp)
      ) {
        onPosition(null);
        return;
      }

      onPosition({
        latitude: data.latitude,
        longitude: data.longitude,
        accuracyMeters: typeof data.accuracyMeters === 'number' ? data.accuracyMeters : undefined,
        headingDegrees: typeof data.headingDegrees === 'number' ? data.headingDegrees : undefined,
        speedMetersPerSecond:
          typeof data.speedMetersPerSecond === 'number' ? data.speedMetersPerSecond : undefined,
        updatedAt: updatedAt.toDate().toISOString(),
      });
    },
    onError,
  );
}