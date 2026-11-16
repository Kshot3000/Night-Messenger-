// SPDX-License-Identifier: Apache-2.0
/**
 * Public SRS parameters (`bls_midnight_2p<k>`) for proving Compact circuits on
 * the user's own device. They hold no secrets. Midnight publishes them at
 * https://srs.midnight.network/ but that host sends no CORS headers, so the
 * site serves byte-identical copies under /zk/params and every download is
 * checked against the SHA-256 values Midnight's wallet SDK pins
 * (@midnightntwrk/wallet-sdk-prover-client 2.0.0, KeyMaterial.publicParameters).
 */
export const SRS_SOURCE = "https://srs.midnight.network/";

export const SRS_PARAM_SHA256: Readonly<Record<number, string>> = {
  10: "46b2290933cbed4c378889e4ba971f1a92888331ffb09466acd4ff61a1e2cb42",
  11: "9901589d7956ff58be0d85569b2f455b77b58c3758026ffb5bbe4807000b96d1",
  12: "ef08eb3fcf62df8f72c515cffa027e681808b530cb016eea104115545ef6d5c8",
  13: "d3324910969c4cc54143b8045b649e5c3a4bd5fb7b8f85fe1b770f640ce1c803",
  14: "fc253016885ec830e97808c9ec920bb5cab5c21af590380a6cb5eb0538e2b244",
  15: "724c7c3d779148bb113c7ee9c034b2f27db16e6bdf315fde90105a9bad00b1de",
  16: "09c877216d6589b370263e18af40a030a901b41a7a7c37ef58c9901db41f05c6",
  17: "4a9ef6c7c0619aab74eede44b13e753e3ba54508a02dd3b7106a949aabb73b74",
};

export function srsParamFileName(k: number): string {
  return `bls_midnight_2p${k}`;
}
