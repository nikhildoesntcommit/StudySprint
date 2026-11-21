# StudySprint Exam File Format (v2)

StudySprint practice papers work entirely offline. An exam is a portable JSON file; no account, server, or network request is involved.

## Minimum valid paper

```json
{
  "title": "My Practice Paper",
  "examType": "Custom",
  "durationMinutes": 30,
  "marking": {"correct": 4, "incorrect": -1, "unanswered": 0},
  "sections": [{
    "title": "Section 1",
    "durationMinutes": 30,
    "questions": [{
      "type": "mcq",
      "domain": "Topic name",
      "prompt": "Question text",
      "options": ["A", "B", "C", "D"],
      "answer": 0,
      "explanation": "Why A is correct."
    }]
  }]
}
```

## Question types

| `type` | Required fields | Answer format |
|---|---|---|
| `mcq` | `options` | zero-based option number, e.g. `0` |
| `multi` | `options` | array of zero-based option numbers, e.g. `[0, 2]` |
| `short` or `fill` | — | exact text answer, e.g. `"42"` |
| `written` | — | omit `answer`; response is saved for self-review |

Every question needs `type` and `prompt`. `domain`, `hint`, and `explanation` are optional but strongly recommended: domains drive practice analytics, hints are displayed only on request, and explanations appear after an answer is checked and in the results review.

## Marking and pacing

`marking` is optional. Supply it at the exam level to define score behavior for the whole paper, or on an individual section to override that behavior. When omitted, each correct scored question receives one mark; incorrect and unanswered questions receive zero. The learning ledger records both accuracy and marks, because they are not interchangeable under negative marking.

```json
"marking": {"correct": 4, "incorrect": -1, "unanswered": 0}
```

StudySprint records active test time and approximate time per scored domain locally. Time while an attempt is paused is excluded. A resumed attempt intentionally remains paused until the learner chooses Resume.

## Design guidance

- `section.durationMinutes` overrides the top-level duration.
- Missed and flagged scored questions enter the learner’s local error book. They never leave the device.
- Keep answer keys out of a file you intend to distribute as a secure live test; a browser-side app necessarily contains the answer key.
- Official exam patterns change. Verify timings, marking, materials, and eligibility against the issuing body’s current official notice before creating a paper.

## StudySprint additions

These are optional and backwards-compatible:

- `truefalse` question type: `answer` may be `true`/`false` or `0`/`1`.
- `short` answers may be an array of accepted alternatives, e.g. `["42", "forty-two"]`. Matching ignores case, extra spaces and trailing punctuation, and compares numbers numerically.
- `mcq` answers may also be given as a letter (`"B"`) or as the option text.
- `written` questions may include a model `answer`; learners compare against it and self-mark.
- A bare JSON array of questions is accepted and imported as a single section.
