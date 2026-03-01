import React from 'react';

export interface QuizItem {
  question: string;
  answer: string;
  type: 'multiple' | 'open';
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface ConfidenceMetric {
  score: number;
  reasoning: string;
}

export interface StudyGuide {
  summary: string;
  detailedPageNotes: string[]; 
  conceptMap: string[];
  quiz: QuizItem[];
  feynmanExplanation: string;
  flashcards: Flashcard[];
  audioScript: string;
  confidence: ConfidenceMetric;
}

export interface Unit {
  id: string;
  title: string;
  createdAt: number;
  lastUpdated: number;
  data: StudyGuide | null;
  fileCount: number;
}

export type TabId = 'overview' | 'files' | 'concepts' | 'quiz' | 'feynman' | 'flashcards' | 'script' | 'image-gen';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}