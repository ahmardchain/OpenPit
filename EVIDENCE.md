# EVIDENCE — real on-chain orders on dreamDEX Perps (Somnia Hideki testnet, chain 50383)

Explorer: https://explorer.testnet.somnia.network/tokyo

Each run of `npm run smoke` appends below. The end-to-end pit run (create → join from a second wallet → settle → close) is logged at the bottom.


## Summary (all on Somnia Hideki testnet, chain 50383 — every link is a real, successful transaction)

| step | wallet | tx |
| --- | --- | --- |
| Margin deposit (100 USDso) | creator `0x86f9…065C` | https://explorer.testnet.somnia.network/tokyo/tx/0xc817a3b977acf5b49371917e9032d3d09653b331582c5abdae04e4dd9f0deefa |
| Smoke: BTC LONG IOC open (filled) | creator | https://explorer.testnet.somnia.network/tokyo/tx/0x2ac193f87749d0af11f457e4914ec5131ffcc0e5f02bace5ef408236b0918403 |
| Smoke: BTC close (reduce IOC, filled) | creator | https://explorer.testnet.somnia.network/tokyo/tx/0x7f16d07c04ae6a07ba45f6adebda5da35ed0057b69c7e298672a8fef5d5f8ee1 |
| Margin deposit (50 USDso) | joiner `0x0F09…4CAE` | https://explorer.testnet.somnia.network/tokyo/tx/0xaab8393698806843720479dc3150fd4f3f56d380e272099b48e427c715084612 |
| **Pit opening order** — BTC LONG, 0.00029 BTC | creator | https://explorer.testnet.somnia.network/tokyo/tx/0x1b1d213d6bdbd5dc590222c5606d6825817a89242fd0f40da41226403a655ce3 |
| **Join — FADE (short)**, 0.00029 BTC | joiner | https://explorer.testnet.somnia.network/tokyo/tx/0x995ffa7c08e65293ad565f416295098c28a17f5ca4d08096bb0a80781f7716a9 |
| Bell: settled at block 50082193, frozen mark 66586.72 — winner joiner (+0.250% return-on-cap vs −0.249%) | — | pit `96d75d2404` |
| Close after bell | creator | https://explorer.testnet.somnia.network/tokyo/tx/0x647650c77a08fa41e73e3014802506c44f718ae576bd603e6588a7999a47db29 |
| Close after bell | joiner | https://explorer.testnet.somnia.network/tokyo/tx/0xba81ba931f1df43f6a783187184f241ddd3b142b0c416f2e94e7c85503c89369 |

Screenshots of the settled pit, the home page and the OG card are in [`docs/`](./docs).

## Seeded pit `e62795e1ee`

Inserted by `migrations/0002_seed_real_pit.sql` (and the same statements in `src/lib/seed.ts`) with `INSERT OR IGNORE`, so a fresh database opens on this settled Hideki pit. The hashes below are copied from that file.

| | |
| --- | --- |
| Pit | `e62795e1ee` — BTC-PERP, creator long, 5 minutes, $20 cap, settled at block 50253138, frozen mark from the row |
| Creator | `0x86f95901932352e0f25B6c4807268334D97c065C` |
| Opening order (also the creator's join) | https://explorer.testnet.somnia.network/tokyo/tx/0x940bd096e07cf65f200beb317f9796cf5569b9067b98f3c000b7da09d185e3bc |
| Joiner | `0x0F095219812512018b2A071200Da256bEA984CAE`, short |
| Fade order | https://explorer.testnet.somnia.network/tokyo/tx/0x4687673ae20ece3243bb551ad1cbc44e9007ecf2d5eaf86272e7f5d2a92e607c |
| Creator intent signature | `0x268ee51e737fb756cf70d1bde689c9a17b15df3c3ea4ad2ba0bbb55fb724e88a7623e20ea17f34992aff665c1002e6a6b8fd86b998a81c1844e820d1d81c83cf1c` |

This is a different run from pit `96d75d2404` in the summary above.
Note: `claimPerpVoucher` reverted for both fresh wallets with selector `0x3e31dcc2` although `getPerpVoucherEligibility` returned `eligible: true`; the app and scripts fall back to depositing wallet USDso (from the Somnia Tokyo Telegram faucet) into the MarginBank.

## Raw logs

## Smoke run 2026-11-14T13:15:22.522Z — wallet 0x86f95901932352e0f25B6c4807268334D97c065C
- Listed 60 perp markets via indexer
- STT balance: 50
- FAILED: @somnia-chain/markets-sdk: claim reverted: for an unknown reason.

## Smoke run 2026-11-14T13:16:20.684Z — wallet 0x86f95901932352e0f25B6c4807268334D97c065C
- Listed 60 perp markets via indexer
- STT balance: 49.999863314
- Voucher claim reverted (@somnia-chain/markets-sdk: claim reverted: for an unknown reason.); falling back to wallet USDso
- Deposited 100 USDso into MarginBank: https://explorer.testnet.somnia.network/tokyo/tx/0xc817a3b977acf5b49371917e9032d3d09653b331582c5abdae04e4dd9f0deefa
- Margin account: {"unlockedCollateralBalance":"100000000000000000000","lockedCollateral":"0","activePerpPools":[],"equity":"100000000000000000000","withdrawable":"100000000000000000000","imReq":"0","mmReq":"0","cmReq":"0","marginStatus":"Healthy","asOfBlock":"50077727"}
- BTC mark 66769.8746121114 maxSize {"priceable":true,"asOfBlock":"50077735","maxQuantity":"2682000","unalignedMaxQuantity":"2682191","increasingQuantity":"2682000","reducingQuantity":"0","lockAmount":"99992850830946877590","topUpRequired":"0","wallet":null,"fundingPayer":null,"mainWalletCapacity":null,"ownWalletPull":"0","mainWalletPull":"0","mainFundingBlocked":false,"placeable":true,"limitedBy":"collateral","lotSize":"1000","minQuantity":"13000","maxPositionSize":"10000000000","positionSize":"0","markPrice":"66763928285572450500000","effectiveImfBps":"250"}
  opening LONG qty=0.00037 BTC IOC @<=68772.9
  OPEN tx: https://explorer.testnet.somnia.network/tokyo/tx/0x2ac193f87749d0af11f457e4914ec5131ffcc0e5f02bace5ef408236b0918403 status=success fills=1
  position: size=0.00037 entry=66841.2
  CLOSE tx: https://explorer.testnet.somnia.network/tokyo/tx/0x7f16d07c04ae6a07ba45f6adebda5da35ed0057b69c7e298672a8fef5d5f8ee1 status=success fills=1
  position after close: size=0

## End-to-end pit run 2026-11-14T13:18:41.206Z
- creator 0x86f95901932352e0f25B6c4807268334D97c065C · joiner 0x0F095219812512018b2A071200Da256bEA984CAE · market BTC · 5 min · cap 20 USDso
- 0x86f95901932352e0f25B6c4807268334D97c065C voucher claim reverted (@somnia-chain/markets-sdk: claim reverted: for an unknown re); using wallet USDso
- 0x86f95901932352e0f25B6c4807268334D97c065C perps equity 49.984423 USDso, STT 39.954557086
- 0x0F095219812512018b2A071200Da256bEA984CAE voucher claim reverted (@somnia-chain/markets-sdk: claim reverted: for an unknown re); using wallet USDso
- 0x0F095219812512018b2A071200Da256bEA984CAE deposited 50 USDso into MarginBank: [0xaab83936…](https://explorer.testnet.somnia.network/tokyo/tx/0xaab8393698806843720479dc3150fd4f3f56d380e272099b48e427c715084612)
- 0x0F095219812512018b2A071200Da256bEA984CAE perps equity 50 USDso, STT 9.995338504
- creator opening LONG order (1 fills, qty 0.00029): [0x1b1d213d…](https://explorer.testnet.somnia.network/tokyo/tx/0x1b1d213d6bdbd5dc590222c5606d6825817a89242fd0f40da41226403a655ce3)
- pit created: http://localhost:3000/pit/96d75d2404 (intent EIP-191 signature 0xe783d1bb97…)
- joiner FADE (short) order (1 fills, qty 0.00029): [0x995ffa7c…](https://explorer.testnet.somnia.network/tokyo/tx/0x995ffa7c08e65293ad565f416295098c28a17f5ca4d08096bb0a80781f7716a9)
- join verified server-side via RPC receipt and recorded
- waiting 297s for the bell…
- settled at block 50082193, frozen mark 66586.7244679115215; winner 0x0F095219812512018b2A071200Da256bEA984CAE
  - 0x86f95901932352e0f25B6c4807268334D97c065C long: pnl -0.049727904305658765 USDso, return-on-cap -0.249%
  - 0x0F095219812512018b2A071200Da256bEA984CAE short: pnl 0.049988904305658765 USDso, return-on-cap 0.250%
- OG card: http://localhost:3000/api/og/96d75d2404
- creator close: [0x647650c7…](https://explorer.testnet.somnia.network/tokyo/tx/0x647650c77a08fa41e73e3014802506c44f718ae576bd603e6588a7999a47db29)
- joiner close: [0xba81ba93…](https://explorer.testnet.somnia.network/tokyo/tx/0xba81ba931f1df43f6a783187184f241ddd3b142b0c416f2e94e7c85503c89369)
- done ✅
