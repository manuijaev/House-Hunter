import React, { useState, useEffect } from 'react';
import { X, CreditCard, Phone, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { djangoAPI } from '../services/djangoAPI';
import { useAuth } from '../contexts/AuthContext';
import './PaymentModal.css';

function PaymentModal({ house, onClose, onPaymentSuccess, isDarkMode }) {
  const { currentUser } = useAuth();

  console.log('PaymentModal COMPONENT RENDERED for house:', house?.title);
  console.log('Props received:', { house: !!house, onClose: !!onClose, onPaymentSuccess: !!onPaymentSuccess, isDarkMode });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null, 'pending', 'completed', 'failed'
  const [paymentId, setPaymentId] = useState(null);

  // Auto-fill phone number if available
  useEffect(() => {
    if (currentUser?.phoneNumber) {
      setPhoneNumber(currentUser.phoneNumber);
    }
  }, [currentUser]);

  // Poll for payment status updates
  useEffect(() => {
    let intervalId;

    if (paymentId && paymentStatus === 'pending') {
      console.log('Starting payment status polling for payment_id:', paymentId);
      intervalId = setInterval(async () => {
        try {
          console.log('Checking payment status...');
          const payments = await djangoAPI.getUserPayments();
          const currentPayment = payments.payments.find(p => p.id === paymentId);

          if (currentPayment) {
            console.log('Current payment status:', currentPayment.status);
            if (currentPayment.status === 'completed') {
              console.log('Payment completed! Calling handlePaymentSuccess');
              setPaymentStatus('completed');
              handlePaymentSuccess();
              clearInterval(intervalId);
            } else if (currentPayment.status === 'failed') {
              console.log('Payment failed');
              setPaymentStatus('failed');
              toast.error('Payment failed. Please try again.');
              clearInterval(intervalId);
            } else {
              console.log('Payment still pending');
            }
          } else {
            console.log('Payment not found in response');
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (intervalId) {
        console.log('Clearing payment polling interval');
        clearInterval(intervalId);
      }
    };
  }, [paymentId, paymentStatus]);

  const validatePhoneNumber = (number) => {
    // Kenyan phone number validation (254XXXXXXXXX format)
    const kenyaPhoneRegex = /^254[0-9]{9}$/;
    return kenyaPhoneRegex.test(number);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('PAYMENT FORM SUBMITTED');

    if (!phoneNumber.trim()) {
      console.log('No phone number entered');
      toast.error('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      console.log('Invalid phone number format:', phoneNumber);
      toast.error('Please enter a valid Kenyan phone number (254XXXXXXXXX)');
      return;
    }

    console.log('Phone number valid, initiating payment...');
    setIsLoading(true);
    setPaymentStatus('pending');

    try {
      const paymentData = {
        phone_number: phoneNumber,
        amount: 1, // Fixed amount for testing
        account_reference: `HOUSE_UNLOCK_${house.id}_${currentUser.id}`,
        transaction_desc: `Unlock chat for ${house.title}`,
        house_id: house.id
      };

      console.log('Sending payment data:', paymentData);
      const response = await djangoAPI.initiatePayment(paymentData);
      console.log('Payment API response:', response);

      if (response.payment_id) {
        console.log('Payment initiated successfully, payment_id:', response.payment_id);
        setPaymentId(response.payment_id);
        toast.success('STK Push sent! Please check your phone and enter M-Pesa PIN to complete payment.');

        // For development: Automatically simulate payment success after 5 seconds
        console.log('Development mode: Simulating payment success in 5 seconds...');
        setTimeout(async () => {
          try {
            console.log('Calling simulate payment success...');
            await djangoAPI.simulatePaymentSuccess(response.payment_id);
            console.log('Payment simulation completed');
          } catch (error) {
            console.error('Payment simulation failed:', error);
          }
        }, 5000);
      } else {
        console.log('No payment_id in response');
        throw new Error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment initiation failed:', error);
      setIsLoading(false);
      setPaymentStatus(null);
      toast.error('Failed to initiate payment. Please try again.');
    }
  };

  const handlePaymentSuccess = () => {
    console.log('Payment completed successfully for house:', house.title);

    // Show success toast
    toast.success('Payment received! House chat unlocked successfully.');

    // Call parent success handler (HouseCard will handle localStorage and UI updates)
    if (onPaymentSuccess) {
      onPaymentSuccess(house.id);
    }

    // Close modal after a short delay
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    if (paymentStatus === 'pending') {
      toast('Payment in progress. You can close this modal and check back later.', {
        duration: 4000,
      });
    }
    onClose();
  };

  return (
    <div className={`modal-overlay ${isDarkMode ? 'dark' : ''}`}>
      <div className={`payment-modal ${isDarkMode ? 'dark' : ''}`}>
        <div className="modal-header">
          <h2>Unlock House Chat</h2>
          <button
            className="close-btn"
            onClick={handleClose}
            disabled={isLoading}
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {paymentStatus === null && (
            <>
              <div className="payment-info">
                <div className="house-info">
                  <h3>{house.title}</h3>
                  <p>{house.location}</p>
                </div>

                <div className="amount-info">
                  <div className="amount">
                    <span className="currency">KES</span>
                    <span className="value">1</span>
                  </div>
                  <p className="amount-label">Unlock Fee</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="payment-form">
                <div className="form-group">
                  <label htmlFor="phone">
                    <Phone size={18} />
                    M-Pesa Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="254XXXXXXXXX"
                    required
                    disabled={isLoading}
                  />
                  <small>Enter your M-Pesa registered phone number</small>
                </div>

                <button
                  type="submit"
                  className="pay-btn"
                  disabled={isLoading || !phoneNumber.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader size={18} className="spinning" />
                      Sending STK Push...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      Pay & Unlock
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {paymentStatus === 'pending' && (
            <div className="payment-pending">
              <div className="status-icon">
                <Loader size={48} className="spinning" />
              </div>
              <h3>Payment in Progress</h3>
              <p>STK Push sent to {phoneNumber}</p>
              <p className="instructions">
                Please check your phone and enter your M-Pesa PIN to complete the payment.
              </p>
              <div className="waiting-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}

          {paymentStatus === 'completed' && (
            <div className="payment-success">
              <div className="status-icon success">
                <CheckCircle size={48} />
              </div>
              <h3>Payment Successful!</h3>
              <p>House chat has been unlocked.</p>
              <p>You can now contact the landlord directly.</p>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="payment-failed">
              <div className="status-icon failed">
                <AlertCircle size={48} />
              </div>
              <h3>Payment Failed</h3>
              <p>Please try again or contact support if the issue persists.</p>
              <button
                className="retry-btn"
                onClick={() => {
                  setPaymentStatus(null);
                  setIsLoading(false);
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;