// SPDX-License-Identifier: Apache-2.0
/**
 * Thin helpers over @midnight-ntwrk/compact-runtime 0.21 (Compact 0.36.0
 * artifacts): initialState and impureCircuits are async, createCircuitContext
 * takes an options object, and the updated ledger state lives at
 * context.callContext.currentQueryContext.state.
 */
import * as RT from "@midnight-ntwrk/compact-runtime";

export const COIN = "0".repeat(64);

/** Runs the constructor; returns the initial ledger state (ChargedState). */
export async function deployState(contract, privateState, coin = COIN) {
  const init = await contract.initialState(RT.createConstructorContext(privateState, coin));
  return init.currentContractState.data;
}

/** Runs one impure circuit off-chain. Returns { result, state, context } (context carries callProofDataTrace). */
export async function runCircuit(contract, { address, coin = COIN }, state, privateState, name, args) {
  const context = RT.createCircuitContext({ circuitId: name, contractAddress: address, coinPublicKeyOrZswapState: coin, contractState: state, privateState });
  const r = await contract.impureCircuits[name](context, ...args);
  return { result: r.result, state: r.context.callContext.currentQueryContext.state, context: r.context };
}
