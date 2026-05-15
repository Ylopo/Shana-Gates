/**
 * lib/history-seeds.ts
 *
 * Pre-curated Palm Springs celebrity & local history story ideas.
 * These are evergreen — they don't depend on Tavily finding recent news.
 * Each story is injected into the idea queue once per week so there are
 * always local-history options in the blog picker alongside daily research.
 *
 * Stories prioritise real estate angles: celebrity homes, estates for sale,
 * famous addresses, and neighbourhood history tied to a specific property.
 */

import type { IdeaCandidate } from './types'
import { saveIdea, getIdea, buildWeekId } from './idea-store'

interface SeedStory {
  slug: string
  title: string
  angle: string
  whyItMatters: string
  targetKeyword: string
  cityTarget: string
  researchData: string
}

const PALM_SPRINGS_STORIES: SeedStory[] = [
  {
    slug: 'sinatra-twin-palms-estate',
    title: "Inside Frank Sinatra's Palm Springs Estate — The House That Defined Rat Pack Glamour",
    angle: "Frank Sinatra built Twin Palms in 1947 as his personal desert hideaway. It had a piano-shaped pool, hosted legendary Rat Pack parties, and is where he proposed to Ava Gardner. Today it rents as a vacation property — one of the most storied addresses in Palm Springs real estate.",
    whyItMatters: "Twin Palms at 1148 E Alejo Rd is still standing and still the most glamorous address in Palm Springs. Buyers and locals love knowing the story behind the city's most famous house — and it's a perfect example of why Palm Springs real estate carries cultural cachet no other desert market can match.",
    targetKeyword: 'Frank Sinatra Palm Springs house Twin Palms',
    cityTarget: 'Palm Springs',
    researchData: `Frank Sinatra commissioned architect E. Stewart Williams to design Twin Palms Estate at 1148 E Alejo Road, Palm Springs in 1947. The house cost $150,000 to build. Key features: a piano-shaped swimming pool (a nod to Sinatra's music career), a curved bar that could seat 40 guests, and a yellow bedroom Sinatra called "the room where I cry." Sinatra proposed to Ava Gardner here. The Rat Pack — Dean Martin, Sammy Davis Jr., Peter Lawford, Joey Bishop — were frequent guests. Sinatra lived here through the 1950s and it became the social hub of Hollywood's desert escape. The property is 4,000 sq ft, 5 bedrooms, and sits on a half-acre. It is now available as a luxury vacation rental at around $3,000–$4,500 per night. The estate is a designated historic property. E. Stewart Williams, the architect, also designed multiple other buildings in Palm Springs including the Frank Sinatra Cultural Center. The piano-shaped pool is one of the most photographed private pools in America.`,
  },
  {
    slug: 'jfk-sinatra-helipad-feud',
    title: "The Night JFK Broke Frank Sinatra's Heart in Palm Springs — and Sinatra Took a Sledgehammer to the Proof",
    angle: "In 1962, Frank Sinatra spent months and $400,000 preparing his Palm Springs compound to host President Kennedy for a weekend. Then Robert Kennedy intervened — and Sinatra found out JFK was staying at Bing Crosby's house instead. What happened next became one of Hollywood's most legendary feuds.",
    whyItMatters: "This story happened in Palm Springs and involves two of the most famous addresses in the desert: Sinatra's compound and Bing Crosby's Sunnylands-adjacent estate. It's the kind of Hollywood-meets-Washington drama that makes Palm Springs unlike any other real estate market — history is baked into every wall.",
    targetKeyword: 'Frank Sinatra JFK Palm Springs feud helipad',
    cityTarget: 'Palm Springs',
    researchData: `In early 1962, President John F. Kennedy planned a weekend stay in Palm Springs. Frank Sinatra was thrilled — he had personally overseen $400,000 in improvements to his compound at 1148 E Alejo Road to accommodate the President, including constructing a dedicated helipad and adding guest cottages. Attorney General Robert Kennedy advised President Kennedy not to stay with Sinatra due to FBI investigations into Sinatra's alleged connections to organised crime figures including Sam Giancana. JFK cancelled and stayed instead at Bing Crosby's home in Palm Springs (Crosby was a Republican — the irony was not lost on anyone). When Peter Lawford delivered the news to Sinatra, Sinatra reportedly took a sledgehammer to the freshly built helipad himself. Sinatra and Lawford's friendship ended permanently. Sinatra didn't speak to JFK again before his assassination in 1963. The helipad remnants were reportedly still visible on the property for years afterward. Bing Crosby's Palm Springs home, where JFK actually stayed, is at 70588 Frank Sinatra Drive in Rancho Mirage (the street was later renamed in Sinatra's honour, adding another layer of local irony).`,
  },
  {
    slug: 'elvis-presley-honeymoon-palm-springs',
    title: "Elvis and Priscilla's Palm Springs Honeymoon House — The Desert Home That Witnessed Rock and Roll History",
    angle: "After their May 1967 Las Vegas wedding, Elvis and Priscilla Presley drove straight to Palm Springs for their honeymoon. The house they stayed in is still standing — a mid-century modern gem that briefly housed the world's most famous newlyweds.",
    whyItMatters: "The Elvis honeymoon house at 845 Chino Canyon Road is a real Palm Springs address that real estate fans and music history buffs both love. Mid-century modern homes in Palm Springs are among the most sought-after properties in the country right now — and this one has a story attached to it that no amount of renovation can replicate.",
    targetKeyword: 'Elvis Presley Palm Springs honeymoon house',
    cityTarget: 'Palm Springs',
    researchData: `Elvis Presley and Priscilla Beaulieu were married on May 1, 1967 at the Aladdin Hotel in Las Vegas. They drove directly to Palm Springs for their honeymoon, staying at a home at 845 Chino Canyon Road (also referenced as 1350 Ladera Circle in some sources — there is some historical debate). The house is a classic Palm Springs mid-century modern property. Elvis was a frequent Palm Springs visitor — he loved the desert privacy and the close proximity to Las Vegas while being away from the Hollywood spotlight. The Presleys returned to Palm Springs multiple times during their marriage. Elvis also reportedly considered purchasing a larger Palm Springs estate during the late 1960s. The honeymoon cottage has changed hands multiple times since and is a residential property. Palm Springs has a strong Elvis connection — the annual "Elvis Fest" and the city's mid-century modern architecture preservation movement both draw fans and design enthusiasts. Mid-century modern homes in Palm Springs now sell for $800K–$3M+ depending on architect and condition.`,
  },
  {
    slug: 'bob-hope-palm-springs-estate',
    title: "Bob Hope's $50 Million Palm Springs Mansion — The Most Talked-About Home in Desert Real Estate History",
    angle: "Comedian Bob Hope built a 23,000-square-foot UFO-shaped estate in Palm Springs designed by legendary architect John Lautner. It sat unsold for years after Hope's death, listed as high as $50 million, and became one of the most written-about real estate stories in the country.",
    whyItMatters: "The Bob Hope Estate at 1 Southridge Drive, Palm Springs is a perfect local history story with a direct real estate angle — it's literally about a house, a famous owner, a legendary architect, and a dramatic real estate saga. Mid-century modern architecture is the defining appeal of Palm Springs, and this is the ultimate example.",
    targetKeyword: 'Bob Hope Palm Springs estate John Lautner house',
    cityTarget: 'Palm Springs',
    researchData: `Bob Hope commissioned architect John Lautner to design his Palm Springs estate at 1 Southridge Drive in 1973. The house took until 1979 to complete. It features a massive volcanic crater-shaped roof — locals call it the "UFO house" or "volcano house." The main structure is 23,000 sq ft. The property sits on 2.5 acres with views of the entire Coachella Valley. Bob Hope entertained presidents, celebrities, and world leaders at the estate. After Hope's death in 2003, the estate was listed for sale at $50 million (2013), then $25 million, then $17.5 million. It finally sold in 2016 for approximately $13 million to a developer. The estate was featured in countless architecture magazines and real estate publications as one of the most unique properties in America. John Lautner is considered one of America's greatest mid-century modern architects — his work in Palm Springs and Los Angeles commands premium prices. The home is a designated historic property. Bob Hope performed at his first USO show in 1941 and used the Palm Springs estate as his primary California residence for decades.`,
  },
  {
    slug: 'sunnylands-annenberg-estate-presidents',
    title: "Sunnylands: The Rancho Mirage Estate Where 11 Presidents Vacationed — The 'Camp David of the West'",
    angle: "Walter and Leonore Annenberg built a 200-acre estate in Rancho Mirage where every US president from Eisenhower to Obama stayed. Ronald Reagan spent 8 New Year's holidays here. It's now a museum and retreat center — and its presence helped define the Coachella Valley as America's premier luxury desert destination.",
    whyItMatters: "Sunnylands at 37977 Bob Hope Drive, Rancho Mirage is the most historically significant private estate in the Coachella Valley. Its story explains why Rancho Mirage commands premium real estate prices — neighbouring a property that hosted every president for 40 years has a way of elevating an entire zip code.",
    targetKeyword: 'Sunnylands Annenberg estate Rancho Mirage presidents',
    cityTarget: 'Rancho Mirage',
    researchData: `Walter Annenberg (publishing magnate and US Ambassador to the UK under Nixon) and his wife Leonore built Sunnylands at 37977 Bob Hope Drive, Rancho Mirage. The estate covers 200 acres with a 25,000 sq ft main house designed by A. Quincy Jones and completed in 1966. Presidents who stayed: Eisenhower, Nixon, Ford, Reagan (8 consecutive New Year's holidays), Bush Sr., Clinton, Bush Jr., Obama. Reagan and Gorbachev held informal meetings at Sunnylands. Obama hosted Chinese President Xi Jinping at Sunnylands in 2013 for summit talks. The property features a private 9-hole golf course, a museum-quality art collection (Monet, Van Gogh, Renoir), and guest houses. Walter Annenberg donated the estate to a charitable foundation upon his death in 2002. It is now open to the public as the Sunnylands Center & Gardens with free admission. The estate has been called "the Camp David of the West" by media for decades. Address: 37977 Bob Hope Drive, Rancho Mirage, CA 92270. The surrounding neighbourhood of Rancho Mirage has median home prices $800K–$2M+ partly due to the prestige association.`,
  },
  {
    slug: 'marilyn-monroe-palm-springs-retreat',
    title: "Marilyn Monroe's Palm Springs Hideaway — The Desert Escape Where Hollywood's Biggest Star Found Quiet",
    angle: "In the 1950s and early 1960s, Marilyn Monroe regularly escaped Hollywood's glare for Palm Springs. She stayed at a private home on Rose Avenue where she could swim, sunbathe, and exist without cameras — a side of Marilyn most people never knew.",
    whyItMatters: "Monroe's Palm Springs connection is one of the city's best-kept celebrity secrets. For buyers drawn to Palm Springs' legacy of old Hollywood glamour, stories like this are exactly why the address matters as much as the square footage. Palm Springs doesn't just sell houses — it sells a piece of a golden era.",
    targetKeyword: 'Marilyn Monroe Palm Springs house retreat',
    cityTarget: 'Palm Springs',
    researchData: `Marilyn Monroe was a frequent visitor to Palm Springs throughout the 1950s and early 1960s, using it as an escape from the intense media scrutiny she faced in Hollywood and New York. Monroe stayed at a private residence at 1326 Rose Avenue in Palm Springs on multiple occasions. She was photographed poolside in Palm Springs numerous times — some of the most iconic casual photographs of Monroe came from Palm Springs. Monroe's Palm Springs visits coincided with her relationships with Joe DiMaggio and Arthur Miller — both men also visited. She reportedly loved the anonymity she found in the desert, where locals treated celebrities with discretion (a Palm Springs tradition that persists today). Monroe visited Palm Springs during her contract disputes with 20th Century Fox in 1962, the same year she died. The house on Rose Avenue is a mid-century modern private residence. The tradition of Hollywood celebrities using Palm Springs as a private retreat continues — the city's culture of discretion is part of its real estate appeal.`,
  },
  {
    slug: 'rat-pack-desert-playground',
    title: "The Rat Pack Owned Palm Springs on Weekends — Here's What Actually Happened at Those Desert Parties",
    angle: "Every Friday night in the late 1950s, Frank Sinatra, Dean Martin, Sammy Davis Jr., Peter Lawford, and Joey Bishop would caravan from Hollywood to Palm Springs. What happened in the desert stayed in the desert — until now.",
    whyItMatters: "The Rat Pack era is the foundation of Palm Springs' identity as a glamour destination. Every mid-century modern home in Palm Springs was built during or just after this golden era. Understanding this history helps buyers understand why these homes carry cultural value that goes beyond square footage and lot size.",
    targetKeyword: 'Rat Pack Palm Springs parties Dean Martin Sammy Davis',
    cityTarget: 'Palm Springs',
    researchData: `The Rat Pack — Frank Sinatra, Dean Martin, Sammy Davis Jr., Peter Lawford, and Joey Bishop — adopted Palm Springs as their unofficial weekend retreat from approximately 1956 to 1963. Sinatra's Twin Palms Estate (1148 E Alejo Rd) was the primary gathering spot. Dean Martin owned a home in Palm Springs at 1123 N Via Monte Vista. Sammy Davis Jr. faced racial discrimination in Palm Springs hotels (some refused to serve Black guests) — Sinatra famously threatened to pull out of engagements unless venues admitted Davis. This confrontation helped accelerate Palm Springs' shift to racially inclusive hospitality. The Rat Pack performed together at the Cal-Neva Lodge at Lake Tahoe and at Vegas venues, using Palm Springs as the recovery and party location. They were photographed extensively at the Racquet Club of Palm Springs, then the social hub of Hollywood celebrity life. The Racquet Club (2743 N Indian Canyon Dr) opened in 1934 and was where Clark Gable, Marlene Dietrich, and Charlie Chaplin were also regulars. Cary Grant, Kirk Douglas, and Lucille Ball all owned Palm Springs homes during this era. This concentration of celebrity homeownership shaped the city's architecture — virtually every prominent mid-century modern architect (Richard Neutra, Albert Frey, William Krisel, Donald Wexler) built homes in Palm Springs during 1950–1965.`,
  },
  {
    slug: 'agua-caliente-checkerboard-land-palm-springs',
    title: "Why Half of Palm Springs Sits on Native American Land — The Checkerboard Deal That Still Shapes Real Estate Today",
    angle: "The Agua Caliente Band of Cahuilla Indians own the mineral rights to Palm Springs' hot springs and hold title to alternating sections of the city in a pattern called the checkerboard — a consequence of an 1876 federal land grant. It's one of the most unusual real estate structures in America, and it directly affects property transactions in Palm Springs today.",
    whyItMatters: "Any buyer purchasing property in Palm Springs should understand the Agua Caliente land situation — some land is fee simple, some is on tribal lease. This affects financing, property taxes, and ownership structure. Knowing this history makes buyers smarter, and it's a genuinely fascinating story about how Palm Springs came to be.",
    targetKeyword: 'Agua Caliente Palm Springs tribal land checkerboard real estate',
    cityTarget: 'Palm Springs',
    researchData: `The Agua Caliente Band of Cahuilla Indians have lived in the Coachella Valley for over 3,000 years. Their traditional village sites sit atop the natural hot springs for which Palm Springs is named (agua caliente = hot water in Spanish). In 1876, the federal government created a reservation for the tribe using a "checkerboard" pattern — alternating square-mile sections were designated tribal land, with the in-between sections left for non-tribal development. This checkerboard pattern means that many Palm Springs streets have properties alternating between fee-simple ownership and properties on Agua Caliente tribal trust land. Properties on tribal land use a Long-Term Land Lease (typically 65-year leases) rather than traditional fee simple ownership. These leases affect mortgage financing — some conventional lenders are unfamiliar with tribal leases; VA and FHA loans have specific requirements. The tribe owns the mineral rights to the natural hot springs throughout Palm Springs. The Agua Caliente Cultural Museum in downtown Palm Springs tells this story. The tribe operates Spa Resort Casino and Agua Caliente Casino Resort Spa. Today the Agua Caliente Band has approximately 500 enrolled members and is one of the most economically influential tribes in California. Buyers should always ask their agent (like Shana) whether a property is on tribal lease land before making an offer — it changes the transaction significantly.`,
  },
  {
    slug: 'liberace-palm-springs-mansion',
    title: "Liberace's Palm Springs Mansion Was Exactly What You'd Expect — And Then Some",
    angle: "Flamboyant pianist Liberace owned a Palm Springs estate that was pure Liberace: a candelabra-shaped pool, rooms decorated entirely in his favourite colours, and a lifestyle that made his neighbours' jaws drop. The house became one of the most memorable celebrity properties in the city's history.",
    whyItMatters: "Liberace's Palm Springs era represents the wild end of mid-century celebrity excess in the desert — a contrast to the clean lines of the mid-century modern homes around him. The story appeals to both design lovers and pop-culture fans, and the candelabra pool alone is an image that stops people in their tracks.",
    targetKeyword: 'Liberace Palm Springs house candelabra pool estate',
    cityTarget: 'Palm Springs',
    researchData: `Liberace (Władziu Valentino Liberace) owned a home at 501 N Belardo Road in Palm Springs. The property featured a candelabra-shaped swimming pool — possibly the most extravagant custom pool in Palm Springs history. Liberace decorated his Palm Springs home in his signature over-the-top style: heavy use of his favourite colours (red, gold, white), mirrors throughout, and custom furniture. Liberace performed extensively in Las Vegas and used Palm Springs as his California base. He was a regular at the Racquet Club and a participant in the celebrity social scene. Liberace owned several properties simultaneously — his other famous residence was in Las Vegas. His Palm Springs home was a subject of fascination in celebrity gossip columns throughout the 1960s and 70s. Liberace died in 1987 in Palm Springs, at his home on Alejo Road (he had moved by the 1980s). His death from AIDS-related complications was initially described as heart failure, later corrected. Liberace's Palm Springs connection is part of the city's history as an LGBTQ-welcoming destination — the city has a long history of being a safe haven. The original candelabra pool property has changed hands and been renovated since Liberace's ownership.`,
  },
  {
    slug: 'palm-springs-architecture-golden-era',
    title: "How Hollywood Celebrities Accidentally Created the Most Architecturally Valuable Neighborhood in America",
    angle: "In the 1940s and 1950s, Hollywood stars wanted desert escapes designed by the best architects money could hire. They commissioned Richard Neutra, Albert Frey, William Krisel, and Donald Wexler — unknowingly creating a concentration of mid-century modern masterpieces that collectors and buyers now compete fiercely to own.",
    whyItMatters: "This is THE origin story of why Palm Springs real estate commands such a premium. Mid-century modern homes in Palm Springs sell for $800K to $5M+ not because of their size — because of who designed them and who lived in them. Understanding this history helps buyers make sense of the market and appreciate what they're actually buying.",
    targetKeyword: 'Palm Springs mid-century modern architecture celebrities history',
    cityTarget: 'Palm Springs',
    researchData: `Palm Springs became an architectural showcase between 1935 and 1970 when a combination of Hollywood studio contracts, celebrity wealth, and a small close-knit design community created a perfect environment. Key architects and their notable Palm Springs works: Albert Frey — City Hall, Tramway Valley Station, his own Frey House II perched in the rocks above the valley. Richard Neutra — Kaufmann Desert House (1946) at 470 W Vista Chino, one of the most famous mid-century homes in the world; sold for $25M in 2022. William Krisel — designed thousands of Palm Springs homes for developer Alexander Construction Company including the famous "butterfly roof" tract homes that are now highly collectible. Donald Wexler — Desert Highlands, the steel houses. John Lautner — Bob Hope Estate. E. Stewart Williams — Frank Sinatra's Twin Palms, the Edris House. The Alexander Construction Company built over 2,000 homes in Palm Springs between 1955-1965, many designed by Krisel — these homes now sell for $600K–$2M. The Kaufmann Desert House listed for $25M in 2021 and sold in that range. Modernism Week in Palm Springs (February annually) draws 150,000+ visitors specifically to see this architecture. The Palm Springs Preservation Foundation and Historic Site Designation Program have designated over 100 individual properties. This concentration of architectural history is unique in the US — no other small city has this density of iconic mid-century design.`,
  },
]

export async function seedEvergreenHistoryIdeas(): Promise<number> {
  const weekId = buildWeekId()
  let saved = 0

  for (const story of PALM_SPRINGS_STORIES) {
    const id = `history-${story.slug}-${weekId}`

    // Don't overwrite if already reviewed/approved this week
    const existing = await getIdea(id)
    if (existing && existing.status !== 'pending') continue

    const idea: IdeaCandidate = {
      id,
      weekId,
      source: 'internal',
      title: story.title,
      angle: story.angle,
      whyItMatters: story.whyItMatters,
      category: 'local-history',
      audiences: ['local', 'buyer'],
      contentType: 'Local History',
      urgency: 'evergreen',
      score: {
        total: 78,
        localRelevance: 25,
        timeliness: 8,
        formatFit: 14,
        audienceValue: 13,
        sourceCredibility: 9,
        novelty: 7,
        seoPotential: 2,
      },
      sourceUrls: [],
      sourceDomains: [],
      sourceLabels: ['Curated — Palm Springs History'],
      researchData: story.researchData,
      targetKeyword: story.targetKeyword,
      cityTarget: story.cityTarget,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    await saveIdea(idea)
    saved++
  }

  return saved
}
