import { parseAbi } from "viem";

/** Subset of PerpPool / MarginBank reads used for same-block Reactivity eth_calls and polling. */
export const perpPoolReadAbi = parseAbi([
  "function tryGetMarkPrice() view returns (bool ok, uint256 price)",
  "function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))",
]);

export const marginBankReadAbi = parseAbi([
  "function getPosition(address account, address perpPool) view returns ((int128 size, uint128 avgEntryPrice, int256 entryFundingIndex, uint64 lastUpdatedTimestampNs))",
  "function getAccountState(address account) view returns ((int256 unlockedCollateralBalance, uint256 lockedCollateral, address[] activePerpPools))",
]);

export const orderFilledEvent = parseAbi([
  "event OrderFilled(uint128 indexed takerOrderId, uint128 indexed makerOrderId, uint256 quantityFilled, uint256 takerRemainingQuantity, uint256 makerRemainingQuantity, uint256 fillPrice)",
])[0];

export const positionUpdatedEvent = parseAbi([
  "event PositionUpdated(address indexed account, address indexed perpPool, int128 newSize, uint128 avgEntryPrice, int256 realizedPnl, int256 entryFundingIndex)",
])[0];
