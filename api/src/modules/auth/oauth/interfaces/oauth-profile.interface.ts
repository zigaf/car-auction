export interface OAuthNormalizedProfile {
  providerId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}
