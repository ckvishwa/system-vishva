import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { teardownSchema, shapSchema, teardownProblems, type CheckInput } from '../../src/content/teardown';

const dir = 'src/content/work/maltrace';
const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
const claimsList = parse(readFileSync('src/content/claims/claims.yaml', 'utf8')) as { id: string; value: number }[];
const claims = Object.fromEntries(claimsList.map((c) => [c.id, c.value]));
const confidenceDisplay = (claimsList as { id: string; display: string }[]).find((c) => c.id === 'maltrace-confidence')!.display;
const mdx = readFileSync('src/content/work/maltrace.mdx', 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)!;
const sample = (parse(mdx[1]) as any).sample;
const staticFeatures = read('maltrace-features.json').static as string[];

const good = (): CheckInput => ({ teardown: teardownSchema.parse(read('maltrace-teardown.json')), shap: shapSchema.parse(read('shap_wannacry_exe.json')), sample, claims, staticFeatures, confidenceDisplay });

describe('the real artifacts', () => {
  it('parse, and pass every cross-check', () => expect(teardownProblems(good())).toEqual([]));
  it('carry the verified values', () => {
    const { teardown: t, shap: s } = good();
    expect([t.analysis_id, t.api_total, t.process_count]).toEqual([15, 94958, 17]);
    expect([s.sample, s.confidence, s.malware_probability]).toEqual(['wannacry.exe', claims['maltrace-confidence'], claims['maltrace-confidence']]);
    expect(t.file.sha256).toBe(sample.sha256);
  });
  it('parse section sizes from hex and entropy from text', () => {
    const { teardown: t } = good();
    expect(t.sections!.map((x) => [x.name, x.size, x.entropy])).toEqual([['.text', 28672, 6.4], ['.rdata', 24576, 6.66], ['.data', 8192, 4.46], ['.rsrc', 3448832, 8]]);
  });
  it('the feature split is 46 dynamic + 8 static = 54', () => {
    expect([claims['maltrace-features-dynamic'], claims['maltrace-features-static'], claims['maltrace-features']]).toEqual([46, 8, 54]);
    expect(staticFeatures).toHaveLength(8);
  });
});

describe('integrity checks fail on each disagreement', () => {
  const bad = (mut: (i: CheckInput) => void) => { const i = good(); mut(i); return teardownProblems(i); };
  it('analysis_id != 15', () => expect(bad((i) => { i.teardown.analysis_id = 14; })[0]).toMatch(/analysis_id is 14/));
  it('api_total != the ledger claim', () => expect(bad((i) => { i.teardown.api_total = 94957; })[0]).toMatch(/api_total 94957 != claim/));
  it('teardown sha256 != maltrace.mdx sample.sha256', () => expect(bad((i) => { i.teardown.file.sha256 = 'a'.repeat(64); }).join()).toMatch(/sha256 != maltrace.mdx/));
  it('SHAP sample != wannacry.exe', () => expect(bad((i) => { i.shap.sample = 'other.exe'; }).join()).toMatch(/SHAP sample is other.exe/));
  it('SHAP confidence != the ledger claim (one prediction, one number)', () => {
    expect(bad((i) => { i.shap.confidence = 94.2; }).join()).toMatch(/SHAP confidence 94.2 != claim maltrace-confidence 95/);
    expect(bad((i) => { i.claims = { ...i.claims, 'maltrace-confidence': 94.2 }; }).join()).toMatch(/SHAP confidence 95 != claim maltrace-confidence 94.2/);
  });
  it('the claim display must be exactly the SHAP confidence', () => {
    expect(bad((i) => { i.confidenceDisplay = '94.2%'; }).join()).toMatch(/claim display "94.2%" != SHAP confidence 95%/);
    expect(bad((i) => { i.confidenceDisplay = '95.0%'; }).join()).toMatch(/claim display "95.0%"/);
  });
  it('a missing confidence claim fails', () => expect(bad((i) => { i.claims = { ...i.claims, 'maltrace-confidence': undefined }; }).join()).toMatch(/maltrace-confidence is missing/));
  it('the verdict has no second source: no confidence literal in the teardown code', () => {
    for (const f of ['src/content/teardown.ts', 'src/components/case/Teardown.astro', 'src/engine/motion/teardown.ts'])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\b95(\.0)?\b|94\.2/);
  });
  it('file size and name must match the sample block', () => {
    expect(bad((i) => { i.teardown.file.size = 1; }).join()).toMatch(/file size/);
    expect(bad((i) => { i.teardown.file.name = 'x.exe'; }).join()).toMatch(/file name/);
  });
  it('a missing sample block, or a feature split that does not add up, fails', () => {
    expect(bad((i) => { i.sample = undefined; }).join()).toMatch(/no sample block/);
    expect(bad((i) => { i.claims = { ...i.claims, 'maltrace-features-static': 9 }; }).join()).toMatch(/!= total 54/);
  });
  it('top API counts cannot exceed the total', () => expect(bad((i) => { i.teardown.api_top![0].count = 999999; }).join()).toMatch(/more than api_total/));
});

describe('schemas', () => {
  const raw = () => read('maltrace-teardown.json');
  it('reject malformed values', () => {
    expect(teardownSchema.safeParse({ ...raw(), analysis_id: '15' }).success).toBe(false);
    expect(teardownSchema.safeParse({ ...raw(), file: { ...raw().file, sha256: 'xyz' } }).success).toBe(false);
    expect(teardownSchema.safeParse({ ...raw(), sections: [{ name: '.text', size: '28672', entropy: '6.4' }] }).success).toBe(false);
    expect(teardownSchema.safeParse({ ...raw(), attack_ids: ['27'] }).success).toBe(false);
    expect(teardownSchema.safeParse({ ...raw(), api_top: [{ api: 'X', count: -1 }] }).success).toBe(false);
    expect(shapSchema.safeParse({ ...read('shap_wannacry_exe.json'), confidence: '95' }).success).toBe(false);
  });
  it('accept a file with optional layers missing (their layers hide)', () => {
    const { analysis_id, file } = raw();
    const r = teardownSchema.safeParse({ analysis_id, file });
    expect(r.success).toBe(true);
  });
  it('require the identity fields', () => {
    const { file } = raw();
    expect(teardownSchema.safeParse({ file }).success).toBe(false);
  });
});
