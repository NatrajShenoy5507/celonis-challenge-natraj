export type EnvironmentName = "demo" | "qa" | "staging";

export interface EnvironmentConfig {
  name: EnvironmentName;
  baseURL: string;
  apiBaseURL: string;
  testUserEmail: string;
  testUserPassword: string;
  authStateTtlHours: number;
}
