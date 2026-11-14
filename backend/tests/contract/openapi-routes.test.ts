import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

jest.mock('@/config/database', () => ({ prisma: require('../helpers/prisma-mock').prismaMock }));

import router from '@/routes/index';

/**
 * Menjaga dokumentasi tetap sinkron: setiap route Express harus ada di spec OpenAPI,
 * dan spec tidak boleh mendokumentasikan endpoint yang tidak ada.
 */
const SPEC = path.resolve(__dirname, '../../../postman/specs/website-akademik-api.yaml');

const prefixOf = (re: RegExp) => {
  const m = re.source.match(/^\^\\\/(.+?)\\\/\?\(\?=/);
  return m ? '/' + m[1].split('\\/').join('/') : '';
};

const expressRoutes = () => {
  const out = new Set<string>();
  const walk = (stack: any[], prefix: string) => {
    for (const l of stack) {
      if (l.route) {
        for (const m of Object.keys(l.route.methods)) out.add(`${m.toUpperCase()} ${(prefix + l.route.path).replace(/\/$/, '') || '/'}`);
      } else if (l.handle?.stack) {
        walk(l.handle.stack, prefix + prefixOf(l.regexp));
      }
    }
  };
  walk((router as any).stack, '');
  return out;
};

const specRoutes = () => {
  const spec = YAML.parse(fs.readFileSync(SPEC, 'utf8'));
  const out = new Set<string>();
  for (const [p, ops] of Object.entries(spec.paths as Record<string, Record<string, unknown>>)) {
    for (const m of Object.keys(ops)) if (m !== 'parameters') out.add(`${m.toUpperCase()} ${p.replace(/\{(\w+)\}/g, ':$1')}`);
  }
  return out;
};

describe('OpenAPI spec ↔ route Express', () => {
  const real = expressRoutes();
  const doc = specRoutes();

  it('menemukan route (sanity check parser)', () => {
    expect(real.size).toBeGreaterThan(50);
    expect(real.has('POST /krs')).toBe(true);
  });

  it('setiap route terdokumentasi', () => {
    expect([...real].filter((r) => !doc.has(r))).toEqual([]);
  });

  it('spec tidak memuat endpoint yang tidak ada', () => {
    expect([...doc].filter((r) => !real.has(r))).toEqual([]);
  });
});
