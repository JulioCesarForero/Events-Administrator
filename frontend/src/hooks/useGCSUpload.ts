import { useState } from 'react';
import { apiClient } from '../api/client';

export type UploadPurpose = 'import' | 'layout' | 'evidence' | 'general';

interface UseGCSUploadReturn {
  uploadFile: (
    file: File,
    purpose: UploadPurpose,
    auth?: { token?: string; isBearer?: boolean },
  ) => Promise<UploadResult>;
  isUploading: boolean;
  error: string | null;
  progress: number;
}

export interface UploadResult {
  fileUrl: string;
  bucket?: string;
  objectKey?: string;
  storagePath?: string;
}

export function useGCSUpload(): UseGCSUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (
    file: File,
    purpose: UploadPurpose,
    auth: { token?: string; isBearer?: boolean } = {},
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      if (!auth.token) {
        throw new Error('Missing auth token for storage upload');
      }
      // 1. Request Signed URL from Backend
      const response = await apiClient.post<{
        uploadUrl: string;
        fileUrl: string;
        bucket?: string;
        objectKey?: string;
        storagePath?: string;
      }>('/storage/upload-url', {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        purpose: purpose,
        sizeBytes: file.size,
      }, {
        token: auth.token,
        isBearer: auth.isBearer ?? true,
      });

      const { uploadUrl, fileUrl, bucket, objectKey, storagePath } = response;

      // 2. Upload directly to GCS using PUT
      // We use XMLHttpRequest to track progress, or just fetch for simplicity.
      // Fetch doesn't support progress out of the box easily, but it's cleaner.
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('GCS Upload Error:', errorText);
        throw new Error('Failed to upload file to storage');
      }

      setProgress(100);
      return { fileUrl, bucket, objectKey, storagePath };
    } catch (err: any) {
      const msg = err.message || 'Upload failed';
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, error, progress };
}
