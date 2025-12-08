// TypeScript file for symbol extraction tests

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export type Status = "active" | "inactive" | "pending";

export function formatUser(user: UserProfile): string {
  return `${user.name} <${user.email}>`;
}

export const DEFAULT_CONFIG = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
};

export class UserService {
  private users: UserProfile[] = [];

  addUser(user: UserProfile): void {
    this.users.push(user);
  }

  getUser(id: number): UserProfile | undefined {
    return this.users.find(u => u.id === id);
  }
}
