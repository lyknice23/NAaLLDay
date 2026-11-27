import { AccessToken } from "livekit-server-sdk";

/**
 * Mint a short-lived LiveKit token for one authenticated room participant.
 * Server-only: LIVEKIT_API_SECRET must never reach the client bundle.
 */
export async function createRoomToken({
  roomName,
  identity,
  name,
}: {
  roomName: string;
  identity: string;
  name: string;
}): Promise<{ token: string; url: string } | null> {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;

  const access = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "4h",
  });
  access.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  return { token: await access.toJwt(), url };
}
