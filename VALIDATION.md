# Validation record

Validated locally on 2026-09-16. No public-chain transactions were broadcast.

| Check | Result |
| --- | --- |
| Solidity 0.8.30 compile, optimizer + Shanghai target | Pass |
| EIP-170 deployed contract size limit | Pass |
| Demo state and jsdom UI interaction tests | 10 passed |
| Actual EVM integration scenarios on Ganache | 12 passed |
| Exact browser wallet adapter against a local EVM | Pass |
| Foundry Solidity tests | 8 passed |
| Foundry fuzz cases | 3 tests × 256 runs, all passed |
| JavaScript syntax | Pass |

Verified paths include creation, funding, approval, purchase, early hard-cap settlement, success and failure settlement, token claims, refunds, creator fees/proceeds, unsold-token recovery, cumulative wallet caps, replay prevention and post-withdrawal escrow solvency.

The wallet adapter test runs the frontend's actual `Chain` class with an injected EIP-1193 provider against deployed contracts; it does not replace the contract actions with mocks. It checks the final allocations and claim/withdrawal state.

Not performed: real-browser visual QA, mainnet or Sepolia deployment, external audit, or supported-browser WebMCP runtime validation. A feature-detected read/navigation WebMCP hook is included, but no tool signs or sends transactions.

These checks are development evidence, not a security guarantee. Re-run tests after changes.
