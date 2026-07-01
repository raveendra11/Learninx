/**
 * Shared library / app types.
 *
 * Lessons and quiz questions are plain TypeScript constants in
 * `./lessons.ts`; the types here describe their shape.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Lesson {
  /** Stable id used in the URL, the quiz-question join, and the cookie store. */
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  order: number;
  /** Markdown body. */
  content: string;
  /** A command the sandbox surfaces as a "Run hint" button. Optional. */
  trackCommand?: string;
  /** Challenge prompt shown to the learner. Optional. */
  challenge?: string;
  /**
   * Pipe-separated accepted answers, e.g. `"mkdir lab && touch lab/notes.txt"`.
   * Normalisation is the same as the old server action.
   */
  solution?: string;
}

export interface QuizQuestion {
  id: string;
  lessonId: string;
  order: number;
  prompt: string;
  /** Lower-cased + trimmed expected answer. */
  answer: string;
}

export interface QuizAnswerResult {
  questionId: string;
  prompt: string;
  given: string;
  expected: string;
  correct: boolean;
}

/** A lesson with the per-visitor "completed" flag merged in. */
export interface LessonWithStatus extends Lesson {
  completed: boolean;
}
