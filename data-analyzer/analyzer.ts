import { MarketCache, PoolCache } from "./cache"
import { Listeners } from "./listeners"
import { Connection, KeyedAccountInfo, Keypair } from "@solana/web3.js"
import {
  LIQUIDITY_STATE_LAYOUT_V4,
  MARKET_STATE_LAYOUT_V3,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk"
import { AccountLayout, getAssociatedTokenAddressSync } from "@solana/spl-token"
import { Bot, BotConfig } from "./bot"
import { DefaultTransactionExecutor, TransactionExecutor } from "./transactions"
import {
  getToken,
  getWallet,
  logger,
  COMMITMENT_LEVEL,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  PRE_LOAD_EXISTING_MARKETS,
  LOG_LEVEL,
  CHECK_IF_MINT_IS_RENOUNCED,
  CHECK_IF_BURNED,
  QUOTE_MINT,
  MAX_POOL_SIZE,
  MIN_POOL_SIZE,
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
} from "./helpers"

const fs = require("fs")
const csvWriter = require("csv-write-stream")
const writer = csvWriter({ sendHeaders: false })

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  commitment: COMMITMENT_LEVEL,
})

function printDetails(
  wallet: Keypair,
  quoteToken: Token,
  bot: Bot,
  startTime: Date
) {
  const currentTime = new Date()
  const timeDiff = Math.abs(currentTime.getTime() - startTime.getTime())
  const minutes = Math.floor(timeDiff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  logger.info(`  
                                        ..   :-===++++-     
                                .-==+++++++- =+++++++++-    
            ..:::--===+=.=:     .+++++++++++:=+++++++++:    
    .==+++++++++++++++=:+++:    .+++++++++++.=++++++++-.    
    .-+++++++++++++++=:=++++-   .+++++++++=:.=+++++-::-.    
     -:+++++++++++++=:+++++++-  .++++++++-:- =+++++=-:      
      -:++++++=++++=:++++=++++= .++++++++++- =+++++:        
       -:++++-:=++=:++++=:-+++++:+++++====--:::::::.        
        ::=+-:::==:=+++=::-:--::::::::::---------::.        
         ::-:  .::::::::.  --------:::..                    
          :-    .:.-:::.                                    

          WARP DRIVE ACTIVATED 🚀🐟
          Made with ❤️ by humans.
          Version: none                                         
  `)

  const botConfig = bot.config

  logger.info("------- CONFIGURATION START -------")
  logger.info(`Wallet: ${wallet.publicKey.toString()}`)

  logger.info("- Bot -")

  logger.info(`Using warp: ${bot.isWarp}`)
  if (bot.isWarp) {
    logger.info(`Warp fee: ${WARP_FEE}`)
  } else {
    logger.info(`Compute Unit limit: ${botConfig.unitLimit}`)
    logger.info(`Compute Unit price (micro lamports): ${botConfig.unitPrice}`)
  }

  logger.info(`Single token at the time: ${botConfig.oneTokenAtATime}`)
  logger.info(`Pre load existing markets: ${PRE_LOAD_EXISTING_MARKETS}`)
  logger.info(`Cache new markets: ${CACHE_NEW_MARKETS}`)
  logger.info(`Log level: ${LOG_LEVEL}`)

  logger.info("- Buy -")
  logger.info(
    `Buy amount: ${botConfig.quoteAmount.toFixed()} ${
      botConfig.quoteToken.name
    }`
  )
  logger.info(`Auto buy delay: ${botConfig.autoBuyDelay} ms`)
  logger.info(`Max buy retries: ${botConfig.maxBuyRetries}`)
  logger.info(
    `Buy amount (${quoteToken.symbol}): ${botConfig.quoteAmount.toFixed()}`
  )
  logger.info(`Buy slippage: ${botConfig.buySlippage}%`)

  logger.info("- Sell -")
  logger.info(`Auto sell: ${AUTO_SELL}`)
  logger.info(`Auto sell delay: ${botConfig.autoSellDelay} ms`)
  logger.info(`Max sell retries: ${botConfig.maxSellRetries}`)
  logger.info(`Sell slippage: ${botConfig.sellSlippage}%`)
  logger.info(`Price check interval: ${botConfig.priceCheckInterval} ms`)
  logger.info(`Price check duration: ${botConfig.priceCheckDuration} ms`)
  logger.info(`Take profit: ${botConfig.takeProfit}%`)
  logger.info(`Stop loss: ${botConfig.stopLoss}%`)

  logger.info("- Filters -")
  logger.info(`Snipe list: ${botConfig.useSnipeList}`)
  logger.info(`Snipe list refresh interval: ${SNIPE_LIST_REFRESH_INTERVAL} ms`)
  logger.info(`Check renounced: ${botConfig.checkRenounced}`)
  logger.info(`Check burned: ${botConfig.checkBurned}`)
  logger.info(`Min pool size: ${botConfig.minPoolSize.toFixed()}`)
  logger.info(`Max pool size: ${botConfig.maxPoolSize.toFixed()}`)

  logger.info("------- CONFIGURATION END -------")

  logger.info("Bot is running! Press CTRL + C to stop it.")

  writer.pipe(fs.createWriteStream("bot_log.csv", { flags: "a" }))
  writer.write({
    Date: startTime.toISOString().split("T")[0],
    Time: `${days} days ${hours} hours ${minutes} minutes`,
    Burned: botConfig.checkBurned,
    Renounced: botConfig.checkRenounced,
    PoolSize: botConfig.minPoolSize.toFixed(),
    CurrentPrice: botConfig.quoteToken.name,
  })
  writer.end()
}

const runListener = async () => {
  logger.level = LOG_LEVEL
  logger.info("Bot is starting...")

  const marketCache = new MarketCache(connection)
  const poolCache = new PoolCache()
  let txExecutor: TransactionExecutor

  switch (TRANSACTION_EXECUTOR) {
    default: {
      txExecutor = new DefaultTransactionExecutor(connection)
      break
    }
  }

  const wallet = getWallet(PRIVATE_KEY.trim())
  const quoteToken = getToken(QUOTE_MINT)
  const botConfig = <BotConfig>{
    wallet,
    quoteAta: getAssociatedTokenAddressSync(quoteToken.mint, wallet.publicKey),
    checkRenounced: CHECK_IF_MINT_IS_RENOUNCED,
    checkBurned: CHECK_IF_BURNED,
    minPoolSize: new TokenAmount(quoteToken, MIN_POOL_SIZE, false),
    maxPoolSize: new TokenAmount(quoteToken, MAX_POOL_SIZE, false),
    quoteToken,
    quoteAmount: new TokenAmount(quoteToken, QUOTE_AMOUNT, false),
    oneTokenAtATime: ONE_TOKEN_AT_A_TIME,
    useSnipeList: USE_SNIPE_LIST,
    autoSellDelay: AUTO_SELL_DELAY,
    maxSellRetries: MAX_SELL_RETRIES,
    autoBuyDelay: AUTO_BUY_DELAY,
    maxBuyRetries: MAX_BUY_RETRIES,
    unitLimit: COMPUTE_UNIT_LIMIT,
    unitPrice: COMPUTE_UNIT_PRICE,
    takeProfit: TAKE_PROFIT,
    stopLoss: STOP_LOSS,
    buySlippage: BUY_SLIPPAGE,
    sellSlippage: SELL_SLIPPAGE,
    priceCheckInterval: PRICE_CHECK_INTERVAL,
    priceCheckDuration: PRICE_CHECK_DURATION,
  }

  const bot = new Bot(connection, marketCache, poolCache, txExecutor, botConfig)
  const valid = await bot.validate()

  if (!valid) {
    logger.info("Bot is exiting...")
    process.exit(1)
  }

  if (PRE_LOAD_EXISTING_MARKETS) {
    await marketCache.init({ quoteToken })
  }

  const startTime = new Date()

  const runTimestamp = Math.floor(startTime.getTime() / 1000)
  const listeners = new Listeners(connection)
  await listeners.start({
    walletPublicKey: wallet.publicKey,
    quoteToken,
    autoSell: AUTO_SELL,
    cacheNewMarkets: CACHE_NEW_MARKETS,
  })

  listeners.on("pool", async (updatedAccountInfo: KeyedAccountInfo) => {
    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(
      updatedAccountInfo.accountInfo.data
    )
    const poolOpenTime = parseInt(poolState.poolOpenTime.toString())
    const exists = await poolCache.get(poolState.baseMint.toString())

    if (!exists && poolOpenTime > runTimestamp) {
      poolCache.save(updatedAccountInfo.accountId.toString(), poolState)
      printDetails(wallet, quoteToken, bot, startTime)
    }
  })
}

runListener()
