import React, { useState, useEffect } from "react";
import { initiatePayment } from "../services/djangoAPI";
import { X, CreditCard, Phone, Loader, CheckCircle, AlertCircle, MessageCircle, Lock } from "lucide-react";
import './PaymentModal.css';

function PaymentModal({ house, onClose, onPaymentSuccess, isDarkMode }) {
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success' when payment confirmed

  // Polling interval reference
  const [pollInterval, setPollInterval] = useState(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const startPolling = (paymentId) => {
    setPolling(true);

    const interval = setInterval(async () => {
      try {
        // Check payment status by fetching user's payments
        const response = await fetch('http://localhost:8000/api/payments/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          }
        });

        if (response.ok) {
          const paymentsData = await response.json();
          const currentPayment = paymentsData.payments.find(p => p.id === paymentId);

          console.log("Polling payment status:", currentPayment);

          if (currentPayment && currentPayment.status === 'completed') {
            clearInterval(interval);
            setPolling(false);

            // Dispatch event so HouseCard unlocks immediately
            window.dispatchEvent(
              new CustomEvent("payment:completed", {
                detail: { houseId: String(house.id) },
              })
            );

            // Local update for safety
            localStorage.setItem(`paid_${house.id}`, "true");

            // Notify parent
            onPaymentSuccess && onPaymentSuccess();

            onClose();
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    setPollInterval(interval);
  };

  const validatePhoneNumber = (number) => {
    // Kenyan phone number validation (254XXXXXXXXX format)
    const kenyaPhoneRegex = /^254[0-9]{9}$/;
    return kenyaPhoneRegex.test(number);
  };

  const handleStartPayment = async () => {
    setLoading(true);
    setError(null);

    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      setLoading(false);
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError("Please enter a valid Kenyan phone number (254XXXXXXXXX)");
      setLoading(false);
      return;
    }

    try {
      const paymentData = {
        house_id: house.id,
        amount: 1, // Fixed amount for chat unlock (1 shilling)
        phone_number: phoneNumber,
        account_reference: `HOUSE_UNLOCK_${house.id}`,
        transaction_desc: `Unlock chat for ${house.title}`,
      };

      const response = await initiatePayment(paymentData);

      console.log("Payment initiation response:", response);

      if (!response?.payment_id) {
        throw new Error("Payment ID missing from API response");
      }

      setPaymentId(response.payment_id);

      // Start polling immediately
      startPolling(response.payment_id);

    } catch (err) {
      console.error("Payment error:", err);
      setError("Failed to initiate payment. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className={`modal-overlay ${isDarkMode ? 'dark' : ''}`}>
      <div className={`payment-modal ${isDarkMode ? 'dark' : ''}`}>
        <div className="modal-header">
          <h2>
            <MessageCircle size={24} style={{ marginRight: '8px' }} />
            Unlock Chat Access
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {!paymentStatus && (
            <>
              {/* Payment Info Section */}
              <div className="payment-info">
                <div className="house-info">
                  <h3>{house.title}</h3>
                  <p>Chat with landlord</p>
                </div>

                <div className="amount-info">
                  <div className="amount">
                    <span className="currency">KES</span>
                    <span className="value">1</span>
                  </div>
                  <p className="amount-label">One-time fee</p>
                </div>
              </div>

              {/* Feature Benefits */}
              <div style={{
                background: isDarkMode ? '#2a2a2a' : '#f8f9fa',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: isDarkMode ? '#e5e5e5' : '#1a1a1a'
                }}>
                  What you'll get:
                </h4>
                <ul style={{
                  margin: '0',
                  padding: '0 0 0 20px',
                  color: isDarkMode ? '#ccc' : '#666',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  <li>Direct messaging with the landlord</li>
                  <li>Ask questions about the property</li>
                  <li>Schedule viewings and negotiations</li>
                  <li>24/7 access to property details</li>
                </ul>
              </div>

              {/* Phone Number Input */}
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
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${isDarkMode ? '#444' : '#e5e5e5'}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: isDarkMode ? '#333' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#1a1a1a',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#007bff'}
                  onBlur={(e) => e.target.style.borderColor = isDarkMode ? '#444' : '#e5e5e5'}
                />
                <small style={{ color: isDarkMode ? '#ccc' : '#666' }}>
                  Enter your M-Pesa registered phone number (254XXXXXXXXX)
                </small>
              </div>

              {error && (
                <div style={{
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '20px',
                  color: '#c33'
                }}>
                  <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  {error}
                </div>
              )}

              <button
                className="pay-btn"
                onClick={handleStartPayment}
                disabled={loading || !phoneNumber.trim()}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinning" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Pay & Unlock Chat
                  </>
                )}
              </button>
            </>
          )}

          {paymentId && polling && (
            <div className="payment-pending">
              <div className="status-icon">
                <Loader size={48} className="spinning" />
              </div>
              <h3>Payment in Progress</h3>
              <p>M-Pesa STK Push sent to your phone</p>
              <p className="instructions">
                Please check your phone and enter your M-Pesa PIN to complete the payment.
              </p>
              <div className="waiting-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>

              {/* Development: Confirm Payment Button */}
              <div className="confirm-payment-section">
                <p className="confirm-note">Development Mode: Click below to simulate payment completion</p>
                <button
                  className="confirm-payment-btn"
                  onClick={async () => {
                    if (!paymentId) return;

                    try {
                      setLoading(true);
                      console.log('Simulating payment for paymentId:', paymentId);

                      // Call backend to simulate payment success
                      const response = await fetch(`http://localhost:8000/api/payments/simulate-success/`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ payment_id: paymentId })
                      });

                      if (response.ok) {
                        console.log('Simulate API call successful, starting verification polling...');

                        // Wait 2 seconds before starting polling to ensure backend has updated
                        setTimeout(() => {
                          const checkInterval = setInterval(async () => {
                            try {
                              console.log('Polling for payment status...');
                              const paymentsResponse = await fetch('http://localhost:8000/api/payments/', {
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                                }
                              });

                              if (paymentsResponse.ok) {
                                const paymentsData = await paymentsResponse.json();
                                const currentPayment = paymentsData.payments.find(p => p.id === paymentId);

                                console.log('Found payment:', currentPayment);
                                console.log('Payment status:', currentPayment?.status);
                                console.log('Checking if status === "completed":', currentPayment?.status === 'completed');

                                if (currentPayment && currentPayment.status === 'completed') {
                                  console.log('✅ Payment confirmed as completed! Showing success and unlocking house card.');
                                  clearInterval(checkInterval);

                                  // Show success state
                                  setPaymentStatus('success');
                                  setPolling(false);

                                  // Dispatch event so HouseCard unlocks immediately
                                  window.dispatchEvent(
                                    new CustomEvent("payment:completed", {
                                      detail: { houseId: String(house.id) },
                                    })
                                  );

                                  // Update localStorage
                                  localStorage.setItem(`paid_${house.id}`, "true");

                                  // Notify parent
                                  onPaymentSuccess && onPaymentSuccess();

                                  // Close modal after showing success for 2 seconds
                                  setTimeout(() => {
                                    onClose();
                                  }, 2000);
                                }
                              } else {
                                console.error('Failed to fetch payments data');
                              }
                            } catch (error) {
                              console.error('Error checking payment status:', error);
                            }
                          }, 2000); // Check every 2 seconds

                          // Stop checking after 15 seconds
                          setTimeout(() => {
                            clearInterval(checkInterval);
                            console.log('Polling timeout reached');
                          }, 15000);
                        }, 2000); // Wait 2 seconds before starting polling

                      } else {
                        console.error('Failed to simulate payment');
                      }
                    } catch (error) {
                      console.error('Error simulating payment:', error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !paymentId}
                >
                  <CheckCircle size={18} />
                  Simulate Payment Success
                </button>
              </div>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="payment-success">
              <div className="status-icon success">
                <CheckCircle size={48} />
              </div>
              <h3>Payment Successful!</h3>
              <p>Chat access has been unlocked.</p>
              <p>You can now message the landlord directly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;