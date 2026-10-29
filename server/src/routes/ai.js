import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import AgentTask from '../models/AgentTask.js';
import { requireAuth } from '../middleware/auth.js';
import { Router } from 'express';
import mongoose from 'mongoose';
const router = Router();

function cleanPrivateDetails(value) {
  return String(value || '')
    .replace(/\b(my address is|phone number is|student id is|student ID is|password is|OTP is)\b[^,.]*/ig, '[private detail removed]')
    .replace(/\s+/g, ' ').trim().slice(0, 1000);
}
function inferCategory(text) {
  const s = text.toLowerCase();
  const rules = [
    ['Electronics', /phone|mobile|laptop|charger|headphone|earbud|tablet|watch|mouse|keyboard|usb|camera/],
    ['Stationery', /notebook|book|pen|pencil|folder|notes|calculator|stationery/],
    ['Keys', /key|keychain|key ring/],
    ['Clothing', /jacket|hoodie|shirt|coat|sweater|cap|scarf|clothing/],
    ['Accessories', /wallet|purse|bag|backpack|card holder|glasses|spectacles|umbrella/],
    ['Personal items', /bottle|lunchbox|tiffin|water flask|id card|identity card/]
  ];
  return rules.find(([, re]) => re.test(s))?.[0] || 'Other';
}
function makeTitle(text, category) {
  const words = cleanPrivateDetails(text).replace(/[.!?].*$/, '').split(' ').filter(Boolean).slice(0, 7);
  const candidate = words.join(' ').replace(/^./, c => c.toUpperCase());
  return candidate.length >= 4 ? candidate.slice(0, 70) : `${category} item`;
}
router.post('/assist', async (req, res) => {
  const description = cleanPrivateDetails(req.body.description);
  if (!description) return res.status(400).json({ message: 'Enter a description first.' });
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Rewrite this campus lost-and-found item description in concise neutral language. Do not invent facts or include personal contact details. Return only the description. Text: ${description}` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 180 } })
      });
      if (!r.ok) throw new Error('Gemini unavailable');
      const data = await r.json();
      const suggestion = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (suggestion) return res.json({ suggestion: cleanPrivateDetails(suggestion), provider: 'gemini', fallback: false });
    } catch { /* local fallback below */ }
  }
  const suggestion = cleanPrivateDetails(description).replace(/^./, c => c.toUpperCase());
  res.json({ suggestion, provider: 'local-fallback', fallback: true, note: 'Local cleanup used; Gemini is optional.' });
});

// Local-first AI-style helper: no API key or paid service required.
router.post('/analyze', async (req, res) => {
  const description = cleanPrivateDetails(req.body.description);
  const suppliedTitle = cleanPrivateDetails(req.body.title || '');
  if (description.length < 8) return res.status(400).json({ message: 'Write at least a short description before analysing.' });
  const category = inferCategory(`${suppliedTitle} ${description}`);
  const title = suppliedTitle || makeTitle(description, category);
  const lower = description.toLowerCase();
  const colors = ['black','white','blue','red','green','silver','grey','gray','pink','purple','brown','yellow'];
  const color = colors.find(c => new RegExp(`\\b${c}\\b`, 'i').test(lower));
  const keywords = [...new Set((`${title} ${description}`.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(w => !['the','and','with','near','was','found','lost','item','this','that'].includes(w)))].slice(0, 8);
  const tips = [];
  if (!color) tips.push('Add the item colour if you know it to improve matching.');
  if (!/near|block|library|canteen|gate|floor|room|ground|hostel|auditorium|parking/i.test(description)) tips.push('Add an approximate campus area, such as the library or canteen.');
  if (/student id|identity card|wallet|phone|laptop|passport|bank|address|phone number/i.test(lower)) tips.push('Keep serial numbers, ID numbers and private proof details out of the public description.');
  if (!tips.length) tips.push('Your description includes useful details. Review it to ensure it contains no private information.');
  res.json({ title: title.slice(0,70), category, keywords, tips, provider: 'local-analyzer', fallback: true, disclaimer: 'Suggestions are automatic estimates; review them before publishing.' });
});


// Campus recovery copilot: searches actual public MongoDB reports first, then optionally
// asks Gemini to summarize only those public results. Local ranking always works without a key.
function tokens(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [])]
    .filter(word => !['the','and','for','near','was','with','from','that','this','have','lost','found','item','nearby','yesterday'].includes(word));
}
function rankReport(query, item) {
  const q = tokens(query);
  const title = tokens(item.title);
  const description = tokens(item.description);
  const location = tokens(item.location);
  const matched = q.filter(word => title.includes(word) || description.includes(word) || location.includes(word) || String(item.category || '').toLowerCase().includes(word));
  const exactCategory = String(query).toLowerCase().includes(String(item.category || '').toLowerCase());
  const locationHits = q.filter(word => location.includes(word));
  const score = Math.min(98, Math.round((matched.length / Math.max(q.length, 3)) * 75 + (exactCategory ? 12 : 0) + (locationHits.length ? 10 : 0)));
  const reasons = [];
  if (matched.length) reasons.push(`Shares ${matched.slice(0, 4).join(', ')}`);
  if (exactCategory) reasons.push(`Category may fit: ${item.category}`);
  if (locationHits.length) reasons.push('Location clue overlaps');
  return { score, reasons: reasons.length ? reasons : ['General report candidate; check details manually'] };
}
router.post('/recovery-assistant', async (req, res) => {
  const query = cleanPrivateDetails(req.body.query || '').slice(0, 500);
  if (query.length < 5) return res.status(400).json({ message: 'Describe the item and any clue you remember (at least 5 characters).' });
  try {
    const reports = await Item.find({ status: { $nin: ['returned'] }, hidden: { $ne: true } })
      .select('title type category description location date status createdAt')
      .sort({ createdAt: -1 }).limit(250).lean();
    const ranked = reports.map(item => ({ item, ...rankReport(query, item) }))
      .filter(result => result.score >= 12)
      .sort((a, b) => b.score - a.score).slice(0, 6);
    let assistantMessage = ranked.length
      ? `I found ${ranked.length} possible report${ranked.length === 1 ? '' : 's'} in the campus feed. Review the reasons and verify ownership privately before arranging a handover.`
      : 'I could not find a strong match in current reports. Try adding the item colour, category, or an approximate MIT-WPU campus location, or create a lost-item report.';
    let provider = 'local-recovery-engine';
    if (process.env.GEMINI_API_KEY && ranked.length) {
      try {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        const publicCandidates = ranked.map(({item, score, reasons}) => ({title:item.title,type:item.type,category:item.category,description:item.description,location:item.location,score,reasons}));
        const prompt = `You are TraceMate, a cautious campus lost-and-found assistant. Answer in 2-4 short sentences using ONLY these public candidate reports. Do not claim ownership is verified, do not reveal private data, and recommend a staffed public handover point. User query: ${query}\nCandidates JSON: ${JSON.stringify(publicCandidates)}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:180}})
        });
        if (!response.ok) throw new Error('Gemini unavailable');
        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
        if (answer) { assistantMessage = cleanPrivateDetails(answer).slice(0, 900); provider = 'gemini-grounded-summary'; }
      } catch { /* deterministic results remain available */ }
    }
    res.json({ assistantMessage, provider, matches: ranked.map(({item,score,reasons}) => ({ _id:item._id, title:item.title, type:item.type, category:item.category, description:item.description, location:item.location, date:item.date, status:item.status, score, reasons })), disclaimer: 'AI suggestions can be wrong. Verify an item privately; never share OTPs, student IDs or sensitive proof in public.' });
  } catch (error) {
    res.status(500).json({ message: 'The recovery assistant could not search reports right now.' });
  }
});


// Agentic workflow: inspect live records, create a persistent action plan, and let
// the signed-in user approve completion/dismissal. The agent never changes item/claim
// ownership or marks an item returned automatically.
router.get('/agent/tasks', requireAuth, async (req, res) => {
  const [tasks, ownItems, claims] = await Promise.all([
    AgentTask.find({ owner: req.user.sub }).sort({ status: 1, priority: 1, createdAt: -1 }).limit(100).lean(),
    Item.find({ owner: req.user.sub }).select('status type').lean(),
    Claim.find({ claimant: req.user.sub, status: 'pending' }).select('status').lean()
  ]);
  const claimsToReview = await Claim.countDocuments({ item: { $in: ownItems.map(i => i._id) }, status: 'pending' });
  res.json({ tasks, summary: {
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    openOwnReports: ownItems.filter(i => i.status !== 'returned').length,
    pendingClaims: claims.length,
    claimsToReview,
    generatedTasks: tasks.filter(t => t.generatedByAgent).length
  }});
});

router.post('/agent/plan', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const [ownItems, claims] = await Promise.all([
    Item.find({ owner: userId, status: { $nin: ['returned', 'claimed'] } }).select('title type category description location status createdAt').lean(),
    Claim.find({ claimant: userId, status: 'pending' }).populate('item', 'title type status location').lean()
  ]);
  const now = Date.now();
  const ideas = [];
  for (const item of ownItems) {
    const ageDays = Math.floor((now - new Date(item.createdAt).getTime()) / 86400000);
    if (ageDays >= 3 && item.status === 'open') ideas.push({
      owner: userId, item: item._id, kind: 'stale-report', priority: ageDays >= 7 ? 'high' : 'medium',
      title: `Review your ${item.type} report: ${item.title}`,
      description: `This report has been open for ${ageDays} days. Check the details and location, then search for opposite-type reports or update the report if circumstances changed.`
    });
    const opposites = await Item.find({ type: item.type === 'lost' ? 'found' : 'lost', category: item.category, status: { $nin: ['returned', 'claimed'] }, hidden: { $ne: true }, _id: { $ne: item._id } }).select('title description location category type').limit(100).lean();
    const sourceWords = tokens(`${item.title} ${item.description} ${item.location}`);
    const candidates = opposites.map(candidate => {
      const targetWords = tokens(`${candidate.title} ${candidate.description} ${candidate.location}`);
      const common = sourceWords.filter(word => targetWords.includes(word));
      const locationOverlap = tokens(item.location).some(word => tokens(candidate.location).includes(word));
      return { candidate, common, locationOverlap, score: Math.min(95, common.length * 12 + (locationOverlap ? 20 : 0) + 10) };
    }).filter(c => c.score >= 35).sort((a,b) => b.score-a.score).slice(0,2);
    for (const match of candidates) ideas.push({
      owner: userId, item: item._id, kind: 'possible-match', priority: match.score >= 60 ? 'high' : 'medium',
      title: `Review possible match for: ${item.title}`,
      description: `Candidate “${match.candidate.title}” may be relevant (${match.score}% heuristic similarity). Clues: ${match.common.slice(0,4).join(', ') || 'same category'}${match.locationOverlap ? '; location overlaps' : ''}. Verify privately; this is not proof of ownership.`
    });
  }
  for (const claim of claims) if (claim.item) ideas.push({
    owner: userId, claim: claim._id, item: claim.item._id, kind: 'pending-claim', priority: 'high',
    title: `Follow up on claim: ${claim.item.title || 'item report'}`,
    description: `Your claim is still pending. Review the report and follow up through the platform or a staffed campus handover point. Never share OTPs or sensitive ID details publicly.`
  });
  // Claims waiting for MY review (I own the reported item).
  const ownIds = ownItems.map(i => i._id);
  const toReview = await Claim.find({ item: { $in: ownIds }, status: 'pending' }).populate('item', 'title type status').lean();
  for (const claim of toReview) if (claim.item) ideas.push({
    owner: userId, claim: claim._id, item: claim.item._id, kind: 'pending-claim', priority: 'high',
    title: `Review claim on your report: ${claim.item.title}`,
    description: 'Someone submitted a claim on your report. Open My activity, read their private proof, and approve or reject it. Do not approve based on public details alone.'
  });

  // Housekeeping: close this user's agent tasks whose claim is no longer pending.
  const openClaimTasks = await AgentTask.find({ owner: userId, status: 'pending', kind: 'pending-claim', claim: { $ne: null } });
  for (const task of openClaimTasks) {
    const linked = await Claim.findById(task.claim).select('status').lean();
    if (!linked || linked.status !== 'pending') {
      task.status = 'completed';
      task.actionLog.push({ action: 'completed', note: 'Auto-closed: the linked claim is no longer pending.' });
      await task.save();
    }
  }

  let created = 0;
  for (const idea of ideas) {
    const duplicate = await AgentTask.findOne({ owner: userId, status: 'pending', kind: idea.kind, item: idea.item || null, claim: idea.claim || null, title: idea.title });
    if (!duplicate) { await AgentTask.create(idea); created++; }
  }
  const tasks = await AgentTask.find({ owner: userId }).sort({ status: 1, createdAt: -1 }).limit(100).lean();
  res.json({ message: created ? `Agent reviewed your live records and created ${created} actionable task${created===1?'':'s'}.` : 'Agent reviewed your live records. No new tasks were needed; existing pending tasks are retained.', created, tasks, provider: 'TraceMate rule-based agent', note: 'The agent only creates a review plan. It does not automatically approve claims, contact students, or mark items returned.' });
});

router.patch('/agent/tasks/:id', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!['completed', 'dismissed', 'pending'].includes(status)) return res.status(400).json({ message: 'Status must be completed, dismissed, or pending.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID.' });
  const task = await AgentTask.findOne({ _id: req.params.id, owner: req.user.sub });
  if (!task) return res.status(404).json({ message: 'Agent task not found.' });
  task.status = status;
  task.actionLog.push({ action: status, note: status === 'completed' ? 'Marked complete by the signed-in user.' : status === 'dismissed' ? 'Dismissed by the signed-in user.' : 'Reopened by the signed-in user.' });
  await task.save();
  res.json({ task, message: `Task ${status}.` });
});

export default router;
