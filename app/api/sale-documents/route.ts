/**
 * /api/sale-documents
 *
 * GET    — List sale documents for a shop (paginated, with date filter)
 * POST   — Upload a new sale document image to B2 + save record to DB
 * DELETE — Soft-delete a document from DB + remove from B2
 *
 * Access: SUPER_DUPER_ADMIN | SUPER_ADMIN only
 * Isolation: Shop-specific via getAuthContext
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, assertShopAccess } from '@/lib/authContext';
import { uploadToB2, deleteFromB2, generateB2Key, getB2SignedUrl } from '@/lib/b2Storage';
import '@/lib/bigint-patch';

// ─── Allowed image MIME types (no PDF) ───────────────────────────────────────
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);

// 2 MB server-side limit
const MAX_SIZE = 2 * 1024 * 1024;

// Reject double-extension filenames like evil.py.jpg
function hasDangerousName(name: string): boolean {
  const basename = (name.split(/[\/]/).pop() ?? name);
  return (basename.match(/\./g) ?? []).length > 1;
}

// Verify magic bytes so content matches declared type
async function verifyImageMagicBytes(buf: Buffer): Promise<boolean> {
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const gif  = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  const webp = buf.length >= 12 &&
               buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
               buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  const heic = buf.length >= 8 &&
               buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
  return jpeg || png || gif || webp || heic;
}

// ─── Role guard ───────────────────────────────────────────────────────────────
const ALLOWED_ROLES = new Set(['SUPER_DUPER_ADMIN', 'SUPER_ADMIN']);

function checkRole(role: string): NextResponse | null {
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { success: false, message: 'Access denied. Only Super Admin and above can access sale documents.' },
      { status: 403 },
    );
  }
  return null;
}

// ─── GET — list documents ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const roleError = checkRole(ctx.role);
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const shopId     = searchParams.get('shopId');
    const dateFrom   = searchParams.get('dateFrom');
    const dateTo     = searchParams.get('dateTo');
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit      = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip       = (page - 1) * limit;

    if (!shopId) {
      return NextResponse.json({ success: false, message: 'shopId is required' }, { status: 400 });
    }

    // Shop access check
    const shopAccessError = assertShopAccess(ctx, BigInt(shopId));
    if (shopAccessError) return shopAccessError;

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where = {
      shopId: BigInt(shopId),
      isActive: true,
      ...(Object.keys(dateFilter).length > 0 ? { documentDate: dateFilter } : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.saleDocument.findMany({
        where,
        orderBy: { documentDate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          fileName: true,
          fileKey: true,
          fileSize: true,
          mimeType: true,
          documentDate: true,
          description: true,
          createdAt: true,
          uploader: { select: { id: true, name: true, username: true, role: true } },
          shop: { select: { id: true, name: true } },
        },
      }),
      prisma.saleDocument.count({ where }),
    ]);

    // Generate fresh signed URLs for each document (1-hour expiry for listing)
    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const signedUrl = await getB2SignedUrl(doc.fileKey, 3600);
          return { ...doc, fileUrl: signedUrl };
        } catch {
          return { ...doc, fileUrl: null };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        documents: docsWithUrls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('[sale-documents GET]', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch documents' }, { status: 500 });
  }
}

// ─── POST — upload document ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const roleError = checkRole(ctx.role);
    if (roleError) return roleError;

    // Parse multipart form
    const formData = await req.formData();
    const file        = formData.get('file') as File | null;
    const shopId      = formData.get('shopId') as string | null;
    const docDateRaw  = formData.get('documentDate') as string | null;
    const description = (formData.get('description') as string | null) || '';

    if (!file) return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    if (!shopId) return NextResponse.json({ success: false, message: 'shopId is required' }, { status: 400 });
    if (!docDateRaw) return NextResponse.json({ success: false, message: 'documentDate is required' }, { status: 400 });

    // Shop access check
    const shopAccessError = assertShopAccess(ctx, BigInt(shopId));
    if (shopAccessError) return shopAccessError;

    // ── Validate filename (no double-extension spoofing) ─────────────────────
    if (hasDangerousName(file.name)) {
      return NextResponse.json(
        { success: false, message: 'Filename looks suspicious (multiple extensions). Upload refused.' },
        { status: 400 },
      );
    }

    // ── Validate MIME type (images only) ──────────────────────────────────────
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Only image files (JPG, PNG, WEBP, GIF, HEIC) are allowed.' },
        { status: 400 },
      );
    }

    // ── Validate file size (2 MB max) ─────────────────────────────────────────
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, message: 'File too large. Maximum 2 MB allowed.' }, { status: 400 });
    }

    // ── Read buffer & verify magic bytes ──────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isRealImage = await verifyImageMagicBytes(buffer);
    if (!isRealImage) {
      return NextResponse.json(
        { success: false, message: 'File content does not match an image. Upload refused.' },
        { status: 400 },
      );
    }

    // Generate B2 key and upload
    const fileKey = generateB2Key(shopId, file.name);
    const { fileUrl } = await uploadToB2(buffer, fileKey, file.type);

    // Save record to DB
    const document = await prisma.saleDocument.create({
      data: {
        shopId: BigInt(shopId),
        uploadedBy: ctx.userId,
        fileName: fileKey.split('/').pop()!,
        originalName: file.name,
        fileUrl,
        fileKey,
        fileSize: file.size,
        mimeType: file.type,
        documentDate: new Date(docDateRaw),
        description: description || null,
        isActive: true,
      },
      select: {
        id: true,
        originalName: true,
        fileUrl: true,
        fileKey: true,
        fileSize: true,
        mimeType: true,
        documentDate: true,
        description: true,
        createdAt: true,
        uploader: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ success: true, data: { document } }, { status: 201 });
  } catch (error) {
    console.error('[sale-documents POST]', error);
    return NextResponse.json({ success: false, message: 'Failed to upload document' }, { status: 500 });
  }
}

// ─── DELETE — remove document ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const roleError = checkRole(ctx.role);
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ success: false, message: 'Document ID is required' }, { status: 400 });
    }

    // Fetch document to verify ownership/access
    const doc = await prisma.saleDocument.findUnique({
      where: { id: BigInt(documentId) },
      select: { id: true, shopId: true, fileKey: true, isActive: true },
    });

    if (!doc || !doc.isActive) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Shop access check
    const shopAccessError = assertShopAccess(ctx, doc.shopId);
    if (shopAccessError) return shopAccessError;

    // Soft-delete from DB first
    await prisma.saleDocument.update({
      where: { id: BigInt(documentId) },
      data: { isActive: false },
    });

    // Delete from B2 (non-blocking, best-effort)
    deleteFromB2(doc.fileKey).catch((err) => {
      console.error('[sale-documents DELETE] B2 delete failed:', err);
    });

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('[sale-documents DELETE]', error);
    return NextResponse.json({ success: false, message: 'Failed to delete document' }, { status: 500 });
  }
}
