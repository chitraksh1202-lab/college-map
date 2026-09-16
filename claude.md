# CLAUDE.md

## Project Overview

We are building a consumer web product for exploring US colleges visually and geographically.

The core product idea is:

> **Explore colleges like places, not rankings.**

The product should feel closer to Google Earth / travel discovery than a traditional university comparison spreadsheet.

Users should be able to:

1. Open a beautiful interactive US map.
2. Browse colleges geographically.
3. Click any US college.
4. Understand the college quickly.
5. Explore the physical campus through maps / Street View.
6. Discover interesting areas around campus.
7. Save colleges.
8. Compare colleges.
9. Continue discovering other schools naturally.

The product should eventually include most/all relevant four-year US institutions rather than only famous universities.

This is a **free traffic-first consumer product**.

Do NOT design the product around subscriptions or SaaS billing initially.

Primary success metric:

> Users explore multiple colleges per session because the experience is enjoyable and useful.

---

# Product Philosophy

Traditional college-search products begin with:

* rankings
* acceptance rates
* filters
* spreadsheets
* forms
* recommendation algorithms

We should instead begin with:

> **Where could you imagine yourself living and studying?**

The map and exploration experience are the product.

Numerical information supports exploration but should not dominate the interface.

The desired reaction is:

> “Wait, there are colleges here I’ve never heard of.”

and:

> “I can actually look around this campus.”

Not:

> “Here is another database of acceptance rates.”

---

# Target User

Initial target:

US high-school students researching undergraduate colleges.

Secondary audiences:

* international students considering US universities
* parents
* counselors
* students planning campus visits

Do not optimize initially for:

* universities purchasing leads
* admissions consultants
* enterprise customers
* graduate-school discovery
* international university databases

US undergraduate institutions only for V1.

---

# Core Differentiator

The competitive wedge is NOT:

* a US college map
* acceptance-rate filtering
* college comparison
* rankings
* AI matching

Those already exist.

The differentiator is:

> **Immersive geographic discovery and campus exploration.**

Important experiences include:

* interactive national college map
* state/city exploration
* campus Street View
* curated campus exploration points
* surrounding college-town/city context
* visual discovery
* “Teleport Me” discovery
* natural rabbit-hole navigation between colleges

---

# Product Scope

## V1 Core Features

### 1. Interactive US College Map

Show relevant US colleges using geographical coordinates.

Requirements:

* MapLibre GL JS
* clustering at low zoom
* individual college markers at higher zoom
* responsive desktop/mobile experience
* state browsing
* clicking marker opens college preview
* clicking preview opens college page

Do not render thousands of individual markers simultaneously without clustering.

---

### 2. College Search

Users should be able to search:

* university name
* abbreviation
* city
* state

Potential later search:

* majors
* public/private
* campus environment

Search should feel instantaneous.

Avoid external paid search infrastructure in V1.

A compact local index / lightweight fuzzy search is preferred.

---

### 3. College Profile Pages

Every relevant college should receive a valid page automatically.

Example:

/college/university-of-california-los-angeles

Page sections:

## Hero

* institution name
* city/state
* public/private
* undergraduate enrollment
* campus setting
* Save button
* Compare button
* Explore Campus CTA

## Explore Campus

Street View or mapped campus experience.

## At a Glance

Important facts presented visually.

Possible metrics:

* enrollment
* admission rate
* tuition
* average net price
* SAT / ACT where available
* graduation rate
* earnings outcomes
* institution type

## Map

Campus location.

## Programs

Top / available fields of study if reliable data exists.

## Similar / Nearby Colleges

Encourage additional discovery.

Do NOT create long generic AI-written descriptions purely for SEO.

---

### 4. Campus Explorer

This is the most important differentiating feature.

Basic colleges may have:

* university coordinates
* general campus map
* Street View near campus

Featured colleges may have curated points such as:

* main entrance
* iconic quad
* library
* student center
* dorm area
* athletic area
* student neighborhood
* nearby downtown area

Example structure:

```ts
type CampusTourPoint = {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  category:
    | "landmark"
    | "academic"
    | "residential"
    | "student-life"
    | "sports"
    | "surrounding-area";
};
```

Do not fabricate coordinates.

Curated coordinates must be manually verified or sourced reliably.

---

### 5. Teleport Me

A discovery button that sends the user to a random interesting college.

Purpose:

* encourage browsing
* introduce unknown schools
* increase pages/session
* make exploration playful

Potential future filtering:

* surprise me anywhere
* warm weather
* college town
* big city
* small school
* large school

V1 should remain simple.

---

### 6. Save Colleges

Do NOT build authentication initially.

Use localStorage.

Users should be able to:

* save college
* unsave college
* see saved colleges

Later we may add accounts to sync saved colleges across devices.

---

### 7. Compare

Allow lightweight comparison of selected colleges.

Initial comparison fields:

* location
* enrollment
* admission rate
* tuition
* net price
* graduation rate
* public/private
* campus setting

Do not attempt to compete with full admissions-analysis platforms.

---

### 8. State Pages

Example:

/state/california

Should include:

* interactive state-focused map
* colleges in the state
* simple useful summary
* links to individual colleges

Generate these programmatically.

---

# Technology

Preferred stack:

## Frontend

Astro + TypeScript

Use React islands only where interactivity is necessary.

Good React-use cases:

* interactive map
* search
* save
* comparison
* campus explorer

Avoid shipping React unnecessarily across static pages.

If the existing repository is already Next.js and migration would create unnecessary complexity, discuss before migrating.

---

## Styling

Tailwind CSS preferred.

Design should feel:

* youthful
* polished
* visual
* exploratory
* spacious
* modern
* map-first

Avoid:

* enterprise dashboard aesthetic
* giant tables
* excessive gradients
* generic AI startup aesthetic
* overuse of cards
* clutter

Mobile quality matters heavily.

---

## Main Map

Use:

MapLibre GL JS

Preferred map architecture:

MapLibre
→ PMTiles
→ Cloudflare R2

Do not rely on OpenStreetMap public tile servers for production traffic.

Do not make Google Maps the primary map layer.

---

## Street View

Use Google Maps Embed API when appropriate.

Do not:

* scrape Google Maps
* download Street View imagery
* store Google Street View images
* rehost Google Maps content

Store only our own metadata such as:

* college ID
* tour-point name
* coordinates
* description

Google should serve Street View directly through its official embed.

---

## Hosting

Preferred:

Cloudflare Pages / Workers

Prefer infrastructure that remains inexpensive as traffic grows.

Do not unnecessarily introduce expensive managed services.

---

## Database

V1 should avoid a production database wherever practical.

Static/generated college data can be stored in generated data files.

Saved colleges can use localStorage.

Add a database only when required for features such as:

* user accounts
* synced saves
* contributions
* admin editing
* personalization

Potential later database:

Cloudflare D1 or Supabase.

Do not implement a database merely because one might be useful eventually.

---

# Data Architecture

This is extremely important.

Never invent university facts.

Never use an LLM to generate factual admissions statistics.

Separate data into three categories.

## 1. Official Data

Information originating from authoritative datasets.

Example source:

US Department of Education College Scorecard.

Examples:

* institution ID
* name
* location
* latitude / longitude
* institution type
* enrollment
* tuition
* average net price
* admission rates
* SAT / ACT
* graduation
* earnings
* fields of study

Store provenance when practical.

---

## 2. Curated Data

Information created or manually verified by us.

Examples:

* campus tour points
* campus vibe tags
* iconic locations
* nearby student district
* official campus-tour video
* editorial description

Example:

```ts
type CuratedCollegeData = {
  unitId: string;
  featured?: boolean;
  campusSettingOverride?: string;
  tourPoints?: CampusTourPoint[];
  youtubeTourUrl?: string;
  editorialSummary?: string;
};
```

Official and curated data must remain separate.

---

## 3. Derived Data

Information calculated by our application.

Examples:

* nearby colleges
* distance calculations
* similarity
* normalized tuition values
* derived category labels

Derived metrics must be deterministic.

---

# College Scorecard Data Pipeline

Build a reproducible import pipeline.

Desired flow:

College Scorecard
→ raw download/API response
→ validation
→ normalization
→ clean internal schema
→ generated site data

Example command:

```bash
npm run data:import
```

Potential outputs:

```text
/data/generated/colleges.json
/data/generated/search-index.json
/data/generated/states.json
```

Never fetch College Scorecard during every end-user page request.

Website availability should not depend on external API uptime.

---

# Internal College Schema

Create a stable internal model.

Example:

```ts
type College = {
  id: string;
  unitId: string;
  slug: string;

  name: string;
  shortName?: string;

  city: string;
  state: string;
  zip?: string;

  latitude: number;
  longitude: number;

  ownership?: "public" | "private-nonprofit" | "private-for-profit";

  undergraduateEnrollment?: number;

  admissionRate?: number;

  tuitionInState?: number;
  tuitionOutOfState?: number;

  averageNetPrice?: number;

  graduationRate?: number;

  medianEarnings?: number;

  satAverage?: number;

  campusSetting?: string;

  website?: string;

  featured: boolean;
};
```

Missing data should remain null/undefined.

Never manufacture values to fill blanks.

---

# URLs

Use stable human-readable URLs.

Examples:

```text
/
/explore

/state/california
/state/massachusetts

/city/boston
/city/los-angeles

/college/stanford-university
/college/university-of-california-los-angeles

/compare
/saved
```

Avoid URLs dependent purely on mutable database IDs.

---

# SEO

SEO matters because this product may eventually monetize through traffic.

However:

## Do not create spammy programmatic pages.

Pages must provide genuine user value.

College pages should offer:

* map
* exploration
* facts
* campus experience
* nearby schools
* useful navigation

Do not create 50,000 keyword permutations.

Good examples:

/college/ucla
/state/california
/city/boston

Potential later pages only when genuinely useful:

/colleges/urban
/colleges/college-town

---

## Technical SEO

Implement:

* canonical URLs
* sitemap.xml
* robots.txt
* title/meta descriptions
* Open Graph tags
* fast Core Web Vitals
* structured data where appropriate

Use Schema.org CollegeOrUniversity structured data when valid.

Do not misuse structured data.

---

# Analytics

Analytics should exist before public launch.

Track important product behavior.

Events:

```text
homepage_view
map_open
state_selected
college_marker_clicked
college_page_view
campus_explorer_opened
campus_tour_started
tour_point_viewed
college_saved
college_unsaved
compare_started
compare_college_added
teleport_clicked
search_used
official_site_clicked
share_clicked
```

Primary behavioral metrics:

* colleges viewed/session
* map engagement
* campus explorer usage
* pages/session
* return users
* save rate
* comparison rate
* share rate
* Teleport usage

Core product hypothesis:

> Users enjoy exploring multiple colleges spatially.

If users average approximately one college/session, the core product concept may be failing.

---

# Performance

Map-heavy applications can become slow.

Requirements:

* lazy-load expensive components
* lazy-load Street View
* optimize marker rendering
* use clustering
* minimize client JS
* static-generate where practical
* compress large JSON assets
* cache aggressively
* avoid loading all detailed college data on initial map load

Target:

excellent usability on mid-range mobile devices.

---

# Accessibility

Must include:

* keyboard-accessible search
* keyboard-accessible buttons
* text alternatives
* sufficient contrast
* non-map method of discovering colleges

The map should not be the only navigation mechanism.

---

# Mobile

Assume a large percentage of students will use mobile.

Do not treat mobile as desktop compressed into a small viewport.

Mobile interaction should support:

* map exploration
* bottom-sheet college previews
* thumb-friendly controls
* easy save/share
* readable college pages
* responsive Street View

---

# Images and Copyright

Do NOT automatically scrape:

* university websites
* Niche
* Google Images
* Instagram
* copyrighted photography

Do not assume online images are reusable.

Prefer:

* official embeds
* properly licensed images
* user-contributed images with appropriate rights
* original assets
* maps / Street View through approved APIs

---

# University Descriptions

Do NOT mass-generate generic AI descriptions such as:

> "Stanford is a prestigious institution located in California..."

That creates low-value pages and factual-risk.

If editorial summaries exist, they should be:

* short
* useful
* manually reviewed
* genuinely descriptive

Data + interaction should carry most pages.

---

# Monetization

Do NOT optimize V1 around money.

Traffic and engagement first.

Potential later monetization:

## Display Ads

Ads on informational college/state pages.

Avoid destroying the map experience.

---

## Affiliate Revenue

Potential categories:

* student housing
* SAT/ACT prep
* college visit travel
* banking
* student products
* international student services

Affiliate placements must be contextual and clearly disclosed.

---

## One-Time Premium Products

Potential later examples:

College Visit Planner

Family College Exploration Pack

Synced shortlist

Advanced comparison

Do not build these before validating traffic.

---

## Payments

If/when payments are added:

Possible providers:

* Razorpay
* Paddle
* Stripe only if India access is available

Payments must use:

* hosted/official checkout
* webhooks
* server-side entitlement verification

Never trust client-side payment success alone.

Never store raw payment-card information.

---

# Authentication

Do NOT add auth in V1.

Add auth only once users clearly need:

* cloud saved colleges
* synced comparisons
* parent/student collaboration
* notes
* contributions

Do not build:

* password reset
* social auth
* profile pages

until necessary.

---

# Community Contributions

Possible future moat.

Users may eventually submit:

* campus locations
* student-life spots
* dorm insights
* neighborhood information
* corrections

Do not implement this in V1.

If implemented later, all submissions require moderation.

Never automatically publish user-submitted factual data.

---

# Admin Tool

Eventually build a lightweight internal editor for curated colleges.

Admin should support:

* search college
* mark featured
* add/edit campus tour points
* verify coordinates
* add official video
* add editorial summary
* preview college page

Do not build the admin panel before the public vertical slice works.

Initially curated data may be maintained in files.

---

# MVP Vertical Slice

Before scaling nationally, build one complete working flow.

Example:

Homepage
→ US map
→ California
→ UCLA marker
→ UCLA page
→ Campus Explorer
→ Street View
→ Save
→ Teleport

This vertical slice must feel excellent.

Only after it works should we scale the architecture to thousands of colleges.

---

# Development Phases

## Phase 1 — Foundation

* initialize project
* TypeScript
* Astro
* Tailwind
* linting
* formatting
* basic deployment
* error handling
* environment variable strategy

---

## Phase 2 — Data

* College Scorecard ingestion
* normalization
* validation
* college schema
* slugs
* state grouping
* search index

---

## Phase 3 — Map

* MapLibre
* US map
* college coordinates
* clustering
* map interactions
* mobile bottom sheet

---

## Phase 4 — College Pages

* dynamic/static generation
* college facts
* location map
* responsive page architecture

---

## Phase 5 — Campus Explorer

* Google Maps Embed
* Street View
* curated tour-point system
* first manually curated colleges

---

## Phase 6 — Discovery

* Teleport Me
* nearby colleges
* state discovery
* related colleges

---

## Phase 7 — Save & Compare

* localStorage
* save
* shortlist
* comparison

---

## Phase 8 — SEO

* metadata
* sitemap
* structured data
* canonical URLs
* state pages
* performance

---

## Phase 9 — Analytics

Implement analytics and product metrics.

---

## Phase 10 — Launch

Launch only once:

* national dataset works
* map works
* college pages exist
* mobile works
* campus exploration works
* analytics works
* no obvious broken states

---

# Coding Rules

## Rule 1

Do not overengineer.

Choose the simplest architecture that can reasonably support the next stage.

---

## Rule 2

Do not introduce new dependencies without a clear reason.

Explain why a new dependency is required before adding it.

---

## Rule 3

Prefer deterministic code over AI inference whenever possible.

Especially for:

* admissions data
* coordinates
* costs
* rankings
* outcomes

---

## Rule 4

Never fabricate data.

If information is unavailable:

show nothing or:

> Data unavailable.

---

## Rule 5

Do not silently rewrite large architectural areas.

If a change affects multiple major systems, explain the change first.

---

## Rule 6

Do not create features that are not part of the current milestone.

If a potentially useful feature appears, add it to TODO rather than implementing it.

---

## Rule 7

Keep components reasonably small.

Avoid giant 1,000+ line components.

Extract repeated logic.

---

## Rule 8

Use strict TypeScript.

Avoid `any` unless absolutely necessary.

---

## Rule 9

Handle failure states.

External embed/API failure should not destroy the whole page.

---

## Rule 10

Protect secrets.

Never expose private API keys in client-side code unless the provider explicitly expects a browser-restricted public key.

Use environment variables.

---

# Claude Code Working Style

When given a task:

1. Inspect the existing project.
2. Understand existing architecture.
3. State a concise implementation approach.
4. Modify only relevant files.
5. Run appropriate checks/tests.
6. Fix errors.
7. Summarize what changed.
8. Mention any unresolved issues.

Do not repeatedly ask for permission for routine implementation decisions.

Do ask before:

* replacing major frameworks
* deleting major functionality
* changing the data model substantially
* adding paid infrastructure
* introducing auth
* adding a database
* changing deployment provider

---

# Git Workflow

Work incrementally.

After each meaningful working milestone, recommend a commit.

Example commit messages:

```text
feat: add College Scorecard data importer
feat: render clustered colleges on US map
feat: generate college profile pages
feat: add Street View campus explorer
feat: add local college saving
feat: add teleport discovery
perf: optimize map dataset loading
seo: add college structured data and sitemap
```

Do not accumulate huge unrelated changes into one commit.

---

# Testing

At minimum test:

* data normalization
* missing values
* slug generation
* college page generation
* state grouping
* search
* localStorage logic
* comparison logic

Manually verify map behavior on:

* desktop Chrome
* mobile viewport
* Safari-compatible behavior where relevant

---

# Data Quality Checks

Import pipeline should flag:

* missing coordinates
* duplicate IDs
* duplicate slugs
* impossible admission rates
* impossible tuition values
* invalid coordinates
* malformed websites
* missing states

Generate a report after import.

Example:

```text
Imported: 2,684
Missing coordinates: 23
Missing admission rate: 614
Duplicate slug collisions: 4
Invalid URLs: 18
```

Do not silently discard problematic records.

---

# Design Principle

Whenever deciding between:

A. showing more statistics

and

B. making exploration feel more immersive

prefer B unless the statistics materially help the student's decision.

This product succeeds if students say:

> “I spent 30 minutes just exploring colleges.”

Not:

> “It has a lot of fields.”

---

# Product North Star

The core metric should eventually be something like:

> **Meaningful colleges explored per active user.**

Secondary metrics:

* campus-explorer opens
* saved colleges
* return visits
* shares
* comparisons
* organic traffic growth

---

# Anti-Goals

We are NOT building:

* CollegeVine
* Niche
* Common App
* admissions consulting software
* essay-writing AI
* university CRM
* ranking engine
* admissions chance calculator
* social network
* worldwide university database
* scholarship marketplace

Do not drift into those categories without explicit product discussion.

---

# Immediate First Task

Before implementing the full site:

1. Set up the project foundation.
2. Build a small College Scorecard import script.
3. Import enough data for approximately 20 institutions.
4. Build the complete vertical slice:

US map
→ select California
→ UCLA
→ UCLA profile
→ campus Street View
→ save UCLA
→ Teleport to another college.

The purpose is to validate the architecture and interaction model.

Do NOT scale to the full national dataset until this vertical slice works cleanly.

---

# Final Rule

The purpose of Claude Code is to make us faster.

It must not encourage us to build more.

Whenever possible:

**ship the smallest coherent version, test it, then expand.**
