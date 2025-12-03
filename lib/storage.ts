"use client";

import { storage } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from "firebase/storage";

export type UploadProgress = {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
};

export type UploadResult = {
  downloadUrl: string;
  storagePath: string;
};

/**
 * Upload a file directly to Firebase Storage from the browser
 * This bypasses Vercel's serverless function size limits
 */
export async function uploadToFirebaseStorage(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!storage) {
    throw new Error("Firebase Storage is not configured");
  }

  // Create a unique path for the file
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `uploads/${timestamp}-${sanitizedName}`;
  
  const storageRef = ref(storage, storagePath);
  
  return new Promise((resolve, reject) => {
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          progress,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
        });
      },
      (error) => {
        console.error("Upload error:", error);
        reject(new Error(`Upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadUrl,
            storagePath,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}








