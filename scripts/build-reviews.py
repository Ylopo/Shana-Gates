#!/usr/bin/env python3
"""Build data/reviews.json from Zillow scrape + user-pasted Google reviews."""
import json, re

# ── Google reviews (transcribed from user-pasted Google Business Profile content) ──
google_reviews_raw = [
    # Most recent first
    {"reviewer": "Tatum Dukes", "date_rel": "22 hours ago", "rating": 5, "body": "Shana is incredible, & so knowledgeable at what she does! Truly the best in the desert!"},
    {"reviewer": "Armando Martinez", "date_rel": "2 weeks ago", "rating": 5, "body": "Working with Shana was truly an amazing experience from beginning to end. As a first-time homebuyer, the process felt overwhelming at first, but she made everything so easy to understand and navigate. She is incredibly kind, knowledgeable, and patient."},
    {"reviewer": "Sebastian Ramirez", "date_rel": "2 weeks ago", "rating": 5, "body": "Shana was absolutely amazing to work with from start to finish. She was professional, knowledgeable, responsive, and genuinely cared about making the entire process smooth and stress free. Her expertise in the Coachella Valley market really shows and I always felt like I was in great hands. Highly recommend!"},
    {"reviewer": "Rachel Urias", "date_rel": "2 weeks ago", "rating": 5, "body": "Shana is so knowledgeable. She is able to explain everything so that I understand and feel comfortable and well informed. I love working with her."},
    {"reviewer": "Diane Lipson", "date_rel": "2 weeks ago", "rating": 5, "body": "Amazing Shana - she found a home for my best friend. The other realtor my friend contacted would never return the many calls. Shana cares ❤️ love her"},
    {"reviewer": "Janna Hartfield", "date_rel": "2 weeks ago", "rating": 5, "body": "Best realtor in Palm Springs"},
    {"reviewer": "Edward Sandoval", "date_rel": "a month ago", "rating": 5, "body": "Shana was a fantastic realtor — smart, patient, and incredibly understanding. She was chosen by my ex-husband to sell our home, and she handled everything with care, fairness, and professionalism. I truly appreciated her approach and the way she navigated the sale of our Palm Springs home."},
    {"reviewer": "jeff peterson", "date_rel": "2 months ago", "rating": 5, "body": "I recently purchased a beautiful home in Palm Desert, California, and I cannot say enough good things about my experience with Shana Gates and Ryann Hammond. I haven't purchased a home in 25 years, so I was naturally a bit apprehensive."},
    {"reviewer": "J Alfonso", "date_rel": "4 months ago", "rating": 5, "body": "Shana delivered an exceptional level of service on our Palm Desert listing, setting a standard of professionalism and execution that is truly rare in today's market. From the outset, she was an outstanding communicator — responsive, clear, and proactive."},
    {"reviewer": "Greg Stone", "date_rel": "3 months ago", "rating": 5, "body": "Got the pleasure to help Shana's client and list her home in Reno. With Shana being in CA she has been great with communication and assisting me in every way possible when needed. Her professionalism, experience and knowledge is top notch. I would highly recommend reaching out to her with any real estate needs."},
    {"reviewer": "Bruce Somers", "date_rel": "6 months ago", "rating": 5, "body": "Shana worked with me to sell our house in Los Angeles this year. She was incredibly detailed in her approach to researching and selling the house. Shana and her amazing team at Craft & Bauer used a lot of social media tools and specific marketing strategies that delivered."},
    {"reviewer": "wolf tree", "date_rel": "4 months ago", "rating": 2, "body": "After speaking with Shana Gates, and outlining my maximum budget for real estate prices and HOA's, she sent me comps that were largely well outside of the parameters we agreed to. I replied to her email and provided my feedback, reminding her of the parameters we agreed upon."},
    {"reviewer": "Eric Williamson", "date_rel": "7 months ago", "rating": 5, "body": "A Tip of the Hat to a True Pro. As a fellow real estate professional, I just want to take a moment to tip my hat to an exceptional agent — Shana Gates. We recently worked together on an escrow, and her professionalism was outstanding."},
    {"reviewer": "Terri", "date_rel": "7 months ago", "rating": 5, "body": "All I can say is 'The Best'. So professional, friendly, and helpful through out the entire process. Jacob, Shana, and Christina went over and beyond to ensure all ran smoothly and it did! We couldn't be more pleased. Many thanks to Craft & Bauer!"},
    {"reviewer": "Eric", "date_rel": "7 months ago", "rating": 5, "body": "Shana is the best real estate agent out here in the desert. Very professional, kind, punctual, caring agent here in the Desert area."},
    {"reviewer": "Michelle Doan", "date_rel": "4 months ago", "rating": 5, "body": "Shana is professional, responsive, and truly has your best interests in mind. Highly recommend!"},
    {"reviewer": "mary lou page", "date_rel": "a year ago", "rating": 5, "body": "We want to say Shana was the ultimate professional realtor in every way. She was very easy to work with, as she listened intently. Her team never missed anything, got the best photographer, who did excellent work."},
    {"reviewer": "Tim Kelly", "date_rel": "a year ago", "rating": 5, "body": "Working with Shana Gates was an absolute pleasure! Her extensive knowledge of the local market, coupled with her unwavering commitment to finding the perfect home for us, made the entire process seamless and stress-free."},
    {"reviewer": "Lainie Sims", "date_rel": "a year ago", "rating": 5, "body": "We recently purchased our home in La Quinta, CA using the professional services of Shana Gates and Charisse Drewry of Craft & Bauer Realty Co. We cannot express our immense gratitude and pleasure dealing with this team."},
    {"reviewer": "christina joy", "date_rel": "a year ago", "rating": 5, "body": "Shana is an absolute pleasure to work with! Known as the 'hostess with the mostess,' her warmth and expertise shine through in every client interaction. With over 20 years of experience, she navigates the real estate world easily."},
    {"reviewer": "Catherine Caldwell", "date_rel": "a year ago", "rating": 5, "body": "Thank you Jacob & Shana for helping us find our forever home! You both made this process so easy and carefree for us. The team at Craft & Bauer truly puts the client first. They were with us every step of the way and in constant communication."},
    {"reviewer": "Dallas Williams", "date_rel": "a year ago", "rating": 5, "body": "Shana and her team are by far the best realtors I have ever experienced. They went above and beyond the service a normal Realtor provides. I highly recommend Shana whether you're selling or buying!"},
    {"reviewer": "Candace Nurczyk", "date_rel": "2 years ago", "rating": 5, "body": "Shana and Mark go above and beyond and not only make the best team but literally exceed your expectations. I'm a former Mortgage Consultant that has had the pleasure to work with so many real estate professionals."},
    {"reviewer": "kallihan ross", "date_rel": "2 years ago", "rating": 5, "body": "I would highly recommend Shana and her informative team when looking for homes in the Coachella Valley!"},
    {"reviewer": "Jared Balassi", "date_rel": "2 years ago", "rating": 5, "body": "Shana is just an amazing person overall. Not only is she a great realtor with plenty of experience to back her up. She is someone who I can truly rely on from a realtor to realtor relationship along with a personal friendship."},
    {"reviewer": "Megan Pearce", "date_rel": "2 years ago", "rating": 5, "body": "Shana was amazing to work with! She was very knowledgeable and made us feel comfortable through the entire process."},
    {"reviewer": "Ben Arwin", "date_rel": "2 years ago", "rating": 5, "body": "Such a great team to work with. Took care of us every step of the way, provided great advice, and got the deal done on time and low stress. Thanks!"},
    {"reviewer": "Christopher Mee", "date_rel": "2 years ago", "rating": 5, "body": "They need to have more than five stars for this young lady! I've never bought a home so stress-free. She's an absolute sweetheart."},
    {"reviewer": "THE MORTGAGE DR", "date_rel": "2 years ago", "rating": 5, "body": "Shana is an amazing agent that takes great care of all her clients. She's extremely knowledgeable and will always work hard to get you the best deal!"},
    {"reviewer": "Steve Weber", "date_rel": "3 years ago", "rating": 5, "body": "Shana was fantastic. We were located 3000 miles away going through the buying process. Shana made sure everything went through without any problems. She worked with the seller's RE agent, ensured the home inspection was comprehensive."},
    {"reviewer": "CHARISSE DREWRY", "date_rel": "3 years ago", "rating": 5, "body": "Shana is knowledgeable in her field, efficient and responsive in handling questions and any issues that arose. She was definitely on my team, working towards my best interests. She got my family and I a great deal on the perfect house!"},
    {"reviewer": "Alyssa Grace", "date_rel": "3 years ago", "rating": 5, "body": "Shana and her team go the extra mile to ensure that their client is happy. Their teamwork, attention to detail and communication are excellent. I wouldn't hesitate to recommend Shana for all of your real estate needs."},
    {"reviewer": "Amanda Peterson", "date_rel": "3 years ago", "rating": 5, "body": "Shana goes to the greatest lengths to ensure everything is perfect. She works every angle to the last detail and is sure to follow up before, during, and after closing. When a blended family can say she meets every need you have to know she's exceptional."},
    {"reviewer": "Laura Grody", "date_rel": "3 years ago", "rating": 5, "body": "Above and beyond doesn't even begin to describe Shana when it comes to service. We haven't even listed our property yet because of some legal things that need to occur first, but she's helped with repairs, estate sales, consignment sales."},
    {"reviewer": "J R", "date_rel": "3 years ago", "rating": 5, "body": "Shana Gates and the rest of her team are total professionals. Their communication is excellent and they will always go above and beyond. I worked with Shana many times. She is my go-to for all of my real estate transactions."},
    {"reviewer": "Denton Stowers", "date_rel": "3 years ago", "rating": 5, "body": "Shana is one of the best agents to ever work with! She has amazing knowledge and really takes care of you."},
    {"reviewer": "Abby Farhoud", "date_rel": "3 years ago", "rating": 5, "body": "My family and I decided to relocate and made the smart decision of hiring Shana and her team to sell my home. Wouldn't make a move without them! Thank you, Shana!"},
    {"reviewer": "Ann A", "date_rel": "3 years ago", "rating": 5, "body": "Sweet, quick to respond and driven to succeed for her clients!"},
]

CV_CITIES = ['palm springs','palm desert','rancho mirage','indian wells','la quinta','indio','cathedral city','desert hot springs','coachella','coachella valley','the desert','desert area']

# Cities that DISQUALIFY a review from AEO use (non-CV CA markets + other states).
# A review explicitly mentioning one of these is about a non-CV transaction and
# shouldn't appear on Coachella Valley AEO pages.
EXCLUDED_MARKETS = [
    # Central California (Modesto / Tri-Valley area where Shana's team has worked)
    'modesto','tracy','dublin','lodi','turlock','ceres','stockton','pleasanton',
    'livermore','manteca','riverbank','oakdale','tri-valley','tri valley','san joaquin',
    # Bay Area
    'san francisco','oakland','berkeley','san jose','silicon valley',
    # Southern California outside CV
    'los angeles','la county','san diego','orange county','irvine','anaheim',
    'long beach','santa monica','beverly hills','malibu','pasadena',
    # Other CA
    'sacramento','fresno','bakersfield',
    # Other states
    'reno','las vegas','nevada','arizona','phoenix','scottsdale',
]

def is_excluded_market(text):
    """True if the text references a non-CV market that disqualifies the review."""
    t = text.lower()
    for m in EXCLUDED_MARKETS:
        if re.search(r'\b' + re.escape(m) + r'\b', t):
            return m
    return None

def tag_cities(body):
    """Return list of CV city slugs mentioned in body."""
    body_l = body.lower()
    found = []
    # Check "coachella valley" / "the desert" first → coachella-valley
    if 'coachella valley' in body_l or 'the desert' in body_l or 'desert area' in body_l:
        found.append('coachella-valley')
    # Check actual city names. For "coachella", only match standalone (not as "coachella valley")
    cities_with_word_boundary = ['palm springs','palm desert','rancho mirage','indian wells','la quinta','indio','cathedral city','desert hot springs']
    for c in cities_with_word_boundary:
        if c in body_l:
            slug = c.replace(' ','-')
            if slug not in found:
                found.append(slug)
    # "coachella" the city — only match if it appears NOT as "coachella valley"
    if re.search(r'\bcoachella\b(?!\s+valley)', body_l):
        if 'coachella' not in found:
            found.append('coachella')
    return found

def best_quote(body):
    """Pick a short, citable line from the review for AEO use."""
    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', body)
    # Prefer sentences with a strong superlative or specific city mention
    strong = [s for s in sentences if re.search(r'\bbest\b|\bexceptional\b|\bamazing\b|\bincredible\b|\btruly\b|\boutstanding\b|\bprofessional\b|\bknowledgeable\b', s, re.IGNORECASE) and 30 <= len(s) <= 200]
    if strong:
        return strong[0].strip()
    if sentences:
        return sentences[0].strip()
    return body[:160].strip()

google_reviews = []
for raw in google_reviews_raw:
    cities = tag_cities(raw['body'])
    primary_market = cities[0] if cities else None
    excluded = is_excluded_market(raw['body'])
    # AEO-eligible iff: high rating AND not about a non-CV market
    use = raw['rating'] >= 4.5 and excluded is None
    google_reviews.append({
        'source': 'google',
        'source_url': 'https://www.google.com/maps/place/?q=place_id:Shana+Gates+Craft+%26+Bauer+Real+Broker',
        'rating': float(raw['rating']),
        'date': raw['date_rel'],
        'reviewer': raw['reviewer'],
        'body': raw['body'],
        'cities_mentioned': cities,
        'primary_city': primary_market,
        'excluded_market': excluded,
        'best_quote': best_quote(raw['body']),
        'use_in_aeo': use,
    })

# ── Re-parse Zillow reviews from original scrape markdown (idempotent) ──
zillow_reviews = []
try:
    with open('/tmp/shana-zillow.md') as f:
        md = f.read()
    start = md.find("## Shana Gates's reviews (14)")
    end = md.find('Add a review')
    chunk = md[start:end] if start >= 0 and end > start else ''
    pat = re.compile(
        r'(?P<rating>[1-5]\.\d)\s*\n[\s\S]*?-\s*(?P<date>\d{1,2}/\d{1,2}/\d{4})\s*\n\s*-\s*•\s*(?P<reviewer>[^\n]+?)\n+###\s*(?P<title>[^\n]+?)\n+(?P<body>[\s\S]+?)(?=Show more|\n\n+[1-5]\.\d|\Z)',
        re.MULTILINE,
    )
    for m in pat.finditer(chunk):
        rating = float(m.group('rating'))
        date = m.group('date').strip()
        reviewer = m.group('reviewer').strip()
        title = m.group('title').strip().rstrip('.')
        body_raw = m.group('body').strip()
        parts = [p.strip() for p in re.split(r'\n\n+', body_raw) if p.strip()]
        body = next((p for p in parts if '...' not in p and '…' not in p), max(parts, key=len) if parts else body_raw)
        body = re.sub(r'\.{3,}\s*$', '…', body)
        body = re.sub(r'\s+', ' ', body).strip()

        cities = tag_cities(body + ' ' + title)
        body_l = body.lower()
        mentions_shana = bool(re.search(r'\bshana\b', body_l))
        teammate = re.search(r'\b(andrew|jesica|ryann)\b', body_l)
        if mentions_shana and not teammate: primary_agent = 'shana'
        elif teammate and not mentions_shana: primary_agent = teammate.group(1)
        elif mentions_shana and teammate: primary_agent = 'shana-and-team'
        else: primary_agent = 'unspecified'

        excluded = is_excluded_market(title + ' ' + body)
        use = (
            rating >= 4.5
            and primary_agent in ('shana','shana-and-team','unspecified')
            and excluded is None
            and (cities or primary_agent == 'shana')
        )
        zillow_reviews.append({
            'source': 'zillow',
            'source_url': 'https://www.zillow.com/profile/ShanaGatesTeam',
            'rating': rating,
            'date': date,
            'reviewer': reviewer,
            'transaction': title,
            'body': body,
            'truncated': '…' in body,
            'cities_mentioned': cities,
            'primary_city': cities[0] if cities else None,
            'primary_agent': primary_agent,
            'excluded_market': excluded,
            'best_quote': best_quote(body),
            'use_in_aeo': bool(use),
        })
except FileNotFoundError:
    pass  # No Zillow scrape available — skip

all_reviews = google_reviews + zillow_reviews

# ── Build city → reviews index ──
by_city = {}
for r in all_reviews:
    if not r.get('use_in_aeo'):
        continue
    for c in r.get('cities_mentioned') or ['coachella-valley']:
        by_city.setdefault(c, []).append({
            'source': r['source'],
            'reviewer': r['reviewer'],
            'rating': r['rating'],
            'quote': r['best_quote'],
            'date': r['date'],
        })

# Stats
total = len(all_reviews)
aeo_eligible = sum(1 for r in all_reviews if r['use_in_aeo'])
by_source = {}
for r in all_reviews:
    by_source[r['source']] = by_source.get(r['source'], 0) + 1

out = {
    'meta': {
        'updated_at': '2026-05-27',
        'business_name': 'Shana Gates · Craft & Bauer | The Real Brokerage Inc.',
        'address': '74-710 CA-111 #102, Palm Desert, CA 92260',
        'phone': '+1-760-232-4054',
        'sources': {
            'google': {
                'name': 'Shana Gates - Craft & Bauer Real Broker',
                'address': '74-710 CA-111 #102, Palm Desert, CA 92260',
                'aggregate_rating': 4.8,
                'total_review_count': 44,
                'captured_count': len(google_reviews),
                'notes': [
                    'Reviews transcribed from Google Business Profile content (pasted by client 2026-05-27).',
                    'Body text may be slightly abridged; verify against the live Google profile before quoting verbatim.',
                    '1 negative review captured (wolf tree, 2★, 4 months ago) — excluded from AEO use.',
                    'Recent reviews (2 weeks ago and newer) include several Coachella-Valley-specific testimonials suitable for AEO citation.',
                ],
            },
            'zillow': {
                'name': 'Shana Gates Team',
                'profile_url': 'https://www.zillow.com/profile/ShanaGatesTeam',
                'aggregate_rating': 4.7,
                'total_review_count': 14,
                'captured_count': len(zillow_reviews),
                'notes': [
                    'Zillow team profile — several reviews reference teammates Andrew, Jesica, Ryann rather than Shana directly.',
                    'Most pre-2024 reviews are Central California work (Modesto, Tracy, Dublin, Lodi, Turlock, Ceres).',
                ],
            },
        },
        'totals': {
            'total_captured': total,
            'aeo_eligible': aeo_eligible,
            'by_source': by_source,
        },
        'usage': {
            'aeo_filter': "Use only reviews where use_in_aeo=true (rating ≥4.5 and Shana is the primary subject). Quote the 'best_quote' field for short pull-quote callouts; quote 'body' for longer testimonial blocks.",
            'attribution': "Always include source ('Verified Google review' or 'Zillow review'), reviewer first name + last initial, and date. Link the source name to the source_url with target='_blank' rel='noopener'.",
            'city_targeting': "Use 'cities_mentioned' to match reviews to AEO pages: a review mentioning 'Palm Desert' is ideal for Palm Desert pages; a review mentioning 'Coachella Valley' or 'the desert' works on any of the 9 city pages.",
            'duplication': "Spread review usage across the ~177 AEO pages so no single review appears on more than ~5 pages. Generator should round-robin from city-specific reviews first, then fall back to generic.",
        },
    },
    'by_city': by_city,
    'reviews': all_reviews,
}

with open('data/reviews.json', 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f'✓ Wrote data/reviews.json')
print(f'  Total reviews captured: {total}')
print(f'    Google:  {by_source.get("google", 0)} (live: 44)')
print(f'    Zillow:  {by_source.get("zillow", 0)} (live: 14)')
print(f'  AEO-eligible:           {aeo_eligible}')
print(f'  Cities tagged:')
for c, lst in sorted(by_city.items(), key=lambda kv: -len(kv[1])):
    print(f'    {c:24s} {len(lst)}')
