TokenLaunchpad

Live demo: https://tokenlaunchpad-pi.vercel.app/



A backend-free token launchpad: fixed-supply ERC20 creation, immutable USDC presales, escrowed inventory, permissionless settlement, claims and refunds. Dark responsive frontend with a completely separate local demo sandbox.

Portfolio / testnet project — unaudited, not production-ready. Do not use real money. No blockchain deployment is bundled by default. The hosted preview opens in Demo; On-chain mode requires a deployed factory and payment-token address.

What works

Landing page, Explore with filters/search, launch details, Create Launch, investor/creator Dashboard, guide and network setup.

Factory deploys one fixed-supply token and one independent presale per launch.

Creator approves and deposits the entire maximum sale inventory before opening.

Buyers approve the payment token and contribute during the sale window.

Immutable price, soft/hard caps, minimum purchase and cumulative per-wallet maximum.

Anyone can finalize after the deadline, or immediately at the hard cap.

Success: buyer token claims, creator proceeds minus a fixed 2% treasury fee, recovery of only unsold tokens.

Failure: full contributor refunds and return of creator token inventory.

Double-claim/refund/withdrawal protection, SafeERC20, ReentrancyGuard, exact base-unit arithmetic.

No Supabase, API server, database, authentication service, AI service or custody backend. The wallet is the identity; the blockchain is the state store.

Quick demo

Requirements: Node.js 20.19+ (22 LTS recommended), npm. Foundry is optional for the JavaScript/EVM tests.

npm ci
npm run build
npm run dev

Open the local URL printed by Vite. Choose Demo. The static dist folder is also ready to host after building. Do not open index.html via file://; ES modules require an HTTP server.

Try these paths:

Explore → Nova Protocol → Buy 100 demo USDC. Dashboard shows 1,000 NOVA allocated.

Lumen Finance → Finalize sale → Claim tokens. The pre-seeded position is 1,000 LUM. You also own this sample launch, so try Withdraw proceeds and Recover unsold tokens.

Echo Labs → Claim refund. Returns the pre-seeded 100 demo USDC contribution.

Create launch → Approve & fund → Jump to start → Buy → Jump past deadline → Finalize. Set a small soft cap if testing success; otherwise test refunds.

Dashboard → Reset sandbox restores samples. Demo state is device-local, not shared between browsers. Advancing demo time affects all sample sales.

The demo never signs a wallet transaction. It uses simplified human-unit bookkeeping for simulated amounts. Live mode uses ethers BigInt base units and never falls back to demo data.

Real local-chain workflow (no backend)

Terminal 1:

npm run chain

Terminal 2:

npm run deploy:local
npm run dev

deploy:local only accepts a loopback RPC on chain 31337. It deploys MockUSDC and the factory, mints 100,000 mock USDC to local accounts and writes public addresses to dist/config.js. It never writes private keys. The first local account is the fee treasury.

In MetaMask, add network 31337, RPC http://127.0.0.1:8545, currency ETH, and import a disposable account printed by the local chain. These development keys are public and must never receive real money. Switch the UI to On-chain, connect, create a launch and fund it before the start time.

To speed up a local test using Foundry:

cast rpc evm_increaseTime 3601 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545

Reload the UI after advancing the chain. Finalization still needs a transaction. The frontend never secretly changes chain time. A hosted HTTPS frontend may block local HTTP RPC; use the locally served frontend for local chains.

If you previously saved different settings in Setup, those browser preferences override dist/config.js; update them or use a fresh browser profile.

Sepolia deployment

Use your existing Foundry installation and an encrypted keystore, not a private key in frontend files. The included script refuses non-Sepolia networks and deploys a test-only faucet asset (mUSDC), not real USDC.

cast wallet import launchpad-deployer --interactive
cd contracts
# Set these shell variables to your own PUBLIC endpoint and testnet wallet.
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export TREASURY=YOUR_TESTNET_WALLET_ADDRESS
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url "$SEPOLIA_RPC_URL" --account launchpad-deployer --broadcast

Copy the emitted payment and factory addresses into the frontend Network setup form. Use chain ID 11155111, network name Sepolia and explorer https://sepolia.etherscan.io. The treasury gets 100,000 test mUSDC. Other test wallets can use the mock token's unrestricted mint method through an explorer or cast send with their keystore.

For a shared deployment, update the public values in dist/config.js and redeploy the frontend. Browser Setup only changes the current browser. Factory settings fix the payment token and treasury at deployment.

Testing

npm test                   # Pure demo state + DOM interaction tests (jsdom)
npm run test:contracts     # Compile Solidity and execute on Ganache EVM
node scripts/test-adapter.mjs # Exact frontend wallet adapter on a local EVM
cd contracts
forge test -vv             # Solidity unit and fuzz tests

The DOM tests are not visual/browser screenshots. EVM integration tests cover successful and failed settlement, cap checks, exact allocation, escrow protection, permission checks, replay prevention and fees. Fuzz tests cover allocation math, buyer-token solvency and refund conservation. This test suite is not a security audit.
