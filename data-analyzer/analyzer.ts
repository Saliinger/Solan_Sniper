import fs from "fs"
import { Connection, KeyedAccountInfo } from "@solana/web3.js"
import {
  LIQUIDITY_STATE_LAYOUT_V4,
  MARKET_STATE_LAYOUT_V3,
  Token,
} from "@raydium-io/raydium-sdk"
import { AccountLayout } from "@solana/spl-token"
import { Listeners } from "./listeners"
import { PoolCache } from "./cache"
import {
  COMMITMENT_LEVEL,
  LOG_LEVEL,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  QUOTE_MINT,
  MIN_POOL_SIZE,
  MAX_POOL_SIZE,
  QUOTE_AMOUNT,
  PRIVATE_KEY,
  USE_SNIPE_LIST,
  ONE_TOKEN_AT_A_TIME,
  AUTO_SELL_DELAY,
  MAX_SELL_RETRIES,
  AUTO_SELL,
  MAX_BUY_RETRIES,
  AUTO_BUY_DELAY,
  COMPUTE_UNIT_LIMIT,
  COMPUTE_UNIT_PRICE,
  CACHE_NEW_MARKETS,
  TAKE_PROFIT,
  STOP_LOSS,
  BUY_SLIPPAGE,
  SELL_SLIPPAGE,
  PRICE_CHECK_DURATION,
  PRICE_CHECK_INTERVAL,
  SNIPE_LIST_REFRESH_INTERVAL,
  TRANSACTION_EXECUTOR,
  WARP_FEE,
  FILTER_CHECK_INTERVAL,
  FILTER_CHECK_DURATION,
  CONSECUTIVE_FILTER_MATCHES,
  logger
} from "./helpers"

const OUTPUT_FILE = "liquidity_pools.csv"

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  commitment: COMMITMENT_LEVEL,
})

logger.level = LOG_LEVEL

const poolCache = new PoolCache()

const listeners = new Listeners(connection)
listeners.on("pool", async (updatedAccountInfo: KeyedAccountInfo) => {
  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(
    updatedAccountInfo.accountInfo.data
  )
  const poolOpenTime = parseInt(poolState.poolOpenTime.toString())

  const poolData = await poolCache.get(poolState.baseMint.toString())
  if (!poolData && poolOpenTime > runTimestamp) {
    const currentDate = new Date().toISOString()
    const mint = poolState.baseMint.toString()
    const burned = isMintBurned(mint)
    const renounced = isMintRenounced(mint)
    const poolAccounts = await poolAccounts(poolState)
    const baseBalance = poolAccounts.baseTokenAccount.balance
    const quoteBalance = poolAccounts.quoteTokenAccount.balance
    const size = baseBalance + quoteBalance
    const currentPrice = await getPriceFromExchange(mint)

    const csvRow = `${currentDate},${mint},${burned},${renounced},${size},${currentPrice}\n`

    fs.appendFile(OUTPUT_FILE, csvRow, (err) => {
      if (err) {
        logger.error(`Error writing to CSV file: ${err}`)
      } else {
        logger.debug(`Data written to ${OUTPUT_FILE}: ${csvRow}`)
      }
    })
  }
})

listeners.start({
  // Pass required config for listener
})
function isMintBurned(mint: string) {
  throw new Error("Function not implemented.")
}

function isMintRenounced(mint: string) {
  throw new Error("Function not implemented.")
}
function getPriceFromExchange(mint: string) {
  throw new Error("Function not implemented.")
}

