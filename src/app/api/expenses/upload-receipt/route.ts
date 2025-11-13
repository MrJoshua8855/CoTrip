import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateReceiptFile } from '@/lib/upload';

// POST /api/expenses/upload-receipt - Upload receipt image
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    try {
      validateReceiptFile(file);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid file' },
        { status: 400 }
      );
    }

    // Upload to Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        {
          error: 'Cloud storage not configured. Please contact administrator.',
        },
        { status: 500 }
      );
    }

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('upload_preset', uploadPreset);
    uploadFormData.append('folder', 'cotrip/receipts');

    // Add user ID to context for tracking
    uploadFormData.append('context', `user_id=${session.user.id}`);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('Cloudinary upload error:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to upload receipt',
          details: errorData.error?.message || 'Unknown error',
        },
        { status: 500 }
      );
    }

    const data = await uploadResponse.json();

    return NextResponse.json({
      url: data.secure_url,
      publicId: data.public_id,
      format: data.format,
      size: data.bytes,
      width: data.width,
      height: data.height,
    });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload receipt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/upload-receipt - Delete receipt from cloud storage
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { publicId } = await req.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'No public ID provided' },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloud storage not configured' },
        { status: 500 }
      );
    }

    // Generate timestamp and signature for authenticated request
    const timestamp = Math.round(Date.now() / 1000);
    const crypto = require('crypto');
    const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');

    const deleteFormData = new FormData();
    deleteFormData.append('public_id', publicId);
    deleteFormData.append('timestamp', timestamp.toString());
    deleteFormData.append('api_key', apiKey);
    deleteFormData.append('signature', signature);

    const deleteResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/destroy`,
      {
        method: 'POST',
        body: deleteFormData,
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      console.error('Cloudinary delete error:', errorData);
      return NextResponse.json(
        { error: 'Failed to delete receipt' },
        { status: 500 }
      );
    }

    const data = await deleteResponse.json();

    return NextResponse.json({
      message: 'Receipt deleted successfully',
      result: data.result,
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 }
    );
  }
}
