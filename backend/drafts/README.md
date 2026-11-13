# Draft services (not compiled)

These services were written against `prisma/schema-extended.prisma`, which is **not**
the active schema (`prisma/schema.prisma`). They reference models and fields that do
not exist in the active schema (e.g. `kurikulum`, `pembayaranUKT`, `earlyWarning`,
`bimbingan`, `digitalSignature`, `kodeMk` vs `kodeMK`), so they were moved out of
`src/` to let the backend build.

`krs.service.ts` and `matakuliah.service.ts` have been reimplemented in `src/services/`
against the active schema. The rest (bimbingan, digital signature, early warning,
kurikulum, pembayaran UKT) can be ported once their models are added to
`schema.prisma`. Note that `pembayaran-ukt` overlaps with the existing
`Tagihan`/`Pembayaran` models and payment routes.
