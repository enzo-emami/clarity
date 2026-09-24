import type { BoardData, CardKind, Confidence, ClarityCard, Connection } from './types'

export const kindMeta: Record<CardKind, { label: string; symbol: string; color: string }> = {
  question: { label: 'Question', symbol: '?', color: '#f2a64a' },
  knowledge: { label: 'Knowledge', symbol: '◆', color: '#557b72' },
  meaning: { label: 'Meaning', symbol: '✦', color: '#8e68aa' },
}

export const confidenceLabels: Record<Confidence, string> = {
  'first-hand': 'Cherry said this directly',
  'shared-with-me': 'Observed or reported by Enzo',
  hypothesis: 'An interpretation to check with Cherry',
}

const now = Date.now()
const card = (
  id: string,
  title: string,
  body: string,
  kind: CardKind,
  confidence: Confidence,
  topicId: string,
  x: number,
  y: number,
  source: string,
  status: ClarityCard['status'] = 'open',
): ClarityCard => ({ id, title, body, kind, confidence, topicId, x, y, source, status, vx: 0, vy: 0, updatedAt: now })

const connections: Array<[string, string]> = [
  ['cs-start', 'fashion-choice'], ['turning-talk', 'fashion-choice'], ['fashion-choice', 'fit-goal'],
  ['cere-tea', 'nyc-move'], ['nyc-move', 'textile-job'], ['textile-job', 'job-ended'],
  ['job-ended', 'stay-in-nyc'], ['nyc-harm', 'stay-in-nyc'], ['stay-in-nyc', 'shame-return'],
  ['shame-return', 'return-bay'], ['return-bay', 'current-schools'], ['fit-goal', 'transfer-options'],
  ['current-schools', 'transfer-options'], ['third-year', 'transfer-options'], ['fashion-choice', 'portfolio-stalled'],
  ['fashion-choice', 'sketch-practice'], ['psychology-interest', 'identity-question'],
  ['course-load', 'high-performance'], ['high-performance', 'academic-strength'], ['high-performance', 'safety-hypothesis'],
  ['nyc-apathy', 'lonely-home'], ['nyc-apathy', 'task-collapse'], ['purpose-quote', 'energy-question'],
  ['lonely-home', 'purpose-quote'], ['task-collapse', 'portfolio-stalled'], ['course-load', 'task-collapse'],
  ['shame-return', 'shame-hypothesis'], ['shame-hypothesis', 'pace-question'],
  ['berkeley-fear', 'visits'], ['berkeley-fear', 'relationship-question'], ['small-things', 'support-promise'],
  ['therapy-ended', 'support-question'], ['ssri-consideration', 'support-question'], ['small-things', 'support-question'],
  ['academic-strength', 'ability-meaning'], ['portfolio-stalled', 'small-action'], ['sketch-practice', 'small-action'],
  ['energy-question', 'small-action'], ['identity-question', 'design-experiment'], ['fashion-choice', 'design-experiment'],
  ['ability-meaning', 'self-authorship'], ['relationship-question', 'self-authorship'], ['support-question', 'self-authorship'],
]

export const starterData: BoardData = {
  topics: [
    { id: 'all', name: 'All threads', color: '#2c3834' },
    { id: 'story', name: 'The story so far', color: '#dd765c' },
    { id: 'nyc', name: 'NYC chapter', color: '#4d78a4' },
    { id: 'direction', name: 'School & direction', color: '#557b72' },
    { id: 'energy', name: 'Energy & wellbeing', color: '#d49b3b' },
    { id: 'relationship', name: 'Relationship & support', color: '#b76f86' },
    { id: 'strengths', name: 'Strengths', color: '#6b8c62' },
    { id: 'questions', name: 'Questions to explore', color: '#8e68aa' },
  ],
  cards: [
    card('cs-start', 'Computer science was the starting path', 'When you met, Cherry was studying CS but did not feel she knew why she was doing it.', 'knowledge', 'shared-with-me', 'story', -1050, -210, 'Enzo’s account'),
    card('turning-talk', 'A conversation opened another path', 'You talked about the risk of building a life around something she already knew she did not like. She agreed and reconsidered what she wanted.', 'knowledge', 'shared-with-me', 'story', -760, -300, 'Enzo’s account'),
    card('fashion-choice', 'She chose fashion design', 'After considering what she actually liked, Cherry moved toward fashion design. She still says she is set on design, even while feeling uncertain about execution.', 'knowledge', 'shared-with-me', 'story', -470, -210, 'Enzo’s account'),
    card('identity-question', 'What parts of this direction feel like hers?', 'Which choices come from curiosity and aliveness? Which come from shame, comparison, or a need to prove something?', 'question', 'hypothesis', 'questions', -120, -330, 'Question for Cherry'),

    card('cere-tea', 'Cere-Tea job in Saratoga', 'Cherry worked as a bobarista before leaving for a summer opportunity in New York.', 'knowledge', 'shared-with-me', 'nyc', -1130, 180, 'Enzo’s account'),
    card('nyc-move', 'A sudden move to New York', 'She left the Bay Area to work at a textile company in NYC as a sales assistant.', 'knowledge', 'shared-with-me', 'nyc', -830, 120, 'Enzo’s account'),
    card('textile-job', 'Honggang Textile sales role', 'The role was meant to be a practical step into textiles and fashion. She came to believe the company was taking advantage of her.', 'knowledge', 'shared-with-me', 'nyc', -520, 80, 'Enzo’s account'),
    card('job-ended', 'The textile job ended', 'She was fired from the role. The ending carried embarrassment and disrupted the plan she had made for NYC.', 'knowledge', 'shared-with-me', 'nyc', -220, 40, 'Enzo’s account'),
    card('nyc-harm', 'A harmful experience in NYC', 'Cherry experienced serious sexual harassment—described by Enzo as an attempted assault. This belongs to Cherry; she controls whether and how it appears here.', 'knowledge', 'shared-with-me', 'nyc', -525, 285, 'Sensitive · Enzo’s account'),
    card('stay-in-nyc', 'The plan to stay for a year', 'After the job ended, she wanted to remain in NYC until she could apply to FIT, supporting herself through ordinary jobs. She briefly stocked at a Japanese store.', 'knowledge', 'shared-with-me', 'nyc', -205, 285, 'Enzo’s account'),
    card('shame-return', 'Shame made returning feel hard', 'In a call, Cherry acknowledged that shame about returning to her parents after being fired was a major reason she was staying.', 'knowledge', 'first-hand', 'nyc', 100, 160, 'Cherry, as recalled by Enzo'),
    card('return-bay', 'She slept on it and came home', 'After that conversation, she reconsidered and returned to the Bay Area.', 'knowledge', 'shared-with-me', 'story', 390, 80, 'Enzo’s account'),

    card('fit-goal', 'FIT remains one possible destination', 'Fashion Institute of Technology is one transfer path she has considered.', 'knowledge', 'shared-with-me', 'direction', -850, 585, 'Enzo’s account'),
    card('current-schools', 'De Anza + West Valley', 'She is now taking classes at De Anza and West Valley while continuing to figure out her direction.', 'knowledge', 'shared-with-me', 'direction', -535, 535, 'Enzo’s account'),
    card('psychology-interest', 'Psychology has stayed in the picture', 'She has long considered psychology as a minor and is now considering it more seriously alongside design.', 'knowledge', 'shared-with-me', 'direction', -220, 600, 'Enzo’s account'),
    card('transfer-options', 'Transfer routes need a real comparison', 'FIT, ArtCenter College of Design, Pratt, and the West Valley Cilker transfer requirements have all entered the planning conversation.', 'knowledge', 'shared-with-me', 'direction', -525, 780, 'Enzo’s account'),
    card('third-year', 'A third year in community college', 'The present plan is another year in community college: learning, meeting transfer requirements, and trying to find a more certain direction.', 'knowledge', 'shared-with-me', 'direction', -190, 830, 'Enzo’s account'),
    card('portfolio-stalled', 'The portfolio has stalled', 'Enzo started a portfolio website, but Cherry has not been putting much energy into completing it.', 'knowledge', 'shared-with-me', 'direction', 115, 620, 'Enzo’s observation'),
    card('sketch-practice', 'Sketching needs more practice', 'Her current sketching does not yet feel where she wants it to be, and practice has been difficult to sustain.', 'knowledge', 'shared-with-me', 'direction', 395, 750, 'Enzo’s observation'),
    card('design-experiment', 'What is the smallest honest design test?', 'Not a lifelong commitment: one tiny finished garment, sketch series, critique, or portfolio page that can reveal whether the work itself gives energy.', 'question', 'hypothesis', 'questions', 165, 965, 'Question for Cherry'),

    card('course-load', 'Taking many hard classes feels like action', 'One familiar way Cherry proves progress to herself is by carrying a demanding academic load.', 'knowledge', 'shared-with-me', 'energy', 730, 535, 'Enzo’s observation'),
    card('academic-strength', 'She is exceptionally capable academically', 'She is acing CS, linear algebra, differential equations, chemistry, and STEM courses. Ability is not the bottleneck.', 'knowledge', 'shared-with-me', 'strengths', 1030, 470, 'Enzo’s observation'),
    card('high-performance', 'Returning to high-performance mode', 'Her current course load may be an attempt to reconnect with the version of herself that felt capable and productive.', 'meaning', 'hypothesis', 'energy', 1010, 730, 'Enzo’s interpretation'),
    card('safety-hypothesis', 'Achievement may create safety', 'Hypothesis: classes offer clear rules and proof of competence when identity, work, and the future feel ambiguous.', 'meaning', 'hypothesis', 'energy', 1300, 690, 'Interpretation to check with Cherry'),
    card('ability-meaning', 'This does not look like a lack of ability', 'The pattern suggests a gap between capability and available energy, direction, or emotional safety—not an inability to succeed.', 'meaning', 'hypothesis', 'strengths', 1320, 430, 'Interpretation to check with Cherry'),

    card('nyc-apathy', '“I feel apathetic”', 'In NYC, Cherry said she did not care about work, struggled with basic routines, felt unmotivated, and watched the days disappear into work and spending.', 'knowledge', 'first-hand', 'energy', 640, -260, 'Cherry · message from Aug 8, 2026'),
    card('lonely-home', 'Home felt lonely', 'She said she felt lonely whenever she was home.', 'knowledge', 'first-hand', 'energy', 955, -310, 'Cherry · message from Aug 8, 2026'),
    card('purpose-quote', '“I need to feel a purpose”', 'Cherry connected action with purpose: she felt she needed a reason to do something, but could not feel one.', 'knowledge', 'first-hand', 'energy', 1245, -215, 'Cherry · message from Aug 8, 2026'),
    card('task-collapse', 'Starting, giving up, sleeping', 'She described trying to begin a task, giving up, and going to sleep—and said this did not feel like who she used to be.', 'knowledge', 'first-hand', 'energy', 940, -75, 'Cherry · message from Aug 8, 2026'),
    card('energy-question', 'What gives energy before it asks for discipline?', 'Which people, places, materials, or kinds of work produce even a small spark before achievement enters the picture?', 'question', 'hypothesis', 'questions', 1285, 20, 'Question for Cherry'),
    card('small-action', 'What can be finished in twenty minutes?', 'Choose a step small enough that it creates evidence, not pressure: one sketch, one caption, one saved reference, one email.', 'question', 'hypothesis', 'questions', 1000, 210, 'Question for Cherry'),

    card('berkeley-fear', 'Fear of being replaced', 'Cherry has said that part of her is afraid Enzo will meet someone “better” at Berkeley and leave.', 'knowledge', 'first-hand', 'relationship', 400, -505, 'Cherry, as recalled by Enzo'),
    card('visits', 'She drives up about every two weeks', 'She visits Enzo in Berkeley roughly every other week.', 'knowledge', 'shared-with-me', 'relationship', 690, -545, 'Enzo’s account'),
    card('small-things', 'Her worries can feel too small to share', 'After ending with a new therapist, Cherry said many of the things she would talk about feel small or useless and might be brushed off as irrelevant.', 'knowledge', 'first-hand', 'relationship', 370, -720, 'Cherry, as recalled by Enzo'),
    card('support-promise', '“I won’t brush them off”', 'Enzo wants those small things to be heard and treated as relevant.', 'knowledge', 'shared-with-me', 'relationship', 690, -775, 'Enzo’s stated intention'),
    card('therapy-ended', 'A recent therapist relationship ended', 'Cherry stopped seeing a new therapist. The reasons and what she wants next are hers to define.', 'knowledge', 'shared-with-me', 'energy', 1000, -650, 'Enzo’s account'),
    card('ssri-consideration', 'Medication may have come up', 'Enzo believes Cherry mentioned considering SSRIs, but this memory is uncertain and should be confirmed by her before treating it as current.', 'knowledge', 'hypothesis', 'energy', 1285, -540, 'Uncertain recollection from Enzo'),
    card('support-question', 'What support actually feels supportive?', 'Listening, questions, practical help, quiet company, professional support, or something else? Cherry gets to set the terms.', 'question', 'hypothesis', 'questions', 1000, -900, 'Question for Cherry'),
    card('relationship-question', 'What would create security between us?', 'What reassurance, agreements, or boundaries would help without making either person responsible for the other’s whole sense of safety?', 'question', 'hypothesis', 'questions', 380, -945, 'Question for both people'),

    card('shame-hypothesis', 'Shame may be steering more than one decision', 'The NYC return decision and the feeling of being “behind” may share a fear of being seen as having failed.', 'meaning', 'hypothesis', 'questions', 390, 340, 'Interpretation to check with Cherry'),
    card('pace-question', 'Whose timeline is “behind”?', 'Behind compared with whom? What pace would feel chosen rather than defended?', 'question', 'hypothesis', 'questions', 690, 315, 'Question for Cherry'),
    card('self-authorship', 'Cherry is the final editor', 'This map is a draft, not a diagnosis. Cherry can correct facts, rewrite meanings, reject interpretations, and decide what is private.', 'meaning', 'first-hand', 'questions', 1480, -310, 'Rule of the map', 'resolved'),
  ],
  connections: connections.map(([from, to], index): Connection => ({ id: `link-${index + 1}`, from, to })),
}
