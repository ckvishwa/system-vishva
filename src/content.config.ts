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
    evidence: z.union([z.url(), z.string().regex(/^\/(?!\/)/)]).nullable(),  // null needs evidenceKind on-request, else unverified → fails --strict gate
    evidenceKind: z.enum(['public', 'self-hosted', 'on-request']).optional(), // ADR-0015; on-request = no public artifact
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
    // Scroll story (docs/storyboards/<slug>.md): pipeline groups, 1-based as printed on the diagram.
    // Nodes after the last group are lit by that group. `proposal` marks nodes whose output is only a proposal.
    story: z.array(z.object({
      nodes: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
      proposal: z.array(z.number().int().min(1)).default([]),
    })).optional(),
    signature: z.enum(['waveform', 'hash', 'stream', 'stamp']), // ARD §7 idea 4
    sampleHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(), // real SHA-256 of the analysed sample; powers the "hash" signature
    demo: z.enum(['release-gate']).optional(), // an interactive island shown under the story
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

