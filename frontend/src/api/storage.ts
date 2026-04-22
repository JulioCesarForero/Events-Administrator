import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ensureAnonymousAuth, getFirebaseStorage } from '../firebase';

export interface UploadedEvidence {
  downloadURL: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface UploadEvidenceArgs {
  file: File;
  eventId: string;
  groupId: string;
  paymentId: string;
}

function sanitizeFileName(name: string): string {
  const clean = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_');
  return clean.length > 120 ? clean.slice(-120) : clean;
}

export async function uploadPaymentEvidence({
  file,
  eventId,
  groupId,
  paymentId,
}: UploadEvidenceArgs): Promise<UploadedEvidence> {
  await ensureAnonymousAuth();
  const storage = getFirebaseStorage();
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name || 'evidence');
  const storagePath = `payment-evidence/${eventId}/${groupId}/${paymentId}/${timestamp}_${safeName}`;
  const fileRef = ref(storage, storagePath);
  const contentType = file.type || 'application/octet-stream';
  const snapshot = await uploadBytes(fileRef, file, { contentType });
  const downloadURL = await getDownloadURL(snapshot.ref);
  return {
    downloadURL,
    storagePath,
    fileName: safeName,
    contentType,
    sizeBytes: file.size,
  };
}
