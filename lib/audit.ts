import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './error-handler';

export interface AuditResult {
  isValid: boolean;
  mismatch?: string;
}

/**
 * SystemAuditService
 * Blunt, direct verification logic.
 * Cross-checks database records vs calculated balances.
 */
export const SystemAuditService = {
  /**
   * VerifyContractBalance
   * Checks if total payments recorded match the contract's totalPaid field.
   */
  async verifyContractBalance(contractId: string): Promise<AuditResult> {
    const contractRef = doc(db, 'contracts', contractId);
    const contractSnap = await getDoc(contractRef);

    if (!contractSnap.exists()) {
      return { isValid: false, mismatch: 'Contract not found' };
    }

    const contractData = contractSnap.data();
    const paymentsQuery = query(collection(db, 'payments'), where('contractId', '==', contractId));
    const paymentsSnap = await getDocs(paymentsQuery);

    let calculatedTotal = 0;
    paymentsSnap.forEach((doc) => {
      calculatedTotal += doc.data().amount;
    });

    if (calculatedTotal !== contractData.totalPaid) {
      return { 
        isValid: false, 
        mismatch: `Balance mismatch: DB says ${contractData.totalPaid}, Payments sum to ${calculatedTotal}` 
      };
    }

    // Check vehicle status drift
    const vehicleRef = doc(db, 'vehicles', contractData.vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);
    if (vehicleSnap.exists()) {
      const vehicleData = vehicleSnap.data();
      if (contractData.status === 'COMPLETED' && vehicleData.status !== 'OWNED') {
        return { isValid: false, mismatch: `Status drift: Contract COMPLETED but vehicle is ${vehicleData.status}` };
      }
      if (contractData.status === 'ACTIVE' && vehicleData.status !== 'RENTED') {
        return { isValid: false, mismatch: `Status drift: Contract ACTIVE but vehicle is ${vehicleData.status}` };
      }
    }

    return { isValid: true };
  },

  /**
   * RunDailyAudit
   * Scans all active contracts for integrity.
   */
  async runFullAudit(runBy: string = 'system'): Promise<{ errors: string[], integrityScore: number }> {
    try {
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const errors: string[] = [];

      for (const contractDoc of contractsSnap.docs) {
        const result = await this.verifyContractBalance(contractDoc.id);
        if (!result.isValid) {
          errors.push(`Contract ${contractDoc.id}: ${result.mismatch}`);
        }
      }

      const integrityScore = contractsSnap.size > 0 
        ? Math.round(((contractsSnap.size - errors.length) / contractsSnap.size) * 100) 
        : 100;

      // Log the audit result
      await addDoc(collection(db, 'reconciliation_logs'), {
        timestamp: serverTimestamp(),
        integrityScore,
        errors,
        totalContracts: contractsSnap.size,
        runBy
      });

      return { errors, integrityScore };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
      return { errors: [], integrityScore: 0 };
    }
  },

  /**
   * GetSystemStats
   * Aggregates data for the dashboard.
   */
  async getSystemStats() {
    try {
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const vehiclesSnap = await getDocs(collection(db, 'vehicles'));

      const contracts = contractsSnap.docs.map(d => d.data());
      const payments = paymentsSnap.docs.map(d => d.data());

      const totalPortfolioValue = contracts.reduce((acc, curr) => acc + (curr.totalBalance + curr.totalPaid), 0);
      const totalCollected = payments.reduce((acc, curr) => acc + curr.amount, 0);
      
      const statusCounts = contracts.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      // We don't run the full audit here to avoid side effects, 
      // just get the latest log or calculate on the fly without saving
      const errors: string[] = [];
      for (const contractDoc of contractsSnap.docs) {
        const result = await this.verifyContractBalance(contractDoc.id);
        if (!result.isValid) {
          errors.push(`Contract ${contractDoc.id}: ${result.mismatch}`);
        }
      }

      const integrityScore = contracts.length > 0 
        ? Math.round(((contracts.length - errors.length) / contracts.length) * 100) 
        : 100;

      return {
        totalPortfolioValue,
        totalCollected,
        statusCounts,
        integrityScore,
        integrityErrors: errors,
        totalContracts: contracts.length,
        totalVehicles: vehiclesSnap.size
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'system_stats');
    }
  }
};
