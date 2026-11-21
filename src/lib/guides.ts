// Short, practical study and exam-craft guides (originally the Test Book "Field Notes").
export interface Guide { tag: string; title: string; body: string }

export const GUIDES: Guide[] = [
  {
    "tag": "EXAM BRIEF · SAT",
    "title": "Digital SAT: build module discipline",
    "body": "The current digital SAT has Reading and Writing and Math, each delivered in two timed modules. The second module responds to first-module performance. In practice, treat each module as a closed pacing unit: finish, check only what remains uncertain, then release it. Snapshot checked August 2026; confirm test-day rules with College Board before registering."
  },
  {
    "tag": "EXAM BRIEF · NEET-UG",
    "title": "NEET-UG: the bulletin is the syllabus boundary",
    "body": "Use the current NTA information bulletin as the authority for eligibility, permitted materials, timing, question pattern, and syllabus. Build each mock from its official subject blueprint, then distinguish content misses from OMR-style execution errors. This offline note deliberately avoids frozen annual rules: the bulletin is the source of truth."
  },
  {
    "tag": "EXAM BRIEF · JEE",
    "title": "JEE preparation: separate fluency from selection",
    "body": "Strong preparation needs two distinct habits: rapid execution of familiar methods and sober selection among unfamiliar ones. Tag every mock question by concept and by decision error—misread, overcommitted, or abandoned too early. Then use the Practice Lab to rehearse the exact failure mode."
  },
  {
    "tag": "EXAM BRIEF · OLYMPIADS",
    "title": "Olympiad work rewards visible reasoning",
    "body": "For proof-heavy or open-response papers, retain your written working. After self-checking, record the earliest unjustified leap, not merely the final result. A well-kept error book makes later revision a study of reasoning rather than an exercise in answer memorization."
  },
  {
    "tag": "EXAM CRAFT",
    "title": "The question behind the question",
    "body": "Patterns matter more than prediction. Classify each mistake: a missing fact, a flawed method, a misread instruction, or a lapse in execution. Only then can practice target the cause rather than the symptom."
  },
  {
    "tag": "STUDY METHOD",
    "title": "Why retrieval wins",
    "body": "Closing the book and reconstructing an idea is harder than rereading; that difficulty is the point. Use brief recall attempts, check precisely, and revisit the material at widening intervals."
  },
  {
    "tag": "PAPER DESIGN",
    "title": "Read the rules before the clock",
    "body": "For every examination, build a one-page briefing: sections, marking, permitted materials, timing, and question types. Verify it against the issuing body's current official notice before test day."
  },
  {
    "tag": "PACE",
    "title": "A timer is a diagnostic instrument",
    "body": "Time remaining is not simply pressure. In the review, compare it with accuracy: fast inaccuracies signal haste; slow inaccuracies signal a conceptual bottleneck worth isolating."
  },
  {
    "tag": "REVISION",
    "title": "Keep an error book",
    "body": "A useful error log holds the prompt, your choice, the correct principle, and one sentence on what misled you. StudySprint turns every missed question into a private practice queue and, if you like, into flashcards."
  },
  {
    "tag": "OFFLINE STUDY",
    "title": "The virtue of fewer tabs",
    "body": "A local study space has one understated advantage: it makes attention the default. Store the source material, practice deliberately, and take official updates only when you choose to look for them."
  }
];
