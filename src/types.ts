export interface DigitalGoal {
  description: string;
  frameworkRef?: string;
}

export interface Activity {
  name: string;
  nlsType?: string;
  digitalActivity: string;
  digitalTools?: string[];
}

export interface LessonPlanData {
  title: string;
  summary?: string;
  digitalGoals: DigitalGoal[];
  disabilityGoals?: DigitalGoal[];
  aiGoals?: DigitalGoal[];
  activities: Activity[];
  recommendedTools?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
}
