/**
 * Upload receipt image to cloud storage (Cloudinary)
 * For production use, configure environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_UPLOAD_PRESET
 * - CLOUDINARY_API_KEY (optional, for server-side uploads)
 * - CLOUDINARY_API_SECRET (optional, for server-side uploads)
 */
export async function uploadReceipt(file: File): Promise<string> {
  // Validate file before upload
  validateReceiptFile(file);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'cotrip/receipts'); // Organize uploads in folder

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload receipt: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Validate receipt file type and size
 */
export function validateReceiptFile(file: File): void {
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/pdf',
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error(
      'Invalid file type. Please upload JPG, PNG, WEBP, or PDF files only.'
    );
  }

  if (file.size > maxSize) {
    throw new Error(
      `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
    );
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Generate unique filename for upload
 */
export function generateReceiptFilename(originalName: string, userId: string): string {
  const timestamp = Date.now();
  const extension = getFileExtension(originalName);
  const randomStr = Math.random().toString(36).substring(7);
  return `receipt_${userId}_${timestamp}_${randomStr}.${extension}`;
}

/**
 * Server-side upload using Cloudinary API
 * Use this for more secure uploads with authentication
 */
export async function uploadReceiptServerSide(
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary server-side configuration missing');
  }

  // Convert buffer to base64
  const base64File = fileBuffer.toString('base64');
  const dataURI = `data:image/jpeg;base64,${base64File}`;

  // Create signature for authenticated upload
  const timestamp = Math.round(Date.now() / 1000);
  const signature = generateCloudinarySignature(timestamp, apiSecret);

  const formData = new FormData();
  formData.append('file', dataURI);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);
  formData.append('folder', 'cotrip/receipts');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload receipt: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Generate Cloudinary signature for authenticated uploads
 */
function generateCloudinarySignature(timestamp: number, apiSecret: string): string {
  // In a real implementation, use the cloudinary npm package
  // This is a simplified version
  const crypto = require('crypto');
  const paramsToSign = `timestamp=${timestamp}${apiSecret}`;
  return crypto.createHash('sha1').update(paramsToSign).digest('hex');
}

/**
 * Delete receipt from cloud storage
 */
export async function deleteReceipt(publicId: string): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary configuration missing');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = generateCloudinarySignature(timestamp, apiSecret);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/destroy`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to delete receipt: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Extract public ID from Cloudinary URL
 */
export function extractPublicIdFromUrl(url: string): string {
  // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567/cotrip/receipts/receipt_123.jpg
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return '';

  // Get everything after upload/v{version}
  const pathParts = parts.slice(uploadIndex + 2);
  const pathWithExtension = pathParts.join('/');

  // Remove extension
  return pathWithExtension.replace(/\.[^/.]+$/, '');
}

/**
 * Get thumbnail URL from receipt URL
 */
export function getReceiptThumbnailUrl(url: string, width = 200): string {
  // Insert transformation parameters into Cloudinary URL
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;

  const beforeUpload = url.slice(0, uploadIndex + 8);
  const afterUpload = url.slice(uploadIndex + 8);

  return `${beforeUpload}w_${width},c_fill/${afterUpload}`;
}

/**
 * Check if URL is a valid Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary');
}
