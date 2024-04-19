const fs = require("fs")
const axios = require("axios")
const parse = require("csv-parse")
const csv = require("csv")
const {
  Token,
  TokenAmount,
  Fetcher,
  Pair,
  Route,
  Trade,
  TradeType,
  SOL,
} = require("@raydium-io/raydium-sdk")

// Function to fetch current price of a token
async function fetchTokenPrice(tokenSymbol) {
  try {
    const token = await Fetcher.fetchTokenData(
      Fetcher.MAINNET,
      tokenSymbol // Assuming the token symbol is compatible with Raydium
    )
    const pair = await Fetcher.fetchPairData(
      token,
      SOL // Using SOL as the quote token
    )
    const route = new Route([pair], token)
    const trade = new Trade(
      route,
      new TokenAmount(token, "1000000000"),
      TradeType.EXACT_INPUT
    )
    return trade.executionPrice.toSignificant(6) // Returning price in this example
  } catch (error) {
    console.error(`Error fetching price for ${tokenSymbol}:`, error)
    return null
  }
}

// Function to read CSV file and process data
async function processCSV() {
  try {
    const input = fs.createReadStream("liquidity_pools.csv")
    const parser = parse({ columns: true })
    const records = []

    parser.on("readable", function () {
      let record
      while ((record = parser.read())) {
        records.push(record)
      }
    })

    parser.on("end", async function () {
      for (const record of records) {
        const tokenSymbol = record["Mint"] // Assuming 'Mint' column contains token symbol
        const currentPrice = await fetchTokenPrice(tokenSymbol)

        if (currentPrice !== null) {
          const initialPrice = parseFloat(record["Price at +2min"])
          const priceEvolutionPercentage =
            ((currentPrice - initialPrice) / initialPrice) * 100

          record["Current Price"] = currentPrice
          record["Price Evolution (%)"] = priceEvolutionPercentage.toFixed(2)
        } else {
          record["Current Price"] = "N/A"
          record["Price Evolution (%)"] = "N/A"
        }
      }

      appendToCSV(records)
    })

    input.pipe(parser)
  } catch (error) {
    console.error("Error processing CSV:", error)
  }
}

// Function to append data into CSV file
function appendToCSV(records) {
  try {
    const output = fs.createWriteStream("liquidity_pools.csv", {
      flags: "a",
    }) // Append mode

    csv.write(records, { header: true, quoted: true }).pipe(output)

    console.log("New data appended to CSV file!")
  } catch (error) {
    console.error("Error appending to CSV:", error)
  }
}

// Function to periodically check for new liquidity pools
async function checkForNewLiquidityPools() {
  // Replace this with your logic to listen for program account changes
  // Polling every 5 minutes for demonstration purposes
  setInterval(async () => {
    const newLPs = await detectNewLiquidityPools()
    if (newLPs.length > 0) {
      console.log("New liquidity pools detected:", newLPs)
      // Process new liquidity pools here (e.g., add them to CSV)
      // For demonstration, let's just log them
    }
  }, 5 * 60 * 1000) // Polling interval: 5 minutes (adjust as needed)
}

// Function to detect new liquidity pools
async function detectNewLiquidityPools() {
  // Replace this with your logic to detect new liquidity pools
  // For demonstration, let's return a mock list of new liquidity pools
  return ["LP1", "LP2", "LP3"]
}

// Execute processing function
processCSV()

// Start checking for new liquidity pools
checkForNewLiquidityPools()
