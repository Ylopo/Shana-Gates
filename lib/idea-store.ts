/**
 * lib/idea-store.ts
 *
 * Redis store for IdeaCandidate objects.
 * The review page and digest email read from here.
 *
 * Redis keys (prefix sgs:):
 *   sgs:idea:{id}              — JSON blob, 14-day TTL
 *   sgs:ideas:queue            — sorted set: score → id (pending ideas only)
 *   sgs:ideas:breaking         — list of breaking idea IDs (48h TTL each)
 *   sgs:covered:topics         — set of slugified topic strings (no TTL)
 */

import { Redis } from '@upstash/redis'
import type { IdeaCandidate, IdeaStatus } from './types'

const IDEA_TTL    = 14 * 24 * 60 * 60  // 14 days
const BREAKING_TTL = 48 * 60 * 60      // 48 hours
const QUEUE_KEY    = 'sgs:ideas:queue'
const BREAKING_KEY = 'sgs:ideas:breaking'
const COVERED_KEY  = 'sgs:covered:topics'

function getRedis(): Redis {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
  return new Redis({ url, token })
}

function ideaKey(id: string) { return `sgs:idea:${id}` }

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveIdea(idea: IdeaCandidate): Promise<void> {
  const redis = getRedis()

  await redis.set(ideaKey(idea.id), JSON.stringify(idea), { ex: IDEA_TTL })

  if (idea.status === 'pending') {
    await redis.zadd(QUEUE_KEY, { score: idea.score.total, member: idea.id })
  }

  if (idea.urgency === 'breaking') {
    await redis.set(`sgs:idea:breaking:${idea.id}`, idea.id, { ex: BREAKING_TTL })
    await redis.lpush(BREAKING_KEY, idea.id)
    await redis.expire(BREAKING_KEY, BREAKING_TTL)
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getIdea(id: string): Promise<IdeaCandidate | null> {
  const redis = getRedis()
  const raw = await redis.get<string>(ideaKey(id))
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

// Batch-read every idea key in the queue using Upstash's MGET so we make ~1
// Redis round-trip instead of N sequential GETs. The previous serial loop
// hit Vercel's function timeout once the queue grew past ~600 entries,
// silently breaking the Idea Review page for the VA.
async function batchFetchIdeas(ids: string[]): Promise<Map<string, IdeaCandidate | null>> {
  const out = new Map<string, IdeaCandidate | null>()
  if (ids.length === 0) return out
  const redis = getRedis()
  const BATCH = 200   // Upstash MGET caps at ~1000 args; 200 keeps payloads small
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const keys = chunk.map(ideaKey)
    const values = await redis.mget<(string | IdeaCandidate | null)[]>(...keys)
    for (let j = 0; j < chunk.length; j++) {
      const raw = values[j]
      if (!raw) { out.set(chunk[j], null); continue }
      try {
        const idea = typeof raw === 'string' ? JSON.parse(raw) as IdeaCandidate : raw as IdeaCandidate
        out.set(chunk[j], idea)
      } catch {
        out.set(chunk[j], null)
      }
    }
  }
  return out
}

export async function getPendingIdeas(): Promise<IdeaCandidate[]> {
  const redis = getRedis()
  const ids = await redis.zrange<string[]>(QUEUE_KEY, 0, -1, { rev: true })
  if (!ids || ids.length === 0) return []

  const fetched = await batchFetchIdeas(ids)
  const ideas: IdeaCandidate[] = []
  const expired: string[] = []

  for (const id of ids) {
    const idea = fetched.get(id)
    if (!idea) { expired.push(id); continue }
    if (idea.status === 'pending') ideas.push(idea)
    else expired.push(id)
  }

  if (expired.length > 0) {
    // ZREM accepts a variadic list of members. Chunk so we never send a
    // single command larger than Upstash will accept.
    const BATCH = 200
    for (let i = 0; i < expired.length; i += BATCH) {
      await redis.zrem(QUEUE_KEY, ...expired.slice(i, i + BATCH))
    }
  }

  return ideas
}

export async function getAllIdeas(): Promise<IdeaCandidate[]> {
  const redis = getRedis()
  const ids = await redis.zrange<string[]>(QUEUE_KEY, 0, -1, { rev: true })
  if (!ids || ids.length === 0) return []

  const fetched = await batchFetchIdeas(ids)
  const ideas: IdeaCandidate[] = []
  for (const id of ids) {
    const idea = fetched.get(id)
    if (idea) ideas.push(idea)
  }
  return ideas
}

export async function getBreakingIdeas(): Promise<IdeaCandidate[]> {
  const redis = getRedis()
  const ids = await redis.lrange<string>(BREAKING_KEY, 0, -1)
  if (!ids || ids.length === 0) return []

  const ideas: IdeaCandidate[] = []
  for (const id of ids) {
    const idea = await getIdea(id)
    if (idea && idea.urgency === 'breaking') ideas.push(idea)
  }
  return ideas
}

// ─── Update status ────────────────────────────────────────────────────────────

export async function updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
  const redis = getRedis()
  const idea = await getIdea(id)
  if (!idea) return

  const updated: IdeaCandidate = { ...idea, status, reviewedAt: new Date().toISOString() }
  await redis.set(ideaKey(id), JSON.stringify(updated), { ex: IDEA_TTL })

  if (status !== 'pending') {
    await redis.zrem(QUEUE_KEY, id)
  }
}

// ─── Covered topics (novelty tracking) ───────────────────────────────────────

export async function addCoveredTopic(topic: string): Promise<void> {
  const redis = getRedis()
  await redis.sadd(COVERED_KEY, topic.toLowerCase().trim())
}

export async function getCoveredTopics(): Promise<Set<string>> {
  const redis = getRedis()
  const topics = await redis.smembers<string[]>(COVERED_KEY)
  return new Set(topics ?? [])
}

// ─── Week ID helper ───────────────────────────────────────────────────────────

export function buildWeekId(date?: Date): string {
  const d = date ?? new Date()
  return d.toISOString().slice(0, 10)
}

// ─── Performance weights ──────────────────────────────────────────────────────

const PERFORMANCE_WEIGHTS_KEY = 'sgs:strategy:performance-weights'
const PERFORMANCE_WEIGHTS_TTL = 90 * 24 * 60 * 60 // 90 days

export type CategoryBreakdownEntry = {
  category: string
  avgPageViews: number
  postsAnalyzed: number
  weightMultiplier: number
}

export type PerformanceWeights = {
  updatedAt: string
  weights: Record<string, number>
  insights: string
  topPosts: { title: string; category: string; pageViews: number; slug: string }[]
  nextPeriodFocus: string[]
  categoryBreakdown: CategoryBreakdownEntry[]
}

export async function getPerformanceWeights(): Promise<PerformanceWeights | null> {
  const redis = getRedis()
  const raw = await redis.get<string>(PERFORMANCE_WEIGHTS_KEY)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function setPerformanceWeights(weights: PerformanceWeights): Promise<void> {
  const redis = getRedis()
  await redis.set(PERFORMANCE_WEIGHTS_KEY, JSON.stringify(weights), { ex: PERFORMANCE_WEIGHTS_TTL })
}
