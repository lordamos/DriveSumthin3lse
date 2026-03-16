import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // If it's a "Failed to fetch" or "The user aborted a request", we might want to provide a more user-friendly message
  let displayMessage = errInfo.error;
  
  // Normalize the error message for detection
  const normalizedError = displayMessage.toLowerCase().replace(/\s+/g, ' ');
  
  const isNetworkError = 
    normalizedError.includes('failed to fetch') || 
    normalizedError.includes('networkerror') ||
    normalizedError.includes('error processing response text') ||
    normalizedError.includes('fetch request failed') ||
    normalizedError.includes('failed to reach the database');

  const isAbortError = 
    normalizedError.includes('the user aborted a request') ||
    normalizedError.includes('user aborted') ||
    normalizedError.includes('signal is aborted') ||
    normalizedError.includes('aborted') ||
    normalizedError.includes('abort');

  const isQuotaError = 
    normalizedError.includes('quota exceeded') ||
    normalizedError.includes('quota');

  if (isNetworkError) {
    displayMessage = 'Network error: Failed to reach the database. This is usually temporary. Please check your connection and try again.';
  } else if (isAbortError) {
    // Aborted requests are often benign (e.g. user navigated away), but we'll provide a message just in case
    displayMessage = 'Request interrupted: The operation was cancelled. This can happen if you navigate away or if the connection was lost.';
  } else if (isQuotaError) {
    displayMessage = 'System limit reached: Firestore quota exceeded. The quota will reset tomorrow. Please check the Firebase console for details.';
  }

  const enhancedError = new Error(JSON.stringify({ ...errInfo, displayMessage }));
  throw enhancedError;
}
