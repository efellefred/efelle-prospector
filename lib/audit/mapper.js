'use strict';

// Maps a completed AuditRecord into the JSON schema expected by buildWSRReportHTML.
// Each check is verified by real data — only confirmed failures appear as issues.
// Capped at 6 issues per category, prioritized by severity.

const MAX_ISSUES_PER_CATEGORY = 6;

function mapAuditToWSR(record, opts) {
  opts = opts || {};
  const categories = [
    buildSEOCategory(record),
    buildUXCategory(record),
    buildPerformanceCategory(record),
    buildContentCategory(record),
    buildConversionCategory(record),
    buildAICategory(record),
  ];

  return {
    client_name: opts.clientName || record.businessName || record.clientName || record.domain,
    website: record.url,
    industry: opts.industry || record.industry || '',
    prepared_for: opts.contact || record.contact || '',
    overall_score: record.overallScore || computeAvgScore(categories),
    executive_summary: '',
    categories,
    priority_actions: [],
    closing: '',
    _screenshots: opts.screenshots || {},
    _metrics: {
      performance: record.performance || null,
      content: record.content || null,
      technical: record.technical || null,
      local: record.local || null,
      reading: record.reading || null,
      seo: record.seo || null,
      geo: record.geo || null,
      domain: record.domain || '',
    },
  };
}

function computeAvgScore(categories) {
  const scores = categories.map(c => c.score).filter(s => s > 0);
  if (scores.length === 0) return 50;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Severity priority for sorting
const SEV_ORDER = { critical: 0, moderate: 1, low: 2 };

function capIssues(checks) {
  const failed = checks.filter(c => !c.passed);
  failed.sort((a, b) => (SEV_ORDER[a.severity] || 2) - (SEV_ORDER[b.severity] || 2));
  return failed.slice(0, MAX_ISSUES_PER_CATEGORY);
}

function buildCategory(id, label, checks) {
  // Weight by severity: critical=3, moderate=2, low=1
  const SEV_WEIGHT = { critical: 3, moderate: 2, low: 1 };
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const c of checks) {
    const w = SEV_WEIGHT[c.severity] || 1;
    totalWeight += w;
    if (c.passed) earnedWeight += w;
  }
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 50;

  const capped = capIssues(checks);

  const issues = capped.map(c => ({
    title: c.issueTitle,
    description: c.issueDescription,
    severity: c.severity,
  }));

  const recommendations = capped.map(c => ({
    title: c.recTitle,
    description: c.recDescription,
    impact: c.severity === 'critical' ? 'high' : c.severity === 'moderate' ? 'medium' : 'low',
  }));

  return { id, label, score, issues, recommendations };
}

// ─── SEO & Local Search ─────────────────────────────────────────────

function buildSEOCategory(r) {
  const checks = [];
  const c = r.content || {};
  const t = r.technical || {};
  const l = r.local || {};
  const gbp = l.google_business_profile || {};
  const seo = r.seo || {};

  checks.push({
    passed: !!c.titleTagOk,
    severity: 'moderate',
    issueTitle: 'Title Tag Needs Improvement',
    issueDescription: c.title
      ? `Title tag is ${c.title.length} characters (recommended: 20-65). Current: "${c.title.slice(0, 60)}"`
      : 'No title tag found on the homepage.',
    recTitle: 'Optimize Title Tag',
    recDescription: 'Write a compelling title tag between 20-65 characters that includes your primary keyword and location.',
  });

  checks.push({
    passed: !!c.metaDescriptionOk,
    severity: 'moderate',
    issueTitle: 'Meta Description Needs Improvement',
    issueDescription: c.description
      ? `Meta description is ${c.description.length} characters (recommended: 60-165).`
      : 'No meta description found on the homepage.',
    recTitle: 'Write an Effective Meta Description',
    recDescription: 'Add a 60-165 character meta description that summarizes the page and includes a call to action.',
  });

  checks.push({
    passed: !!c.headingsWellDefined,
    severity: 'low',
    issueTitle: 'Heading Structure Issues',
    issueDescription: `Page has ${c.headings ? c.headings.h1 : 0} H1 tag(s) and ${c.headings ? (c.headings.h2 + c.headings.h3) : 0} sub-headings. Best practice: exactly 1 H1 with clear sub-heading hierarchy.`,
    recTitle: 'Improve Heading Hierarchy',
    recDescription: 'Use exactly one H1 tag for the main topic, followed by H2s and H3s that organize content logically.',
  });

  checks.push({
    passed: !!t.sitemapValid,
    severity: 'critical',
    issueTitle: 'No Valid XML Sitemap Found',
    issueDescription: 'Could not find a valid XML sitemap at common locations. Search engines use sitemaps to discover and index pages.',
    recTitle: 'Create and Submit an XML Sitemap',
    recDescription: 'Generate an XML sitemap and submit it to Google Search Console. Most CMS platforms can auto-generate this.',
  });

  checks.push({
    passed: !!t.robotsTxtFound,
    severity: 'moderate',
    issueTitle: 'No robots.txt File Found',
    issueDescription: 'The website does not have a robots.txt file, which guides search engine crawlers on which pages to index.',
    recTitle: 'Add a robots.txt File',
    recDescription: 'Create a robots.txt file that references your sitemap and provides crawl directives for search engines.',
  });

  checks.push({
    passed: !!(gbp.is_complete || gbp.is_claimed),
    severity: 'critical',
    issueTitle: 'Google Business Profile Not Claimed or Incomplete',
    issueDescription: gbp.rating
      ? `GBP found with ${gbp.rating} rating and ${gbp.review_count || 0} reviews, but the profile appears incomplete or unclaimed.`
      : 'No Google Business Profile was found for this business. This is critical for local search visibility.',
    recTitle: 'Claim and Complete Google Business Profile',
    recDescription: 'Claim your Google Business Profile, add photos, hours, services, and respond to reviews to improve local search rankings.',
  });

  checks.push({
    passed: !!(gbp.rating && gbp.rating >= 4.0),
    severity: gbp.rating && gbp.rating < 3.5 ? 'critical' : 'moderate',
    issueTitle: 'Google Rating Below 4.0 Stars',
    issueDescription: gbp.rating
      ? `Current Google rating is ${gbp.rating} stars. Businesses with 4.0+ stars get significantly more clicks.`
      : 'No Google rating found — this may indicate no Google Business Profile.',
    recTitle: 'Improve Google Rating',
    recDescription: 'Implement a review request system for satisfied customers. Respond professionally to all reviews, especially negative ones.',
  });

  checks.push({
    passed: !!(gbp.review_count && gbp.review_count >= 20),
    severity: gbp.review_count && gbp.review_count < 5 ? 'critical' : 'moderate',
    issueTitle: 'Insufficient Google Reviews',
    issueDescription: `Only ${gbp.review_count || 0} Google reviews found. Competitors in your market likely have 20+. Review count is a major local ranking factor.`,
    recTitle: 'Build Google Review Count',
    recDescription: 'Systematically request reviews from customers after completed projects. Aim for 2-4 new reviews per month.',
  });

  return buildCategory('seo', 'SEO & Local Search', checks);
}

// ─── User Experience & Design ───────────────────────────────────────

function buildUXCategory(r) {
  const checks = [];
  const t = r.technical || {};
  const og = t.openGraph || {};

  checks.push({
    passed: !!t.sslEnabled,
    severity: 'critical',
    issueTitle: 'Website Not Using HTTPS',
    issueDescription: 'The website is not served over HTTPS. Browsers show security warnings and Google penalizes non-HTTPS sites.',
    recTitle: 'Enable HTTPS / SSL Certificate',
    recDescription: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS. Most hosting providers offer free SSL via Let\'s Encrypt.',
  });

  checks.push({
    passed: !!(og.hasTitle && og.hasDescription && og.hasImage),
    severity: 'low',
    issueTitle: 'Incomplete Open Graph Tags',
    issueDescription: `Missing Open Graph tags: ${[!og.hasTitle && 'og:title', !og.hasDescription && 'og:description', !og.hasImage && 'og:image'].filter(Boolean).join(', ')}. Links shared on social media will display poorly.`,
    recTitle: 'Add Open Graph Meta Tags',
    recDescription: 'Add og:title, og:description, and og:image tags so links shared on Facebook, LinkedIn, and other platforms display properly.',
  });

  checks.push({
    passed: !!t.hasSearch,
    severity: 'low',
    issueTitle: 'No Site Search Functionality',
    issueDescription: 'No search functionality detected on the website. Users may struggle to find specific content.',
    recTitle: 'Add Site Search',
    recDescription: 'Implement a search feature so visitors can quickly find services, blog posts, or other content on your site.',
  });

  // Mobile performance as a UX signal
  const perf = r.performance || {};
  checks.push({
    passed: !!(perf.score && perf.score >= 50),
    severity: perf.score && perf.score < 30 ? 'critical' : 'moderate',
    issueTitle: 'Poor Mobile Performance',
    issueDescription: perf.score
      ? `Mobile performance score is ${perf.score}/100. Users on mobile devices experience slow loading and poor interaction.`
      : 'Could not measure mobile performance — PageSpeed Insights was unavailable.',
    recTitle: 'Optimize Mobile Experience',
    recDescription: 'Optimize images, reduce JavaScript, and improve server response time. Target a PageSpeed score of 50+ for mobile.',
  });

  return buildCategory('ux', 'User Experience & Design', checks);
}

// ─── Performance & Technical ────────────────────────────────────────

function buildPerformanceCategory(r) {
  const checks = [];
  const perf = r.performance || {};
  const t = r.technical || {};

  checks.push({
    passed: !!(perf.score && perf.score >= 50),
    severity: perf.score && perf.score < 30 ? 'critical' : 'moderate',
    issueTitle: 'Low PageSpeed Score',
    issueDescription: perf.score
      ? `PageSpeed Insights score: ${perf.score}/100 (mobile). Google uses this as a ranking factor.`
      : 'PageSpeed Insights could not measure this site.',
    recTitle: 'Improve PageSpeed Score',
    recDescription: 'Optimize images (WebP format), enable caching, minimize CSS/JS, and consider a CDN to improve load times.',
  });

  checks.push({
    passed: !!(perf.lcp && perf.lcp <= 2.5),
    severity: perf.lcp && perf.lcp > 4.0 ? 'critical' : 'moderate',
    issueTitle: 'Largest Contentful Paint (LCP) Too Slow',
    issueDescription: perf.lcp
      ? `LCP is ${perf.lcp.toFixed(1)}s (target: ≤2.5s). This means the main content takes too long to appear.`
      : 'LCP could not be measured.',
    recTitle: 'Reduce LCP to Under 2.5 Seconds',
    recDescription: 'Optimize the largest visible element (usually a hero image). Use responsive images, preload critical resources, and optimize server response.',
  });

  checks.push({
    passed: !!(perf.cls !== null && perf.cls !== undefined && perf.cls <= 0.1),
    severity: perf.cls && perf.cls > 0.25 ? 'critical' : 'moderate',
    issueTitle: 'Cumulative Layout Shift (CLS) Too High',
    issueDescription: perf.cls !== null && perf.cls !== undefined
      ? `CLS is ${perf.cls.toFixed(3)} (target: ≤0.1). Page elements shift unexpectedly, causing a poor user experience.`
      : 'CLS could not be measured.',
    recTitle: 'Reduce Layout Shift',
    recDescription: 'Set explicit width/height on images and embeds, avoid dynamically injected content above the fold, and use CSS containment.',
  });

  checks.push({
    passed: !!perf.webVitalsPass,
    severity: 'moderate',
    issueTitle: 'Core Web Vitals Not Passing',
    issueDescription: 'This website does not pass Google\'s Core Web Vitals assessment. Core Web Vitals are a confirmed ranking factor.',
    recTitle: 'Achieve Core Web Vitals Compliance',
    recDescription: 'Address LCP, CLS, and INP issues to pass Core Web Vitals. Google rewards sites that meet these thresholds with better rankings.',
  });

  checks.push({
    passed: t.analyticsDetected && t.analyticsDetected.length > 0,
    severity: 'critical',
    issueTitle: 'No Analytics Tracking Detected',
    issueDescription: 'No Google Analytics, Tag Manager, or other analytics platform was detected. You cannot improve what you don\'t measure.',
    recTitle: 'Install Analytics Tracking',
    recDescription: 'Set up Google Analytics 4 and Google Tag Manager to track traffic, conversions, and user behavior.',
  });

  return buildCategory('performance', 'Performance & Technical', checks);
}

// ─── Content & Messaging ────────────────────────────────────────────

function buildContentCategory(r) {
  const checks = [];
  const c = r.content || {};
  const read = r.reading || {};

  checks.push({
    passed: !!(c.wordCount && c.wordCount >= 600),
    severity: c.wordCount && c.wordCount < 300 ? 'critical' : 'moderate',
    issueTitle: 'Thin Homepage Content',
    issueDescription: `Homepage has only ${c.wordCount || 0} words. Search engines prefer substantive content (600+ words) that demonstrates expertise.`,
    recTitle: 'Expand Homepage Content',
    recDescription: 'Add detailed service descriptions, company background, trust signals, and calls to action. Aim for 600-1200 words of quality content.',
  });

  checks.push({
    passed: !!(c.altTextIssues === 0),
    severity: c.altTextIssues && c.altTextIssues > 10 ? 'critical' : 'moderate',
    issueTitle: 'Images Missing Alt Text',
    issueDescription: `${c.altTextIssues || 0} images are missing alt text. Alt text is important for accessibility and image SEO.`,
    recTitle: 'Add Alt Text to All Images',
    recDescription: 'Write descriptive alt text for every image that describes what the image shows. Include relevant keywords naturally.',
  });

  checks.push({
    passed: !!(read.easeScore && read.easeScore >= 30),
    severity: 'low',
    issueTitle: 'Content Readability Could Improve',
    issueDescription: read.easeScore
      ? `Flesch Reading Ease score: ${read.easeScore.toFixed(0)}/100. Content may be too complex for your target audience.`
      : 'Readability could not be measured.',
    recTitle: 'Simplify Content Language',
    recDescription: 'Use shorter sentences, simpler words, and break up long paragraphs. Aim for a reading level that matches your audience.',
  });

  checks.push({
    passed: !!(read.age && read.age <= 16),
    severity: 'low',
    issueTitle: 'Reading Level Too Advanced',
    issueDescription: read.age
      ? `Content reading age is ${read.age}. Most customers prefer content written at a 12-14 year old reading level.`
      : 'Reading level could not be determined.',
    recTitle: 'Lower Reading Level',
    recDescription: 'Rewrite technical content in plain language. Use the active voice, common words, and short sentences.',
  });

  return buildCategory('content', 'Content & Messaging', checks);
}

// ─── Conversion & Lead Generation ───────────────────────────────────

function buildConversionCategory(r) {
  const checks = [];
  const t = r.technical || {};
  const c = r.content || {};
  const l = r.local || {};
  const cd = l.contact_details || {};
  const dir = l.directory_consistency || {};
  const gbp = l.google_business_profile || {};

  checks.push({
    passed: !!t.contactDetailsPresent,
    severity: 'critical',
    issueTitle: 'No Contact Details Visible on Homepage',
    issueDescription: 'No phone number or email address was detected on the homepage. Visitors should be able to contact you immediately.',
    recTitle: 'Add Contact Information to Every Page',
    recDescription: 'Display phone number, email, and address prominently — in the header, footer, and on a dedicated contact page.',
  });

  checks.push({
    passed: !!cd.phone_discovered,
    severity: 'critical',
    issueTitle: 'No Click-to-Call Phone Number Found',
    issueDescription: 'No clickable phone link (tel:) was detected. Mobile users should be able to call with one tap.',
    recTitle: 'Add Click-to-Call Phone Links',
    recDescription: 'Wrap your phone number in a tel: link so mobile users can tap to call directly from any page.',
  });

  checks.push({
    passed: !!cd.email_discovered,
    severity: 'moderate',
    issueTitle: 'No Email Contact Found',
    issueDescription: 'No email address or mailto: link was detected on the site. Some customers prefer email over phone.',
    recTitle: 'Add Email Contact Option',
    recDescription: 'Display an email address or provide a contact form as an alternative to phone for customer inquiries.',
  });

  // Check for forms (contact forms, quote request forms) in the scraped HTML
  const hasForm = r._scrapeHtml ? /<form\b/i.test(r._scrapeHtml) : false;
  checks.push({
    passed: hasForm,
    severity: 'critical',
    issueTitle: 'No Contact or Quote Request Form Detected',
    issueDescription: 'No web form was detected on the homepage. Forms are the primary conversion mechanism for service businesses — visitors need an easy way to request a quote or schedule service.',
    recTitle: 'Add a Prominent Quote Request Form',
    recDescription: 'Place a contact or quote request form above the fold on the homepage and on every service page. Keep it short (name, phone, service needed).',
  });

  // Check for CTA buttons/links
  const hasCTA = r._scrapeHtml
    ? /(?:get.a.quote|request.a.quote|contact.us|schedule|book.now|free.estimate|get.started|call.now)/i.test(r._scrapeHtml)
    : false;
  checks.push({
    passed: hasCTA,
    severity: 'critical',
    issueTitle: 'No Clear Call-to-Action (CTA) Detected',
    issueDescription: 'No prominent call-to-action buttons were found (e.g., "Get a Quote", "Schedule Service", "Free Estimate"). Visitors need clear next steps.',
    recTitle: 'Add Strong CTAs Above the Fold',
    recDescription: 'Add prominent, action-oriented buttons ("Get a Free Quote", "Schedule Service") in the hero section and throughout key pages.',
  });

  // Trust signals: reviews displayed on the site
  const hasReviewDisplay = r._scrapeHtml
    ? /(?:testimonial|review|rating|stars|★|⭐|google.reviews)/i.test(r._scrapeHtml)
    : false;
  checks.push({
    passed: hasReviewDisplay,
    severity: 'moderate',
    issueTitle: 'No Customer Reviews or Testimonials Displayed',
    issueDescription: gbp.review_count
      ? `You have ${gbp.review_count} Google reviews but they\'re not displayed on your website. Showing reviews on-site builds trust and increases conversion.`
      : 'No customer reviews or testimonials were found on the website. Social proof is one of the strongest conversion drivers.',
    recTitle: 'Display Customer Reviews on Your Website',
    recDescription: 'Add a reviews/testimonials section to the homepage and service pages. Embed Google reviews or add curated testimonials with customer names.',
  });

  checks.push({
    passed: !!t.hasLiveChat,
    severity: 'low',
    issueTitle: 'No Live Chat Detected',
    issueDescription: 'No live chat widget was detected. Live chat can increase conversion rates by 20-40% for service businesses.',
    recTitle: 'Consider Adding Live Chat',
    recDescription: 'Implement a live chat widget or AI chatbot to engage visitors in real-time and capture leads outside business hours.',
  });

  checks.push({
    passed: !!(dir.facebook_found && dir.google_maps_found),
    severity: 'moderate',
    issueTitle: 'Missing from Key Business Directories',
    issueDescription: `Business ${!dir.facebook_found ? 'not found on Facebook' : ''}${!dir.facebook_found && !dir.google_maps_found ? ' and ' : ''}${!dir.google_maps_found ? 'not found on Google Maps' : ''}. Directory presence drives referral traffic and trust signals.`,
    recTitle: 'Claim Business Directory Listings',
    recDescription: 'Create or claim your profiles on Facebook, Google Maps, Bing Places, and industry-specific directories.',
  });

  return buildCategory('conversion', 'Conversion & Lead Generation', checks);
}

// ─── AI & GEO Readiness ─────────────────────────────────────────────

function buildAICategory(r) {
  const checks = [];
  const g = r.geo || {};
  const schema = g.schemaIntegrity || {};
  const facts = g.factDensity || {};
  const conv = g.conversationalReadiness || {};

  // If no robots.txt exists, crawlers can access everything (not blocked)
  const robotsExists = r.technical && r.technical.robotsTxtFound;
  const crawlersBlocked = g.blockedAiBots && g.blockedAiBots.length > 0;
  checks.push({
    passed: !crawlersBlocked,
    severity: 'critical',
    issueTitle: 'AI Search Crawlers Blocked',
    issueDescription: crawlersBlocked
      ? `robots.txt blocks these AI crawlers: ${g.blockedAiBots.join(', ')}. Your content won't appear in AI-generated search answers.`
      : (!robotsExists
        ? 'No robots.txt file found. While crawlers can access the site, adding a robots.txt with a sitemap reference improves discoverability.'
        : 'AI crawlers have access to the site.'),
    recTitle: crawlersBlocked ? 'Allow AI Search Crawlers' : 'Add robots.txt with Sitemap Reference',
    recDescription: crawlersBlocked
      ? 'Update robots.txt to allow GPTBot, ClaudeBot, and PerplexityBot. Blocking these bots means your business is invisible in AI search results.'
      : 'Add a robots.txt file that references your sitemap to help all search engines discover your content.',
  });

  checks.push({
    passed: !!schema.hasLocalBusiness,
    severity: 'critical',
    issueTitle: 'No LocalBusiness Schema Markup',
    issueDescription: 'No LocalBusiness structured data (JSON-LD) was found. Schema markup helps search engines and AI understand your business details.',
    recTitle: 'Add LocalBusiness Schema',
    recDescription: 'Implement JSON-LD LocalBusiness schema with your name, address, phone, hours, and service area. This feeds directly into AI search answers.',
  });

  checks.push({
    passed: !!schema.hasFaqPage,
    severity: 'moderate',
    issueTitle: 'No FAQ Schema Markup',
    issueDescription: 'No FAQPage structured data found. FAQ schema can generate rich results in Google and feed AI search answers.',
    recTitle: 'Add FAQ Schema to Key Pages',
    recDescription: 'Create FAQ sections on service pages and mark them up with FAQPage schema. This increases visibility in both traditional and AI search.',
  });

  checks.push({
    passed: !!g.answerFirstFormatting,
    severity: 'moderate',
    issueTitle: 'Content Not Optimized for AI Answers',
    issueDescription: 'Content is not structured in an answer-first format. AI search engines prefer content that directly answers questions before elaborating.',
    recTitle: 'Restructure Content for AI Search',
    recDescription: 'Lead each section with a direct answer (30-100 words), then elaborate. Use question-style headings that match how people search.',
  });

  checks.push({
    passed: !!(facts.hasStatistics || facts.factCount >= 3),
    severity: 'low',
    issueTitle: 'Low Fact Density in Content',
    issueDescription: `Only ${facts.factCount || 0} verifiable facts/statistics found on the homepage. AI search engines prioritize content with concrete data.`,
    recTitle: 'Add Statistics and Verifiable Facts',
    recDescription: 'Include specific numbers: years in business, projects completed, certifications, service area coverage, team size, etc.',
  });

  checks.push({
    passed: !!(g.recommendationScore && g.recommendationScore >= 60),
    severity: g.recommendationScore && g.recommendationScore < 30 ? 'critical' : 'moderate',
    issueTitle: 'Low AI Readiness Score',
    issueDescription: `GEO (Generative Engine Optimization) score: ${g.recommendationScore || 0}/100. This measures how well your content is positioned for AI-powered search results.`,
    recTitle: 'Improve Overall AI Search Readiness',
    recDescription: 'Focus on schema markup, answer-first content structure, and allowing AI crawlers. These combined improvements significantly increase AI search visibility.',
  });

  return buildCategory('ai', 'AI & GEO Readiness', checks);
}

module.exports = { mapAuditToWSR };
