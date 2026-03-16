import { db } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  runTransaction 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './error-handler';

export interface PaymentData {
  contractId: string;
  userId: string;
  amount: number;
  stripeId: string;
  userDisplayName: string;
  vehicleDetails: any;
}

export const OwnershipService = {
  /**
   * Sends a notification to the admin.
   */
  async notifyAdmin(type: 'PAYMENT_FAILED' | 'CONTRACT_DELINQUENT', details: { contractId: string; userId: string; userEmail?: string; message: string }) {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...details,
        type,
        timestamp: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }
  },

  /**
   * Marks a contract as delinquent and notifies admin.
   */
  async markAsDelinquent(contractId: string, userId: string, userEmail: string, reason: string) {
    try {
      const contractRef = doc(db, 'contracts', contractId);
      await updateDoc(contractRef, { status: 'DELINQUENT' });
      
      await this.notifyAdmin('CONTRACT_DELINQUENT', {
        contractId,
        userId,
        userEmail,
        message: `Contract ${contractId} marked as DELINQUENT. Reason: ${reason}`
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `contracts/${contractId}`);
    }
  },

  /**
   * Processes a payment and updates contract/vehicle status if ownership is achieved.
   */
  async processPayment(data: PaymentData) {
    const { contractId, userId, amount, stripeId, userDisplayName, vehicleDetails } = data;
    
    try {
      await runTransaction(db, async (transaction) => {
        const contractRef = doc(db, 'contracts', contractId);
        const contractSnap = await transaction.get(contractRef);
        
        if (!contractSnap.exists()) {
          throw new Error('Contract does not exist');
        }
        
        const contractData = contractSnap.data();
        const currentPaid = contractData.totalPaid || 0;
        const currentBalance = contractData.totalBalance || 0;
        
        const newTotalPaid = currentPaid + amount;
        const newTotalBalance = Math.max(0, currentBalance - amount);
        
        // 1. Record the payment
        const paymentRef = doc(collection(db, 'payments'));
        transaction.set(paymentRef, {
          contractId,
          userId,
          amount,
          stripeId,
          timestamp: serverTimestamp()
        });
        
        // 2. Update the contract
        const contractUpdate: any = {
          totalPaid: newTotalPaid,
          totalBalance: newTotalBalance,
        };
        
        if (newTotalBalance === 0 && contractData.status !== 'COMPLETED') {
          contractUpdate.status = 'COMPLETED';
          
          // 3. Update vehicle status
          const vehicleRef = doc(db, 'vehicles', contractData.vehicleId);
          const vehicleSnap = await transaction.get(vehicleRef);
          const vehicleData = vehicleSnap.exists() ? vehicleSnap.data() : vehicleDetails;
          
          transaction.update(vehicleRef, { status: 'OWNED' });
          
          // 4. Generate Digital Title Certificate
          const certRef = doc(collection(db, 'certificates'));
          transaction.set(certRef, {
            contractId,
            userId,
            vehicleDetails: vehicleData,
            issuedAt: serverTimestamp(),
            certificateId: `TITLE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            ownerName: userDisplayName
          });
        }
        
        transaction.update(contractRef, contractUpdate);
      });
      
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `contracts/${contractId}/payments`);
      throw error;
    }
  }
};
