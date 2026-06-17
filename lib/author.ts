/**
 * lib/author.ts
 *
 * Single source-of-truth for the author / brand identity used in blog
 * post bylines, "About the Author" bio blocks, and schema.org Person
 * markup. Keeping it here means a per-client fork only edits this file
 * to swap the brand voice.
 *
 * Per Google's AI Optimization Guide, surfacing the author with name +
 * bio + sameAs social links is the single biggest E-E-A-T signal a
 * blog can give. AI assistants cite content from named experts more
 * readily than anonymous content.
 */

export interface AuthorIdentity {
  name: string
  title: string              // displayed inline with the byline, e.g. "REALTOR®"
  brokerage: string
  market: string
  headshotUrl: string        // absolute or root-relative
  bioShort: string           // 1 sentence, used in compact byline contexts
  bioLong: string            // 2-3 paragraphs for the page-bottom "About the Author" block
  contactEmail: string
  contactPhone?: string
  // sameAs URLs are surfaced in the JSON-LD Person entity so search /
  // AI systems can connect this author to their social presence.
  sameAs: string[]
  // For the JSON-LD Person.url field.
  profileUrl: string
}

export const AUTHOR: AuthorIdentity = {
  name: 'Shana Gates',
  title: 'REALTOR®',
  brokerage: 'Craft & Bauer | Real Broker',
  market: 'Coachella Valley, CA',
  headshotUrl: '/images/shana%20pro.JPG',
  bioShort: 'Coachella Valley REALTOR® at Craft & Bauer specializing in Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, and La Quinta.',
  bioLong: [
    "Shana Gates is a Coachella Valley REALTOR® with Craft & Bauer | Real Broker, helping buyers, sellers, and investors navigate Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, and the surrounding desert communities. She specializes in luxury second homes, mid-century modern architecture, and short-term-rental investment strategy — combining local market expertise with a homeowner-first perspective on every post she writes.",
    "When she isn't showing homes, Shana is documenting the people, places, and history that make the Coachella Valley unique — from the architectural legacy of Frank Sinatra's Twin Palms to the 21st-century developments reshaping the valley's skyline. She publishes new market analysis, neighborhood guides, and local stories every week.",
  ].join('\n\n'),
  contactEmail: 'shana@craftbauer.com',
  sameAs: [
    'https://www.tiktok.com/@shanagatesrealtor',
    'https://www.facebook.com/shanagatesrealtor/reels/',
    'https://www.youtube.com/@shanagatesrealtor',
  ],
  // Canonical author profile page — the homepage is the closest thing
  // to a Shana-specific landing page today.
  profileUrl: 'https://www.shanasells.com/',
}

export const PUBLISHER = {
  name: 'Shana Gates · Craft & Bauer | Real Broker',
  url: 'https://www.shanasells.com',
  logo: 'https://www.shanasells.com/images/favcon.png',
}
