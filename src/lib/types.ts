/**
 * Shared library / app types.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface LessonSeed {
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  order: number;
  content: string;
  trackCommand?: string;
  challenge?: string;
  solution?: string;
}

export interface QuizQuestionSeed {
  lessonSlug: string;
  questions: {
    prompt: string;
    answer: string;
  }[];
}

export interface QuizAnswerResult {
  questionId: string;
  prompt: string;
  given: string;
  expected: string;
  correct: boolean;
}
