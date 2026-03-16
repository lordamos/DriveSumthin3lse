import { db } from './firebase-admin';
import * as admin from 'firebase-admin';

export interface PaymentProcessedData {
  contractId: string;
  userId: string;
  amount: number;
  stripeId: string;
}

export const ServerOwnershipService = {
  async processSuccessfulPayment(data: PaymentProcessedData) {
    const { contractId, userId, amount, stripeId } = data;
    
    try {
      await db.runTransaction(async (transaction: any) => {
        const contractRef = db.collection('contracts').doc(contractId);
        const contractSnap = await transaction.get(contractRef);
        
        if (!contractSnap.exists) {
          throw new Error('Contract does not exist');
        }
        
        const contractData = contractSnap.data();
        const currentPaid = contractData.totalPaid || 0;
        const currentBalance = contractData.totalBalance || 0;
        
        const newTotalPaid = currentPaid + amount;
        const newTotalBalance = Math.max(0, currentBalance - amount);
        
        // 1. Record the payment
        const paymentRef = db.collection('payments').doc();
        transaction.set(paymentRef, {
          contractId,
          userId,
          amount,
          stripeId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 2. Update the contract
        const contractUpdate: any = {
          totalPaid: newTotalPaid,
          totalBalance: newTotalBalance,
        };
        
        if (newTotalBalance === 0 && contractData.status !== 'COMPLETED') {
          contractUpdate.status = 'COMPLETED';
          
          // 3. Update vehicle status
          const vehicleRef = db.collection('vehicles').doc(contractData.vehicleId);
          transaction.update(vehicleRef, { status: 'OWNED' });
          
          // 4. Generate Digital Title Certificate
          const certRef = db.collection('certificates').doc();
          transaction.set(certRef, {
            contractId,
            userId,
            vehicleDetails: contractData.vehicleDetails || {},
            issuedAt: admin.firestore.FieldValue.serverTimestamp(),
            certificateId: `TITLE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            ownerName: contractData.userDisplayName || 'Owner'
          });
        }
        
        transaction.update(contractRef, contractUpdate);
      });
      
      return { success: true };
    } catch (error) {
      console.error('Server Ownership Error:', error);
      throw error;
    }
  },

  async notifyAdmin(type: string, details: any) {
    try {
      await db.collection('notifications').add({
        ...details,
        type,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Failed to send admin notification (server):', error);
    }
  }
};
