/**
 * The MalTrace teardown's inputs (ADR-0016): two real artifacts extracted from the CAPE analysis and the SHAP run.
 *   src/content/work/maltrace/maltrace-teardown.json   file hashes and size, PE sections, API calls, processes, signatures, ATT&CK
 *   src/content/work/maltrace/shap_wannacry_exe.json   confidence, probability, SHAP base value, per-feature contributions
 * Both are validated here, then cross-checked against each other, against maltrace.mdx and against claims.yaml.
 * A malformed file or a disagreement fails the build (scripts/verify-teardown.ts, in prebuild). Nothing is filled in:
 * every field except the identity ones is optional, and a missing one simply hides its layer in the teardown.
 */
import { z } from 'astro/zod';

const hex = (n: number) => z.string().regex(new RegExp(`^[a-fA-F0-9]{${n}}$`));
const hexSize = z.string().regex(/^0x[0-9a-fA-F]+$/).transform((s) => parseInt(s, 16));
const decimal = z.string().regex(/^\d+(\.\d+)?$/).transform(Number);

export const teardownSchema = z.object({
  analysis_id: z.number().int(),
  file: z.object({
    name: z.string().min(1),
    size: z.number().int().positive(),
    sha256: hex(64),
    sha1: hex(40).optional(),
    md5: hex(32).optional(),
    type: z.string().optional(),
  }),
  // raw_offset and virtual_address are optional: the CAPE extract does not carry them yet, and nothing is derived in their place
  sections: z.array(z.object({ name: z.string().min(1), size: hexSize, virtual_size: hexSize.optional(), raw_offset: hexSize.optional(), virtual_address: hexSize.optional(), entropy: decimal })).min(1).optional(),
  api_total: z.number().int().nonnegative().optional(),
  api_top: z.array(z.object({ api: z.string().min(1), count: z.number().int().nonnegative() })).min(1).optional(),
  process_count: z.number().int().nonnegative().optional(),
  attack_ids: z.array(z.string().regex(/^T\d{4}(\.\d{3})?$/)).optional(),
  signatures: z.array(z.object({ name: z.string().min(1), severity: z.number().int() })).optional(),
});
export type Teardown = z.infer<typeof teardownSchema>;

const indicator = z.object({ feature: z.string().min(1), value: z.number(), shap_impact: z.number(), direction: z.enum(['malware', 'benign']) });
export const shapSchema = z.object({
  sample: z.string().min(1),
  verdict: z.string().optional(),
  confidence: z.number(),
  malware_probability: z.number().optional(),
  shap_base_value: z.number().optional(),
  top_malware_indicators: z.array(indicator).optional(),
  top_benign_indicators: z.array(indicator).optional(),
});
export type Shap = z.infer<typeof shapSchema>;

/** What the owner verified by hand about the sample. The confidence is deliberately NOT here: the ledger is its only source. */
export const EXPECT = { analysisId: 15, sampleName: 'wannacry.exe' } as const;

export interface CheckInput {
  teardown: Teardown;
  shap: Shap;
  /** maltrace.mdx `sample` */
  sample?: { file: string; sha256: string; sha1: string; md5: string; sizeBytes: number };
  /** claims.yaml values by id */
  claims: Record<string, number | undefined>;
  /** claims.yaml `display` of maltrace-confidence: the one string the verdict shows */
  confidenceDisplay?: string;
  /** maltrace-features.json `static`: the eight static PE feature names the README lists */
  staticFeatures?: string[];
}

/** Every disagreement, as a readable line. Empty means the teardown may ship. */
export function teardownProblems({ teardown: t, shap: s, sample, claims, staticFeatures, confidenceDisplay }: CheckInput): string[] {
  const p: string[] = [];
  if (t.analysis_id !== EXPECT.analysisId) p.push(`analysis_id is ${t.analysis_id}, expected ${EXPECT.analysisId}`);

  const apiClaim = claims['maltrace-api-calls'];
  if (t.api_total !== undefined) {
    if (apiClaim === undefined) p.push('claim maltrace-api-calls is missing');
    else if (t.api_total !== apiClaim) p.push(`api_total ${t.api_total} != claim maltrace-api-calls ${apiClaim}`);
  }
  if (t.api_top && t.api_total !== undefined) {
    const top = t.api_top.reduce((n, a) => n + a.count, 0);
    if (top > t.api_total) p.push(`top API counts sum to ${top}, more than api_total ${t.api_total}`);
  }

  if (!sample) p.push('maltrace.mdx has no sample block');
  else {
    if (t.file.sha256.toLowerCase() !== sample.sha256.toLowerCase()) p.push(`teardown file sha256 != maltrace.mdx sample.sha256`);
    if (t.file.name !== sample.file) p.push(`teardown file name ${t.file.name} != sample.file ${sample.file}`);
    if (t.file.size !== sample.sizeBytes) p.push(`teardown file size ${t.file.size} != sample.sizeBytes ${sample.sizeBytes}`);
    if (t.file.sha1 && t.file.sha1.toLowerCase() !== sample.sha1.toLowerCase()) p.push('teardown file sha1 != sample.sha1');
    if (t.file.md5 && t.file.md5.toLowerCase() !== sample.md5.toLowerCase()) p.push('teardown file md5 != sample.md5');
  }

  if (s.sample !== EXPECT.sampleName) p.push(`SHAP sample is ${s.sample}, expected ${EXPECT.sampleName}`);
  // One prediction, one number: the verdict shown on the page is the ledger's maltrace-confidence, and the SHAP bars it
  // explains come from the same artifact, so the claim, its display and the SHAP file must all say the same thing.
  const confClaim = claims['maltrace-confidence'];
  if (confClaim === undefined) p.push('claim maltrace-confidence is missing');
  else if (confClaim !== s.confidence) p.push(`SHAP confidence ${s.confidence} != claim maltrace-confidence ${confClaim}`);
  if (confidenceDisplay !== undefined && confidenceDisplay !== `${s.confidence}%`) p.push(`claim display "${confidenceDisplay}" != SHAP confidence ${s.confidence}%`);
  if (s.malware_probability !== undefined && s.malware_probability !== s.confidence) p.push(`SHAP malware_probability ${s.malware_probability} != confidence ${s.confidence}`);
  if (t.file.name !== s.sample) p.push(`teardown file ${t.file.name} != SHAP sample ${s.sample}`);

  // 54 engineered features = 46 dynamic behavioural + 8 static PE (README lines 187 and 201), from the ledger.
  const total = claims['maltrace-features'], dyn = claims['maltrace-features-dynamic'], stat = claims['maltrace-features-static'];
  if (total === undefined || dyn === undefined || stat === undefined) p.push('claims maltrace-features / -dynamic / -static are required for the feature grid');
  else if (dyn + stat !== total) p.push(`dynamic ${dyn} + static ${stat} != total ${total}`);
  if (staticFeatures && stat !== undefined && staticFeatures.length !== stat) p.push(`${staticFeatures.length} static feature names listed, claim says ${stat}`);
  return p;
}
