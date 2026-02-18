export interface OAuthProviderConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string[];
  callbackPath: string;
  profileParams?: Record<string, string>;
}
