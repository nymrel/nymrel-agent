export function isLoopbackHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (hostname === "localhost" || hostname === "::1") return true;
  const octets = hostname.split(".");
  return octets.length === 4
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
    && octets[0] === "127";
}
