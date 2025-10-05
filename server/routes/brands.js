const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret';  // Dari .env server

// Middleware auth: Verifikasi JWT dari header (semua di dalam fungsi)
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Login ulang.' });
  }

  const token = authHeader.split(' ')[1];  // Define token di sini
  try {
    console.log('Verifying token:', token.substring(0, 20) + '...');  // Debug (hilangkan nanti)
    // Decode dan verifikasi JWT dengan secret NextAuth
    const decoded = jwt.verify(token, NEXTAUTH_SECRET);
    console.log('Decoded token:', decoded);  // Debug log
    if (!decoded.role || decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Akses ditolak: Role bukan admin' });
    }
    req.user = decoded;  // Attach decoded user ke req
    next();
  } catch (error) {
    console.error('JWT verify error:', error);
    res.status(401).json({ error: 'Token invalid atau expired. Login ulang.' });
  }
};
//router.use(authMiddleware);

// Schema validasi Zod
const brandSchema = z.object({
  name: z.string().min(1, 'Nama brand wajib diisi').max(100),
  description: z.string().optional(),
  status: z.boolean().default(true)
});

// GET /api/admin/brands - List brands (Read)
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = search ? { name: { contains: search, mode: 'insensitive' } } : {};
    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { _count: { select: { products: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.brand.count({ where })
    ]);
    res.json({ brands, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('GET brands error:', error);
    res.status(500).json({ error: 'Gagal mengambil data brand' });
  }
});

// POST /api/admin/brands - Tambah brand (Create)
router.post('/', async (req, res) => {
  try {
    const validated = brandSchema.parse(req.body);
    const brand = await prisma.brand.create({ data: validated });
    res.status(201).json(brand);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Nama brand sudah ada' });
    } else {
      console.error('POST brands error:', error);
      res.status(500).json({ error: 'Gagal menambah brand' });
    }
  }
});

// PUT /api/admin/brands/:id - Edit brand (Update)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validated = brandSchema.partial().parse(req.body);
    const brand = await prisma.brand.update({
      where: { id: parseInt(id) },
      data: validated
    });
    res.json(brand);
  } catch (error) {
    console.error('PUT brands error:', error);
    res.status(500).json({ error: 'Gagal update brand' });
  }
});

// DELETE /api/admin/brands/:id - Hapus brand (Delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const related = await prisma.product.count({ where: { brandId: parseInt(id) } });
    if (related > 0) {
      return res.status(400).json({ error: 'Brand masih digunakan di produk' });
    }
    await prisma.brand.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Brand dihapus' });
  } catch (error) {
    console.error('DELETE brands error:', error);
    res.status(500).json({ error: 'Gagal menghapus brand' });
  }
});

module.exports = router;