/**
 * Notification Service for SMS / WhatsApp Receipts
 */

/**
 * Generates and logs a digital receipt message, and provides WhatsApp shareable deep links.
 * @param {object} receipt - The receipt record
 * @param {string} mandalName - Mandal Name
 * @param {string} host - Base URL (e.g. http://localhost:5173 or production domain)
 * @returns {object} Contains the generated message, a WhatsApp link, and a public URL
 */
export function sendReceiptNotification(receipt, mandalName, host = 'http://localhost:5173') {
  const publicLink = `${host}/receipt/${receipt.secure_token}`;
  const amountFormatted = `₹${receipt.amount}`;
  
  const message = `Thank you for contributing to ${mandalName || 'Ganesh Mandal'}.

Digital Vargani Receipt:
Receipt No: ${receipt.receipt_number}
Amount: ${amountFormatted}
Status: ${receipt.status}

View Receipt:
${publicLink}`;

  // Print to console for development audit / simulation
  console.log('\n=======================================');
  console.log(`[SIMULATED SMS SENT]`);
  console.log(`To Mobile: ${receipt.donor_mobile}`);
  console.log(`Body:\n${message}`);
  console.log('=======================================\n');

  // Format Indian mobile numbers for WhatsApp deep links
  let cleanMobile = receipt.donor_mobile.replace(/\D/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = `91${cleanMobile}`;
  }

  // Create WhatsApp deep link
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanMobile}&text=${encodeURIComponent(message)}`;

  return {
    success: true,
    message,
    whatsappUrl,
    publicLink
  };
}

/**
 * Sends a generic SMS alert to workers or admins.
 */
export function sendAlertSMS(mobile, title, message) {
  console.log('\n=======================================');
  console.log(`[SIMULATED SMS ALERT]`);
  console.log(`To Mobile: ${mobile}`);
  console.log(`Subject: ${title}`);
  console.log(`Body: ${message}`);
  console.log('=======================================\n');
  return { success: true };
}
