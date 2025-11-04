// Real-time house status listener using Firebase
// This provides immediate updates when admin changes house status
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Listen for house status changes in real-time
 * @param {string} houseId - The house ID to listen for
 * @param {Function} callback - Callback function that receives status update
 * @returns {Function} Unsubscribe function
 */
export const listenToHouseStatus = (houseId, callback) => {
  const statusRef = doc(db, 'house_status_updates', houseId);
  
  return onSnapshot(statusRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      callback({
        houseId,
        approval_status: data.approval_status,
        isVacant: data.is_vacant,
        updatedAt: data.updated_at,
        ...data
      });
    }
  }, (error) => {
    console.error('Error listening to house status:', error);
  });
};

/**
 * Listen for all house status changes for a landlord
 * @param {string} landlordId - The landlord's UID or email
 * @param {Function} callback - Callback function that receives status updates
 * @returns {Function} Unsubscribe function
 */
export const listenToLandlordHousesStatus = (landlordId, callback) => {
  const q = query(
    collection(db, 'house_status_updates'),
    where('landlord_id', '==', landlordId)
  );

  return onSnapshot(q, (snapshot) => {
    const updates = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      updates[doc.id] = {
        houseId: doc.id,
        approval_status: data.approval_status,
        isVacant: data.is_vacant,
        updatedAt: data.updated_at,
        ...data
      };
    });
    callback(updates);
  }, (error) => {
    console.error('Error listening to landlord houses status:', error);
  });
};

/**
 * Update house status in Firebase (called from backend when admin approves/rejects)
 * This should be called from Django backend when status changes
 * @param {string} houseId - The house ID
 * @param {Object} statusData - Status data to update
 */
export const updateHouseStatusInFirebase = async (houseId, statusData) => {
  try {
    await setDoc(doc(db, 'house_status_updates', String(houseId)), {
      approval_status: statusData.approval_status,
      is_vacant: statusData.is_vacant !== undefined ? statusData.is_vacant : statusData.isVacant,
      landlord_id: statusData.landlord_id || statusData.landlordId,
      updated_at: serverTimestamp(),
      updated_by: statusData.updated_by || 'admin'
    }, { merge: true });
  } catch (error) {
    console.error('Error updating house status in Firebase:', error);
    throw error;
  }
};

/**
 * Listen for all house status changes (for tenant view)
 * @param {Function} callback - Callback function that receives all status updates
 * @returns {Function} Unsubscribe function
 */
export const listenToAllHouseStatus = (callback) => {
  const q = query(collection(db, 'house_status_updates'));

  return onSnapshot(q, (snapshot) => {
    const updates = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      updates[doc.id] = {
        houseId: doc.id,
        approval_status: data.approval_status,
        isVacant: data.is_vacant,
        updatedAt: data.updated_at,
        ...data
      };
    });
    callback(updates);
  }, (error) => {
    console.error('Error listening to all house status:', error);
  });
};

