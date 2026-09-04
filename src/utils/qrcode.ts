import QRCode from 'qrcode';

/**
 * Generates a Data URL (base64 image) for a given text string.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e1b4b', // deep indigo/navy
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Error generating QR Code:', err);
    return '';
  }
}
