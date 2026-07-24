export function hasConfiguredSharedSecret(
  request: Request,
  environmentVariable: string,
): boolean {
  const expectedSecret = process.env[environmentVariable];
  if (!expectedSecret) {
    return true;
  }

  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${expectedSecret}`;
}

export function createSharedSecretHeaders(
  environmentVariable: string,
): Record<string, string> {
  const secret = process.env[environmentVariable];
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}
