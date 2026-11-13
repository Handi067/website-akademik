import { RequestHandler } from 'express';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Endpoint tulis yang tidak perlu diaudit (login/refresh berisi kredensial, webhook dari pihak luar). */
const SKIP = [/^\/auth\/(login|refresh|logout)/, /^\/payment\/webhook/, /^\/notifikasi\//];
const SENSITIVE = /pass(word)?|token|secret/i;

/** Hapus nilai sensitif sebelum disimpan ke log. */
const redact = (v: unknown, depth = 0): unknown => {
  if (depth > 4 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.slice(0, 100).map((x) => redact(x, depth + 1));
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : redact(x, depth + 1)])
  );
};

const AKSI: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };

/**
 * Mencatat setiap request tulis yang BERHASIL (status < 400) ke tabel audit_log:
 * pengguna, aksi, modul (segmen path pertama), ID record (segmen kedua),
 * body tanpa data sensitif, IP, dan user agent.
 * Dipasang di router /api sehingga `req.path` relatif terhadap /api.
 */
export const auditLog: RequestHandler = (req, res, next) => {
  const path = req.path;
  if (!WRITE.has(req.method) || SKIP.some((r) => r.test(path))) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const [tabel = 'root', recordId] = path.split('/').filter(Boolean);
    prisma.auditLog
      .create({
        data: {
          userId: req.user?.id ?? null,
          aksi: `${AKSI[req.method]} ${path}`.slice(0, 50),
          tabel: tabel.slice(0, 50),
          recordId: recordId?.slice(0, 50) ?? null,
          dataBaru: req.body && Object.keys(req.body).length ? (redact(req.body) as object) : undefined,
          ipAddress: req.ip?.replace(/^::ffff:/, '') || null,
          userAgent: req.get('user-agent') ?? null,
        },
      })
      .catch((error) => logger.error('Gagal menulis audit log:', error));
  });
  next();
};
