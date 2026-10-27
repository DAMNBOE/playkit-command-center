export function canRegisterAppWorker({ production, hostname, framed, search, protocol, desktop }: {
  production: boolean;
  hostname: string;
  framed: boolean;
  search: string;
  protocol: string;
  desktop: boolean;
}): boolean {
  const host = hostname.toLowerCase();
  if (!production || framed || desktop || !["http:", "https:"].includes(protocol) || new URLSearchParams(search).get("sw") === "off") return false;
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
  if (["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => host === domain || host.endsWith(`.${domain}`))) return false;
  const platform = ["lovable.app", "gpt-eng.com", "gptengineer.run"].some((domain) => host.endsWith(`.${domain}`));
  const label = host.split(".")[0];
  return !(platform && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || label === "project--df5e9a3d-0cbc-4ab9-8b32-4df8bba1d35d-dev"));
}