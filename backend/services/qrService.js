import QRCode from 'qrcode';

/**
 * Generates a base64 QR Code image URL representing the text string.
 * @param {string} text - Link or text to encode
 * @returns {Promise<string|null>} Data URL of the generated QR code (base64 image)
 */
export async function generateQRCode(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 250,
      color: {
        dark: '#2c3e50', // dark slate
        light: '#ffffff'
      }
    });
    return dataUrl;
  } catch (error) {
    console.error('QR code generation error:', error);
    return null;
  }
}
