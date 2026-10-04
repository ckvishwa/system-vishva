import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/** ARD D-10 — every number on the site lives here, with its evidence. */
const claims = defineCollection({
  loader: file('src/content/claims/claims.yaml'),
  schema: z.object({
    label: z.string(),
    value: z.number(),
    display: z.string(),           // how it reads on the page, e.g. "323+"
    project: z.string(),
    evidence: z.url().nullable(),  // null = unverified → fails --strict gate
    evidenceNote: z.string().optional(),
    measuredOn: z.string().optional(), // ISO date the number was last measured
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: 'src/content/work' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    thesis: z.string(),              // the one-line headline
    category: z.string(),            // "Voice AI ordering infrastructure"
    stack: z.array(z.string()),
    pipeline: z.array(z.string()).min(2), // nodes for the hover architecture + ArchDiagram
    claimIds: z.array(z.string()).default([]),
    signature: z.enum(['waveform', 'hash', 'stream', 'stamp']), // ARD §7 idea 4
    repo: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

const lab = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/lab' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: z.enum(['active', 'complete', 'paused', 'research']),
    stage: z.string(),
    stack: z.array(z.string()),
    lastTouched: z.coerce.date(),    // ARD L-11: auto-shows DORMANT after 90 days
  }),
});

export const collections = { claims, work, lab };
