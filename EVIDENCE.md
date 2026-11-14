# EVIDENCE — real on-chain orders on dreamDEX Perps (Somnia Hideki testnet, chain 50383)

Explorer: https://explorer.testnet.somnia.network/tokyo

Each run of `npm run smoke` appends below. The end-to-end pit run (create → join from a second wallet → settle → close) is logged at the bottom.


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
