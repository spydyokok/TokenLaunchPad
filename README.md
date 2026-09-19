# TokenLaunchpad

A backend-free token launchpad: fixed-supply ERC20 creation, immutable USDC presales, escrowed inventory, permissionless settlement, claims and refunds. Dark responsive frontend with a completely separate local demo sandbox.

**Portfolio / testnet project — unaudited, not production-ready. Do not use real money.** No blockchain deployment is bundled by default. The hosted preview opens in Demo; On-chain mode requires a deployed factory and payment-token address.

## What works

- Landing page, Explore with filters/search, launch details, Create Launch, investor/creator Dashboard, guide and network setup.
- Factory deploys one fixed-supply token and one independent presale per launch.
- Creator approves and deposits the entire maximum sale inventory before opening.
- Buyers approve the payment token and contribute during the sale window.
- Immutable price, soft/hard caps, minimum purchase and cumulative per-wallet maximum.
- Anyone can finalize after the deadline, or immediately at the hard cap.
- Success: buyer token claims, creator proceeds minus a fixed 2% treasury fee, recovery of only unsold tokens.
- Failure: full contributor refunds and return of creator token inventory.
- Double-claim/refund/withdrawal protection, SafeERC20, ReentrancyGuard, exact base-unit arithmetic.
- No Supabase, API server, database, authentication service, AI service or custody backend. The wallet is the identity; the blockchain is the state store.

## Quick demo

Requirements: Node.js 20.19+ (22 LTS recommended), npm. Foundry is optional for the JavaScript/EVM tests.

```bash
npm ci
npm run build
npm run dev
```

Open the local URL printed by Vite. Choose **Demo**. The static `dist` folder is also ready to host after building. Do not open `index.html` via `file://`; ES modules require an HTTP server.

Try these paths:

1. **Explore → Nova Protocol → Buy 100 demo USDC**. Dashboard shows 1,000 NOVA allocated.
2. **Lumen Finance → Finalize sale → Claim tokens**. The pre-seeded position is 1,000 LUM. You also own this sample launch, so try Withdraw proceeds and Recover unsold tokens.
3. **Echo Labs → Claim refund**. Returns the pre-seeded 100 demo USDC contribution.
4. **Create launch → Approve & fund → Jump to start → Buy → Jump past deadline → Finalize**. Set a small soft cap if testing success; otherwise test refunds.
5. **Dashboard → Reset sandbox** restores samples. Demo state is device-local, not shared between browsers. Advancing demo time affects all sample sales.

The demo never signs a wallet transaction. It uses simplified human-unit bookkeeping for simulated amounts. Live mode uses ethers BigInt base units and never falls back to demo data.

## Real local-chain workflow (no backend)

Terminal 1:

```bash
npm run chain
```

Terminal 2:

```bash
npm run deploy:local
npm run dev
```

`deploy:local` only accepts a loopback RPC on chain 31337. It deploys MockUSDC and the factory, mints 100,000 mock USDC to local accounts and writes **public** addresses to `dist/config.js`. It never writes private keys. The first local account is the fee treasury.

In MetaMask, add network **31337**, RPC **http://127.0.0.1:8545**, currency **ETH**, and import a disposable account printed by the local chain. These development keys are public and must never receive real money. Switch the UI to **On-chain**, connect, create a launch and fund it before the start time.

To speed up a local test using Foundry:

```bash
cast rpc evm_increaseTime 3601 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

Reload the UI after advancing the chain. Finalization still needs a transaction. The frontend never secretly changes chain time. A hosted HTTPS frontend may block local HTTP RPC; use the locally served frontend for local chains.

If you previously saved different settings in Setup, those browser preferences override `dist/config.js`; update them or use a fresh browser profile.

## Sepolia deployment

Use your existing Foundry installation and an **encrypted keystore**, not a private key in frontend files. The included script refuses non-Sepolia networks and deploys a test-only faucet asset (`mUSDC`), not real USDC.

```bash
cast wallet import launchpad-deployer --interactive
cd contracts
# Set these shell variables to your own PUBLIC endpoint and testnet wallet.
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export TREASURY=YOUR_TESTNET_WALLET_ADDRESS
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url "$SEPOLIA_RPC_URL" --account launchpad-deployer --broadcast
```

Copy the emitted payment and factory addresses into the frontend **Network setup** form. Use chain ID **11155111**, network name **Sepolia** and explorer **https://sepolia.etherscan.io**. The treasury gets 100,000 test mUSDC. Other test wallets can use the mock token's unrestricted `mint` method through an explorer or `cast send` with their keystore.

For a shared deployment, update the public values in `dist/config.js` and redeploy the frontend. Browser Setup only changes the current browser. Factory settings fix the payment token and treasury at deployment.

## Testing

```bash
npm test                   # Pure demo state + DOM interaction tests (jsdom)
npm run test:contracts     # Compile Solidity and execute on Ganache EVM
node scripts/test-adapter.mjs # Exact frontend wallet adapter on a local EVM
cd contracts
forge test -vv             # Solidity unit and fuzz tests
```

The DOM tests are not visual/browser screenshots. EVM integration tests cover successful and failed settlement, cap checks, exact allocation, escrow protection, permission checks, replay prevention and fees. Fuzz tests cover allocation math, buyer-token solvency and refund conservation. This test suite is not a security audit.

## Architecture

| File | Responsibility |
| --- | --- |
| `contracts/src/LaunchToken.sol` | Standard OpenZeppelin ERC20, constructor mint only, no owner mint function |
| `contracts/src/LaunchpadFactory.sol` | Permissionless token/sale deployment and paginated registry |
| `contracts/src/TokenSale.sol` | Inventory, contributions, immutable terms, finalization, claims and refunds |
| `contracts/src/MockUSDC.sol` | Test-only 6-decimal faucet token |
| `dist/app.js` | UI routes, controls, lifecycle forms and wallet interactions |
| `dist/chain.js` | Direct RPC reads and injected-wallet writes using ethers |
| `dist/demo.js` | Isolated, device-local demo simulation |
| `dist/config.js` | Public default RPC, network and deployment addresses |
| `dist/abi.js` | Generated from the Solidity compiler, not handwritten |

Amount convention: payment values use **6 decimals**, launched tokens use **18 decimals**, and `rate` is the number of token base units per **one whole USDC**. Allocation = `paymentBaseUnits × rate / 1e6`, rounded down. Fee = `totalRaised × 200 / 10000`.

The sale contract never sends purchased tokens before success. This prevents a failed sale from owing refunds while buyers keep tokens. Creator inventory recovery subtracts all outstanding successful buyer allocations.

## Host on Vercel or any static host

For the easiest upload, use `TokenLaunchpad-Vercel.zip` at [Vercel Drop](https://vercel.com/drop). It contains only the ready-to-serve site files with `index.html` at the ZIP root. Choose a project name and click **Deploy**. No build settings or backend environment variables are needed.

For this complete source ZIP, upload it through Vercel Drop or import it through GitHub. The included `vercel.json` sets build command **npm run build** and output directory **dist**. Hash routes work without server rewrites. ethers is vendored locally by the build; Google Fonts are optional and have system fallbacks.

Never publish `.env`, keystores, mnemonics or private keys.

## Limits and trust assumptions

- Designed for standard trusted 6-decimal payment ERC20s; no fee-on-transfer or rebasing tokens. Received payment deltas are checked.
- MockUSDC is an unrestricted faucet, so it has no value. Production payment-asset selection needs separate review.
- No upgrades, owner rescue of buyer reserves, token taxes, blacklist, vesting, liquidity lock, DEX integration, automated keeper or cancellation flow.
- Missing the inventory deposit deadline leaves the sale unavailable; after the deadline it can finalize as failed.
- Each purchase must meet the minimum, even when the remaining hard-cap capacity is smaller. A sale may close below the hard cap and still succeed if it meets the soft cap.
- A wallet limit is not a per-person or anti-Sybil guarantee. Anyone may create launches; listing is not verification or endorsement.
- RPC access is required, with CORS support. Browser settings, wallet providers, rate limits and token transfer restrictions can affect availability.
- Factory registry reads are paginated at the contract layer; this MVP loads all pages for UI search. Add an indexer only if the product later needs large-scale analytics (not included here).
- The creator receives the non-sale token supply and successful net proceeds. Refund protection only applies when the sale fails. It does not guarantee project delivery or token value.
- No mainnet deployment, external audit or legal review has been performed.

## Resume description

Built a backend-free ERC20 launchpad with a Solidity factory, immutable fixed-price presales, escrowed token inventory, USDC contributions, permissionless finalization, pull-based claims/refunds and creator settlement. Integrated wallet/RPC interactions using ethers and tested settlement, cap enforcement and escrow solvency with local-EVM and Foundry tests.

Only claim that you implemented and understand the parts you can explain. Demonstrate the actual contract state transitions, not just the demo UI.

## License

MIT. OpenZeppelin, ethers and other dependencies retain their own licenses. Built assets include `vendor/ethers-LICENSE.md`.
