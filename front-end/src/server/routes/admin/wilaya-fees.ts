import { Hono } from "hono";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { BadRequestError, ValidationError } from "../../http/errors";
import { body } from "../../http/validate";

/**
 * Bulk delivery-fee editing.
 *
 * The spreadsheet round trip is CSV rather than .xlsx: the xlsx writers all
 * depend on Node streams a Worker cannot run, and the file is six flat
 * columns with no formatting worth keeping. Excel and LibreOffice open
 * the CSV directly — the export leads with a UTF-8 BOM and uses `;` so Excel in
 * a French locale parses the columns without an import wizard.
 */

/** CSV columns (0-based) used by both export and import. */
const COLS = {
  wilayaCode: 0,
  wilayaName: 1,
  wilayaFee: 2,
  communeId: 3,
  communeName: 4,
  communeFee: 5,
} as const;

const HEADERS = [
  "Code wilaya",
  "Wilaya",
  "Tarif wilaya (DA)",
  "ID commune",
  "Commune",
  "Tarif commune (DA)",
];

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const wilayaFeeSchema = z.object({
  code: z.coerce.number().int().min(1),
  /** Default COD delivery fee for the wilaya (DA). */
  fee: z.coerce.number().int().min(0),
});

const communeFeeSchema = z.object({
  id: z.coerce.number().int().min(1),
  /** COD fee for the commune (DA). `null` → inherit the wilaya fee. */
  fee: z.union([
    z.coerce.number().int("Tarif invalide.").min(0, "Tarif invalide."),
    z.null(),
  ]),
});

const wilayaBatchSchema = z.array(wilayaFeeSchema);
const communeBatchSchema = z.array(communeFeeSchema);

function list(prisma: PrismaClient) {
  return prisma.wilaya.findMany({
    include: { communes: { orderBy: { name: "asc" } } },
    orderBy: { code: "asc" },
  });
}

/** An empty batch is a client bug, not a no-op worth a round trip. */
function assertNotEmpty(items: unknown[]): void {
  if (items.length === 0) throw new BadRequestError("Aucun tarif à enregistrer.");
}

/** Reject the whole batch, naming the first offending row like the DTO layer. */
function assertAllKnown<T>(
  items: T[],
  isKnown: (item: T) => boolean,
  field: string,
  message: string,
): void {
  const index = items.findIndex((i) => !isKnown(i));
  if (index !== -1) {
    throw new ValidationError({ [`items[${index}].${field}`]: message });
  }
}

/** Quote a CSV field only when it needs it. */
function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Split one CSV line on `;` or `,`, honouring double-quoted fields. The
 * separator is detected per file, so an export re-saved by an English-locale
 * Excel (which switches to `,`) still imports.
 */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Sentinel for "cell holds something, but not a usable fee". */
const INVALID = Symbol("invalid");

/** Integer cell (id/code) or null when empty/unreadable. */
function cellInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s/g, "").replace(/ /g, ""));
  return Number.isInteger(n) ? n : null;
}

/** Fee cell: null when empty (= inherit), INVALID when not a positive int. */
function cellFee(raw: string | undefined): number | null | typeof INVALID {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw.replace(/\s/g, "").replace(/ /g, ""));
  return Number.isInteger(n) && n >= 0 ? n : INVALID;
}

export const adminWilayaFeeRoutes = new Hono<AppBindings>()
  .get("/", async (c) => c.json({ items: await list(c.var.prisma) }))

  /**
   * One row per commune: wilaya code/name/fee + commune id/name/fee. An empty
   * « Tarif commune » cell means the commune inherits the wilaya fee — the same
   * convention is applied when the file is re-imported.
   */
  .get("/export", async (c) => {
    const wilayas = await list(c.var.prisma);

    const lines = [HEADERS.join(";")];
    for (const w of wilayas) {
      for (const commune of w.communes) {
        lines.push(
          [
            csvCell(w.code),
            csvCell(w.name),
            csvCell(w.fee),
            csvCell(commune.id),
            csvCell(commune.name),
            csvCell(commune.fee),
          ].join(";"),
        );
      }
    }

    // The BOM is what makes Excel read the file as UTF-8 rather than the
    // system codepage, which would mangle every accent and Arabic name.
    const csv = `﻿${lines.join("\r\n")}\r\n`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tarifs-livraison.csv"',
      },
    });
  })

  .put("/", async (c) => {
    const items = await body(c, wilayaBatchSchema);
    assertNotEmpty(items);

    // Check first: a bad code inside the transaction would surface as a raw
    // Prisma error instead of the `{ errors: { field: message } }` contract.
    const known = new Set(
      (
        await c.var.prisma.wilaya.findMany({
          where: { code: { in: items.map((i) => i.code) } },
          select: { code: true },
        })
      ).map((w) => w.code),
    );
    assertAllKnown(items, (i) => known.has(i.code), "code", "Wilaya inconnue.");

    await c.var.prisma.$transaction(
      items.map((i) =>
        c.var.prisma.wilaya.update({ where: { code: i.code }, data: { fee: i.fee } }),
      ),
    );
    return c.json({ items: await list(c.var.prisma) });
  })

  .put("/communes", async (c) => {
    const items = await body(c, communeBatchSchema);
    assertNotEmpty(items);

    const known = new Set(
      (
        await c.var.prisma.commune.findMany({
          where: { id: { in: items.map((i) => i.id) } },
          select: { id: true },
        })
      ).map((commune) => commune.id),
    );
    assertAllKnown(items, (i) => known.has(i.id), "id", "Commune inconnue.");

    await c.var.prisma.$transaction(
      items.map((i) =>
        c.var.prisma.commune.update({ where: { id: i.id }, data: { fee: i.fee } }),
      ),
    );
    return c.json({ items: await list(c.var.prisma) });
  })

  /**
   * Re-import a (possibly edited) export. Per row: the commune fee is applied
   * to the commune (empty cell → null = inherit). The wilaya fee column repeats
   * on every row, so only rows whose value DIFFERS from the current wilaya fee
   * count as an edit (editing a single row works; if several rows of one wilaya
   * carry different edits, the last one wins). Unknown communes/wilayas and
   * unreadable fees are counted as skipped, never fatal.
   */
  .post("/import", async (c) => {
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      throw new BadRequestError("Formulaire multipart invalide.");
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new BadRequestError("Aucun fichier fourni.");
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new BadRequestError("Fichier trop volumineux. Taille maximale : 5 Mo.");
    }

    // Strip the BOM Excel writes back, or the first code becomes unparseable.
    const text = (await file.text()).replace(/^﻿/, "");
    const rows = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (rows.length < 2) {
      throw new BadRequestError(
        "Fichier illisible — exportez le modèle CSV puis modifiez-le.",
      );
    }

    // Detect the separator from the header row: Excel writes `,` in some
    // locales even when it opened a `;` file.
    const header = rows[0];
    const sep = header.split(";").length >= header.split(",").length ? ";" : ",";

    const [wilayas, communes] = await Promise.all([
      c.var.prisma.wilaya.findMany(),
      c.var.prisma.commune.findMany(),
    ]);
    const wilayaByCode = new Map(wilayas.map((w) => [w.code, w]));
    const communeById = new Map(communes.map((commune) => [commune.id, commune]));

    const wilayaFees = new Map<number, number>();
    const communeFees = new Map<number, number | null>();
    let skipped = 0;

    for (const line of rows.slice(1)) {
      const cells = splitCsvLine(line, sep);

      const communeId = cellInt(cells[COLS.communeId]);
      const communeFee = cellFee(cells[COLS.communeFee]);
      const wilayaCode = cellInt(cells[COLS.wilayaCode]);
      const wilayaFee = cellFee(cells[COLS.wilayaFee]);

      const communeOk =
        communeId !== null && communeById.has(communeId) && communeFee !== INVALID;
      const wilayaOk =
        wilayaCode !== null &&
        wilayaByCode.has(wilayaCode) &&
        wilayaFee !== INVALID &&
        wilayaFee !== null; // wilaya fee is the fallback → cannot be empty

      if (communeOk) communeFees.set(communeId, communeFee);
      // The wilaya fee repeats on every row — only a row that differs from the
      // current fee is an edit (so changing a single row is enough).
      if (wilayaOk && wilayaByCode.get(wilayaCode)!.fee !== wilayaFee) {
        wilayaFees.set(wilayaCode, wilayaFee);
      }
      if (!communeOk && !wilayaOk) skipped++;
    }

    if (wilayaFees.size === 0 && communeFees.size === 0) {
      throw new BadRequestError(
        "Aucune ligne exploitable — vérifiez les colonnes du fichier.",
      );
    }

    // Only write actual changes so an untouched export is a no-op.
    const wilayaUpdates = [...wilayaFees].filter(
      ([code, fee]) => wilayaByCode.get(code)!.fee !== fee,
    );
    const communeUpdates = [...communeFees].filter(
      ([id, fee]) => communeById.get(id)!.fee !== fee,
    );

    await c.var.prisma.$transaction([
      ...wilayaUpdates.map(([code, fee]) =>
        c.var.prisma.wilaya.update({ where: { code }, data: { fee } }),
      ),
      ...communeUpdates.map(([id, fee]) =>
        c.var.prisma.commune.update({ where: { id }, data: { fee } }),
      ),
    ]);

    return c.json({
      updatedWilayas: wilayaUpdates.length,
      updatedCommunes: communeUpdates.length,
      skipped,
      items: await list(c.var.prisma),
    });
  });
