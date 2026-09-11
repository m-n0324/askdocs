# Prompt templates

Every prompt the app sends to the LLM lives in this folder. Nothing is hidden inside services.

| File                      | Used for                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `answer.v1.ts`            | The main RAG prompt: rules, source formatting, prompt-injection defence |
| `condense-question.v1.ts` | Rewrites follow-up questions into standalone ones before retrieval      |

## Versioning

Prompts are code: a small wording change can change answer quality a lot. So:

1. **Never edit a released prompt in place.** Copy `answer.v1.ts` to `answer.v2.ts` and change the copy.
2. Point `index.ts` at the new version.
3. Run `pnpm eval` before and after, and compare the hit rate and answers.
4. Keep the old file until you're sure, so rolling back is a one-line change in `index.ts`.

`ANSWER_PROMPT_VERSION` is logged with every answer, so you can tell which prompt produced a reply.
