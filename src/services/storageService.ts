import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';

export const storageService = {
  /**
   * Upload a file to Firebase Storage
   */
  async uploadFile(file: File, path: string): Promise<string> {
    const storageRef = ref(storage, path);
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  },

  /**
   * Upload resume file
   */
  async uploadResume(file: File, candidateId: string): Promise<string> {
    const fileName = `resumes/${candidateId}/${Date.now()}_${file.name}`;
    return this.uploadFile(file, fileName);
  },
};

