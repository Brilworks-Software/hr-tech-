import { db } from '../lib/firebase';
import { collection, addDoc, query, limit, getDocs, Timestamp } from 'firebase/firestore';
import { Company } from '../lib/firebase';

export const companyService = {
  /**
   * Get or create a default company
   */
  async getOrCreateDefaultCompany(): Promise<string> {
    const companiesQuery = query(collection(db, 'companies'), limit(1));
    const companiesSnapshot = await getDocs(companiesQuery);

    if (companiesSnapshot.empty) {
      const newCompany = await addDoc(collection(db, 'companies'), {
        name: 'Demo Company',
        logoUrl: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return newCompany.id;
    }

    return companiesSnapshot.docs[0].id;
  },

  /**
   * Create a new company
   */
  async createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const companyRef = await addDoc(collection(db, 'companies'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return companyRef.id;
  },
};

