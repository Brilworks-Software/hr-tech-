import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

export interface UserProfile {
  id: string; // userId from Firebase Auth
  email: string;
  companyName: string;
  companyWebsite: string;
  companyBio: string;
  companySize: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProfileData {
  email: string;
  companyName: string;
  companyWebsite: string;
  companyBio: string;
  companySize: string;
}

export const userService = {
  /**
   * Create or update user profile
   */
  async createOrUpdateUserProfile(userId: string, data: CreateUserProfileData): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const isNew = !userDoc.exists();

    await setDoc(
      userRef,
      {
        email: data.email,
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        companyBio: data.companyBio,
        companySize: data.companySize,
        updatedAt: Timestamp.now(),
        ...(isNew ? { createdAt: Timestamp.now() } : {}),
      },
      { merge: true }
    );
  },

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      id: userDoc.id,
      email: data.email,
      companyName: data.companyName,
      companyWebsite: data.companyWebsite,
      companyBio: data.companyBio,
      companySize: data.companySize,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserProfile;
  },

  /**
   * Check if user has completed profile setup
   */
  async hasProfileSetup(userId: string): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    return profile !== null && !!profile.companyName;
  },
};

