/** ICE servers for WebRTC. Always includes free Google STUN; adds TURN if
 *  Metered credentials are provided in .env (needed for calls across mobile networks). */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    // Metered gives several URLs; support a comma-separated list.
    turnUrl.split(',').forEach((u: string) => {
      servers.push({ urls: u.trim(), username: turnUser, credential: turnCred });
    });
  }
  return servers;
}
