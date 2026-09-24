import type { BoardData, CardKind, ClarityCard } from './types'

// Each new prompt/interpretation is attached to the account that motivated it.
const additions: Array<[string, string, CardKind, string, string, string[]]> = [
  ['mandarin', 'Mandarin was another stalled interest', 'knowledge', 'energy', 'In her August 8 message, Cherry said she had not been learning Mandarin despite wanting to learn something.', ['nyc-apathy', 'task-collapse']],
  ['daily-care', 'Everyday care felt harder in NYC', 'knowledge', 'energy', 'Her August 8 message describes a messy room, brushing only in the morning to be around coworkers, and struggling to floss. This describes that period; we do not know whether it still applies.', ['nyc-apathy']],
  ['changed-self', '“This is not like how I was”', 'knowledge', 'energy', 'Cherry ended her August 8 messages by saying this was terrible and unlike how she used to be.', ['task-collapse', 'high-performance']],
  ['current-check', 'What has changed since August?', 'question', 'energy', 'Which parts of that NYC experience are still present now, and which improved after coming home?', ['nyc-apathy', 'return-bay', 'daily-care']],
  ['task-friction', 'Where does a task become difficult?', 'question', 'energy', 'Is the hard part choosing, starting, knowing the next step, sustaining attention, or feeling satisfied? A recent example may help.', ['task-collapse', 'portfolio-stalled']],
  ['capacity-meaning', 'Available energy may vary by setting', 'meaning', 'energy', 'Strong grades and difficulty with everyday or creative tasks can coexist. Different environments may provide different kinds of structure; Cherry can say whether that fits.', ['academic-strength', 'daily-care', 'task-friction']],
  ['rest-question', 'What does a manageable week look like?', 'question', 'energy', 'What time is actually available after classes, commuting, work, sleep, and relationships? Where is there room to recover?', ['course-load', 'small-action']],
  ['behind-report', 'Feeling behind, lost, and ashamed', 'knowledge', 'story', 'Enzo describes Cherry feeling behind, lost, and ashamed while he feels settled on a Berkeley path. This is his account of her feelings.', ['third-year', 'pace-question']],
  ['progress-question', 'What progress would you recognize?', 'question', 'story', 'What would make the coming month feel worthwhile in your own terms, even without a transfer decision?', ['behind-report', 'third-year']],
  ['revision-meaning', 'Changing direction can be useful information', 'meaning', 'story', 'Moving from CS toward design and returning from NYC may represent responding to experience. Cherry may understand those decisions differently.', ['cs-start', 'fashion-choice', 'return-bay']],
  ['nyc-work-details', 'A brief stockroom job followed', 'knowledge', 'nyc', 'Enzo reports that Cherry worked for about one week stocking a Japanese store after the textile job ended.', ['job-ended', 'stay-in-nyc']],
  ['nyc-learning', 'What did NYC teach you about work?', 'question', 'nyc', 'If you want to revisit it, which parts of the work interested you and which conditions would you avoid in another job?', ['textile-job', 'nyc-work-details']],
  ['return-meaning', 'Returning may have preserved options', 'meaning', 'nyc', 'Coming home may have made space to reassess. That is one possible reading, not a judgment about whether staying would have been wrong.', ['return-bay', 'shame-return']],
  ['nyc-boundary', 'What belongs in this chapter?', 'question', 'nyc', 'Which NYC experiences do you want represented, changed, or removed from the map? You do not need to describe anything further.', ['nyc-harm', 'self-authorship']],
  ['design-attraction', 'Which part of design draws you in?', 'question', 'direction', 'Materials, drawing, construction, styling, storytelling, research, or something else? Which have you actually enjoyed doing?', ['fashion-choice', 'design-experiment']],
  ['psych-attraction', 'What attracts you to psychology?', 'question', 'direction', 'Is it the subject, the kind of work, understanding people, or something else? How would you explore it without deciding on a whole career?', ['psychology-interest']],
  ['portfolio-block', 'What is blocking the portfolio?', 'question', 'direction', 'Is the obstacle selecting work, making work, writing about it, judging its quality, or using the website? Which kind of help would you want?', ['portfolio-stalled', 'small-action']],
  ['transfer-evidence', 'What must be verified for each school?', 'question', 'direction', 'Record the actual portfolio requirements, course credit rules, deadlines, costs, and preferred program for each option. The conversation contains no verified admissions requirements.', ['transfer-options', 'fit-goal']],
  ['class-fit', 'Which classes move your own plan forward?', 'question', 'direction', 'For each class, what is its purpose: a requirement, exploration, enjoyment, or another reason? Which tradeoffs feel worth it?', ['course-load', 'transfer-options']],
  ['planning-view', 'Enzo sees a planning gap', 'meaning', 'direction', 'Enzo says individual periods have not been unproductive, but feels the overall planning and execution are too shallow. This is his evaluation, open to disagreement.', ['third-year', 'portfolio-stalled']],
  ['explore-meaning', 'Exploration could produce small evidence', 'meaning', 'direction', 'A small finished project or trial class could help compare interests without demanding certainty first.', ['design-experiment', 'psych-attraction']],
  ['strength-belief', 'Enzo believes in her capacity', 'knowledge', 'strengths', 'Enzo believes that once Cherry finds what she truly likes, she has the ability to excel at it.', ['academic-strength']],
  ['strength-own', 'Which strengths do you recognize?', 'question', 'strengths', 'Beyond grades, what abilities feel like yours? What have friends, classmates, or coworkers noticed that you agree with?', ['academic-strength', 'strength-belief']],
  ['structure-transfer', 'What helps you succeed in classes?', 'question', 'strengths', 'Are deadlines, feedback, clear assignments, classmates, or something else helpful? Would any of those support creative work?', ['academic-strength', 'portfolio-stalled']],
  ['strength-pressure', 'Belief can feel encouraging or pressuring', 'meaning', 'strengths', 'Being seen as capable may feel supportive, but expectations of exceptional performance could also add pressure. Ask Cherry how it lands.', ['strength-belief', 'high-performance']],
  ['listen-first', 'What would you like me to do right now?', 'question', 'relationship', 'Listen, ask questions, help solve something, or just be with you? The answer can change from conversation to conversation.', ['small-things', 'support-promise']],
  ['small-example', 'What is one small thing you wanted heard?', 'question', 'relationship', 'If you want, start with a recent thing that felt too minor to bring up. What would a good response have sounded like?', ['small-things']],
  ['help-boundary', 'Which decisions should remain yours?', 'question', 'relationship', 'Where is advice welcome, and where would you prefer room to decide without persuasion?', ['turning-talk', 'support-promise', 'self-authorship']],
  ['comparison-meaning', 'Different paths may amplify comparison', 'meaning', 'relationship', 'Enzo’s clearer Berkeley path may make Cherry’s uncertainty feel more visible. This is a possible connection to ask about, not an explanation of all her feelings.', ['berkeley-fear', 'behind-report']],
  ['visits-question', 'How do visits feel for each of us?', 'question', 'relationship', 'Does the current rhythm feel connecting and manageable? What would make time together feel easier?', ['visits', 'relationship-question']],
  ['map-check', 'Which part of this map feels wrong?', 'question', 'questions', 'Start by correcting anything inaccurate, too certain, out of date, or missing your perspective. Rejecting a meaning is a useful outcome.', ['self-authorship', 'support-question']],
  ['one-thread', 'Which thread matters today?', 'question', 'questions', 'Choose one topic you want to explore now. There is no need to resolve the whole map in one conversation.', ['map-check', 'small-action']],
]

export function organize(cards: ClarityCard[], topics: BoardData['topics']) {
  const spaces = topics.filter((topic) => topic.id !== 'all')
  return cards.map((card) => {
    const space = Math.max(0, spaces.findIndex((topic) => topic.id === card.topicId))
    const index = cards.filter((item) => item.topicId === card.topicId).findIndex((item) => item.id === card.id)
    return { ...card, x: (space % 3) * 1100 + (index % 3) * 310, y: Math.floor(space / 3) * 1650 + Math.floor(index / 3) * 210, vx: 0, vy: 0 }
  })
}

export function upgradeBoard(board: BoardData): BoardData {
  if ((board.contentVersion ?? 0) >= 2) return { ...board, cards: board.cards.map((card) => ({ ...card, vx: 0, vy: 0 })) }
  const cards = [...board.cards]
  const connections = [...board.connections]
  for (const [id, title, kind, topicId, body, related] of additions) {
    if (!board.topics.some((topic) => topic.id === topicId)) continue
    if (!cards.some((card) => card.id === id)) cards.push({ id, title, kind, topicId, body, confidence: kind === 'knowledge' ? (['mandarin', 'daily-care', 'changed-self'].includes(id) ? 'first-hand' : 'shared-with-me') : 'hypothesis', source: kind === 'knowledge' ? (['mandarin', 'daily-care', 'changed-self'].includes(id) ? 'Cherry · quoted message, Aug 8, 2026' : 'Enzo · conversation account') : 'Suggested prompt / interpretation · to review with Cherry', status: 'open', x: 0, y: 0, vx: 0, vy: 0, updatedAt: Date.now() })
    for (const to of related) if (cards.some((card) => card.id === to) && !connections.some((edge) => (edge.from === id && edge.to === to) || (edge.to === id && edge.from === to))) connections.push({ id: `${id}--${to}`, from: id, to })
  }
  return { ...board, cards: organize(cards, board.topics), connections, contentVersion: 2 }
}
