// SPDX-License-Identifier: Apache-2.0

type Identity = {
  network: string;
  status: string;
  contractAddress: string | null;
  id: string;
  artifacts: Record<string, string | null>;
};

export function BuildFingerprint() {
  const raw = process.env.NEXT_PUBLIC_NM_BUILD_FINGERPRINT;
  if (!raw) return null;
  const build = JSON.parse(raw) as Identity;
  return (
    <details className="container pm-details pm-small pm-muted">
      <summary>Build fingerprint · {build.network} · <code>{build.id.slice(0, 12)}</code></summary>
      <dl style={{ overflowWrap: "anywhere" }}>
        <dt>Build ID</dt><dd><code>{build.id}</code></dd>
        <dt>Target status</dt><dd>{build.status}</dd>
        <dt>Contract address</dt><dd><code>{build.contractAddress ?? "Unassigned"}</code></dd>
        {Object.entries(build.artifacts).map(([name, hash]) => (
          <div key={name}><dt>{name}</dt><dd><code>{hash ?? "Not packaged"}</code></dd></div>
        ))}
      </dl>
    </details>
  );
}
