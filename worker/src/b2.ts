// Backblaze B2 (S3-compatible) helpers shared by the public stream-url
// endpoint and the admin cleanup logic.

import { AwsClient } from "aws4fetch";
import type { Env } from "./index";

export function b2Client(env: Env): AwsClient {
  return client(env);
}

function client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    service: "s3",
    region: env.B2_REGION,
  });
}

// Encode each path segment but keep the "/" separators, so keys like
// "audio/lec_1.mp3" keep their real object path in the bucket.
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function objectUrl(env: Env, key: string): string {
  return `https://${env.B2_ENDPOINT}/${env.B2_BUCKET}/${encodeKey(key)}`;
}

export async function signStreamUrl(env: Env, key: string, expiresSeconds: number): Promise<string> {
  const signed = await client(env).sign(
    new Request(`${objectUrl(env, key)}?X-Amz-Expires=${expiresSeconds}`, { method: "GET" }),
    { aws: { signQuery: true } }
  );
  return signed.url;
}

// Best-effort delete of audio objects when their lectures are removed,
// so the private bucket never accumulates orphaned files. Failures are
// swallowed: a leftover object is preferable to a failed admin action.
export async function deleteObjects(env: Env, keys: string[]): Promise<void> {
  const b2 = client(env);
  for (const key of keys) {
    if (!key) continue;
    try {
      const signed = await b2.sign(new Request(objectUrl(env, key), { method: "DELETE" }));
      await fetch(signed);
    } catch {
      // ignore — cleanup is best-effort
    }
  }
}
