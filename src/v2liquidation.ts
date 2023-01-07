import { TOKEN_LIST, APP_CHAIN_ID } from './constants';
import { ChainId, Token, TokenAmount } from '@uniswap/sdk'
import { useTradeExactIn } from './uniswap/trades';
import { gas_cost } from './utils/gas'
const GAS_USED_ESTIMATE = 1000000
const FLASH_LOAN_FEE = 0.009


const theGraphURL_v2_kovan = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2-kovan'
const theGraphURL_v2_mainnet = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2'
const theGraphURL_v2 = APP_CHAIN_ID == ChainId.MAINNET ? theGraphURL_v2_mainnet : theGraphURL_v2_kovan
const allowedLiquidation = .5 //50% of a borrowed asset can be liquidated
const healthFactorMax = 1 //liquidation can happen when less than 1
export var profit_threshold = .1 * (10**18) //in eth. A bonus below this will be ignored

const preloadedBorrowers = require('./data/borrowers.json');

const loadBorrowers = async ({ page , userId }: { page: number, userId?: string }) => {
  // https://api.thegraph.com/subgraphs/name/aave/protocol-v2/graphql?query=%0A++++%23%0A++++%23+Welcome+to+The+GraphiQL%0A++++%23%0A++++%23+GraphiQL+is+an+in-browser+tool+for+writing%2C+validating%2C+and%0A++++%23+testing+GraphQL+queries.%0A++++%23%0A++++%23+Type+queries+into+this+side+of+the+screen%2C+and+you+will+see+intelligent%0A++++%23+typeaheads+aware+of+the+current+GraphQL+type+schema+and+live+syntax+and%0A++++%23+validation+errors+highlighted+within+the+text.%0A++++%23%0A++++%23+GraphQL+queries+typically+start+with+a+%22%7B%22+character.+Lines+that+start%0A++++%23+with+a+%23+are+ignored.%0A++++%23%0A++++%23+An+example+GraphQL+query+might+look+like%3A%0A++++%23%0A++++%23+++++%7B%0A++++%23+++++++field%28arg%3A+%22value%22%29+%7B%0A++++%23+++++++++subField%0A++++%23+++++++%7D%0A++++%23+++++%7D%0A++++query+GET_LOANS+%7B%0A++++++++users%28first%3A1000%2C+orderBy%3A+id%2C+orderDirection%3A+desc%2C+where%3A+%7BborrowedReservesCount_gt%3A+0%7D%29+%7B%0A++++++++++id%0A++++++++++borrowedReservesCount%0A++++++++++collateralReserve%3Areserves%28where%3A+%7BcurrentATokenBalance_gt%3A+0%7D%29+%7B%0A++++++++++++currentATokenBalance%0A++++++++++++reserve%7B%0A++++++++++++++usageAsCollateralEnabled%0A++++++++++++++reserveLiquidationThreshold%0A++++++++++++++reserveLiquidationBonus%0A++++++++++++++borrowingEnabled%0A++++++++++++++utilizationRate%0A++++++++++++++symbol%0A++++++++++++++underlyingAsset%0A++++++++++++++price+%7B%0A++++++++++++++++priceInEth%0A++++++++++++++%7D%0A++++++++++++++decimals%0A++++++++++++%7D%0A++++++++++%7D%0A++++++++++borrowReserve%3A+reserves%28where%3A+%7BcurrentTotalDebt_gt%3A+0%7D%29+%7B%0A++++++++++++currentTotalDebt%0A++++++++++++reserve%7B%0A++++++++++++++usageAsCollateralEnabled%0A++++++++++++++reserveLiquidationThreshold%0A++++++++++++++borrowingEnabled%0A++++++++++++++utilizationRate%0A++++++++++++++symbol%0A++++++++++++++underlyingAsset%0A++++++++++++++price+%7B%0A++++++++++++++++priceInEth%0A++++++++++++++%7D%0A++++++++++++++decimals%0A++++++++++++%7D%0A++++++++++%7D%0A++++++++%7D%0A++++++%7D%0A++++%23%0A++++%23+Keyboard+shortcuts%3A%0A++++%23%0A++++%23++Prettify+Query%3A++Shift-Ctrl-P+%28or+press+the+prettify+button+above%29%0A++++%23%0A++++%23+++++Merge+Query%3A++Shift-Ctrl-M+%28or+press+the+merge+button+above%29%0A++++%23%0A++++%23+++++++Run+Query%3A++Ctrl-Enter+%28or+press+the+play+button+above%29%0A++++%23%0A++++%23+++Auto+Complete%3A++Ctrl-Space+%28or+just+start+typing%29%0A++++%23%0A++
  return preloadedBorrowers;
  const response = await fetch(theGraphURL_v2, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query GET_LOANS {
        users(first:1000, skip:${ 1000 * page}, orderBy: id, orderDirection: desc, where: {${userId}borrowedReservesCount_gt: 0}) {
          id
          borrowedReservesCount
          collateralReserve:reserves(where: {currentATokenBalance_gt: 0}) {
            currentATokenBalance
            reserve{
              usageAsCollateralEnabled
              reserveLiquidationThreshold
              reserveLiquidationBonus
              borrowingEnabled
              utilizationRate
              symbol
              underlyingAsset
              price {
                priceInEth
              }
              decimals
            }
          }
          borrowReserve: reserves(where: {currentTotalDebt_gt: 0}) {
            currentTotalDebt
            reserve{
              usageAsCollateralEnabled
              reserveLiquidationThreshold
              borrowingEnabled
              utilizationRate
              symbol
              underlyingAsset
              price {
                priceInEth
              }
              decimals
            }
          }
        }
      }`
    }),
  });
  return await response.json();
}

export const fetchV2UnhealthyLoans = async function fetchV2UnhealthyLoans(user_id: string | undefined) {
  var count=0;
  var maxCount=1
  var user_id_query=""

  if(user_id){
    user_id_query = `id: "${user_id}",`
    maxCount = 1
  }
  console.log(`${Date().toLocaleString()} fetching unhealthy loans from: ${theGraphURL_v2}`)
  while(count < maxCount){
    const res = await loadBorrowers({ page: 0, userId: user_id_query });
    const borrowersLoaded = res.data.users.length
    console.log(`Fetched ${borrowersLoaded} borrowers`);
    const unhealthyLoans = findUnhealthyLoans(res.data);
    console.log(`Found ${unhealthyLoans.length} unhealthy loans out of ${borrowersLoaded}`);
    const profitableLoans = unhealthyLoans.filter(isLoadProfitable);
    console.log(`Found ${profitableLoans.length} profitable loans`);
    liquidationProfits(profitableLoans);
    count++;
  }
}

function findUnhealthyLoans(payload) {
  console.log(`Finding unhealthy loans...`);
  var loans=[];
  payload.users.forEach((user, i) => {
    var totalBorrowed=0;
    var totalCollateral=0;
    var totalCollateralThreshold=0;
    var max_borrowedSymbol;
    var max_borrowedPrincipal=0;
    var max_borrowedPriceInEth = 0;
    var max_collateralSymbol;
    var max_collateralBonus=0;
    var max_collateralPriceInEth = 0;

    user.borrowReserve.forEach(borrowReserve => {
      var priceInEth = borrowReserve.reserve.price.priceInEth
      var principalBorrowed = borrowReserve.currentTotalDebt
      totalBorrowed += priceInEth * principalBorrowed / (10**borrowReserve.reserve.decimals)
      if (principalBorrowed > max_borrowedPrincipal) {
        max_borrowedSymbol = borrowReserve.reserve.symbol
        max_borrowedPrincipal = principalBorrowed
        max_borrowedPriceInEth = priceInEth
      }
    });
    user.collateralReserve.forEach(collateralReserve => {
      var priceInEth = collateralReserve.reserve.price.priceInEth
      var principalATokenBalance = collateralReserve.currentATokenBalance
      totalCollateral += priceInEth * principalATokenBalance / (10**collateralReserve.reserve.decimals)
      totalCollateralThreshold += priceInEth * principalATokenBalance * (collateralReserve.reserve.reserveLiquidationThreshold/10000)/ (10**collateralReserve.reserve.decimals)
      if (collateralReserve.reserve.reserveLiquidationBonus > max_collateralBonus) {
        max_collateralSymbol = collateralReserve.reserve.symbol
        max_collateralBonus=collateralReserve.reserve.reserveLiquidationBonus
        max_collateralPriceInEth = priceInEth
      }
    });
    var healthFactor= totalCollateralThreshold / totalBorrowed;

    if (healthFactor<=healthFactorMax) {
      const unhealthyLoad = {
        "user_id"  :  user.id,
        "healthFactor"   :  healthFactor,
        "max_collateralSymbol" : max_collateralSymbol,
        "max_borrowedSymbol" : max_borrowedSymbol,
        "max_borrowedPrincipal" : max_borrowedPrincipal,
        "max_borrowedPriceInEth" : max_borrowedPriceInEth,
        "max_collateralBonus" : max_collateralBonus/10000,
        "max_collateralPriceInEth" : max_collateralPriceInEth
      };
      console.log(`Found unhealthy load`, unhealthyLoad);
      loans.push(unhealthyLoad);
    }
  });

  return loans;
}

const isLoadProfitable = loan => {
  try {
    if (!(loan.max_borrowedSymbol in TOKEN_LIST)) {
      throw new Error(`${loan.max_borrowedSymbol} is not supported in the TOKEN_LIST: ${Object.keys(TOKEN_LIST).join()}`);
    } 
    return loan.max_borrowedPrincipal * allowedLiquidation * (loan.max_collateralBonus-1) * loan.max_borrowedPriceInEth / 10 ** TOKEN_LIST[loan.max_borrowedSymbol].decimals >= profit_threshold;
  } catch (error: any) {
    console.error(`Couldn't check if load is profitable`, loan, error.message);
    return false;
  }
}

async function liquidationProfits(loans){
  console.log(`Liquidating ${loans.length} loans...`);
  loans.map(async (loan) => {
    liquidationProfit(loan)
  })
  console.log(`${loans.length} liquidated.`);
}

async function liquidationProfit(loan){
  //flash loan fee
  const flashLoanAmount = percentBigInt(BigInt(loan.max_borrowedPrincipal), allowedLiquidation)
  const flashLoanCost = percentBigInt(flashLoanAmount, FLASH_LOAN_FEE)

  //minimum amount of liquidated coins that will be paid out as profit
  var flashLoanAmountInEth = flashLoanAmount * BigInt(loan.max_borrowedPriceInEth) / BigInt(10 ** TOKEN_LIST[loan.max_borrowedSymbol].decimals)
  var flashLoanAmountInEth_plusBonus = percentBigInt(flashLoanAmountInEth,loan.max_collateralBonus) //add the bonus
  var collateralTokensFromPayout  = flashLoanAmountInEth_plusBonus * BigInt(10 ** TOKEN_LIST[loan.max_collateralSymbol].decimals) / BigInt(loan.max_collateralPriceInEth) //this is the amount of tokens that will be received as payment for liquidation and then will need to be swapped back to token of the flashloan
  var fromTokenAmount = new TokenAmount(TOKEN_LIST[loan.max_collateralSymbol], collateralTokensFromPayout)// this is the number of coins to trade (should have many 0's)
  var bestTrade = await useTradeExactIn(fromTokenAmount,TOKEN_LIST[loan.max_borrowedSymbol])

  var minimumTokensAfterSwap = bestTrade ? (BigInt(bestTrade.outputAmount.numerator) * BigInt(10 ** TOKEN_LIST[loan.max_borrowedSymbol].decimals)) / BigInt(bestTrade.outputAmount.denominator) : BigInt(0)

  //total profits (bonus_after_swap - flashLoanCost).to_eth - gasFee
  var gasFee = gasCostToLiquidate() //calc gas fee
  var flashLoanPlusCost = (flashLoanCost + flashLoanAmount)
  var profitInBorrowCurrency = minimumTokensAfterSwap - flashLoanPlusCost
  var profitInEth = profitInBorrowCurrency * BigInt(loan.max_borrowedPriceInEth) / BigInt(10 ** TOKEN_LIST[loan.max_borrowedSymbol].decimals)
  var profitInEthAfterGas = (profitInEth)  - gasFee

  if (profitInEthAfterGas>0.1)
  {
    console.log("-------------------------------")
    console.log(`user_ID:${loan.user_id}`)
    console.log(`HealthFactor ${loan.healthFactor.toFixed(2)}`)
    console.log(`flashLoanAmount ${flashLoanAmount} ${loan.max_borrowedSymbol}`)
    console.log(`flashLoanAmount converted to eth ${flashLoanAmountInEth}`)
    console.log(`flashLoanAmount converted to eth plus bonus ${flashLoanAmountInEth_plusBonus}`)
    console.log(`payout in collateral Tokens ${collateralTokensFromPayout} ${loan.max_collateralSymbol}`)
    console.log(`${loan.max_borrowedSymbol} received from swap ${minimumTokensAfterSwap} ${loan.max_borrowedSymbol}`)
    bestTrade ? showPath(bestTrade) : console.log("no path")
    console.log(`flashLoanPlusCost ${flashLoanPlusCost}`)
    console.log(`gasFee ${gasFee}`)
    console.log(`profitInEthAfterGas ${Number(profitInEthAfterGas)/(10 ** 18)}eth`)
  }
    //console.log(`user_ID:${loan.user_id} HealthFactor ${loan.healthFactor.toFixed(2)} allowedLiquidation ${flashLoanAmount.toFixed(2)} ${loan.max_collateralSymbol}->${loan.max_borrowedSymbol}` )
    //console.log(`minimumTokensAfterSwap ${minimumTokensAfterSwap} flashLoanCost ${flashLoanCost} gasFee ${gasFee} profit ${profit.toFixed(2)}`)




}
//returned value is in eth
function gasCostToLiquidate(){
  return BigInt(gas_cost * GAS_USED_ESTIMATE)
}
// percent is represented as a number less than 0 ie .75 is equivalent to 75%
// multiply base and percent and return a BigInt
function percentBigInt(base:BigInt,percent:decimal):BigInt {
  return BigInt(base * BigInt(percent * 10000) / 10000n)
}
function showPath(trade:Trade){
  var pathSymbol=""
  var pathAddress= []
  trade.route.path.map(async (token) => {
     pathSymbol+=token.symbol+"->"
     pathAddress.push(token.address)
     })
  pathSymbol=pathSymbol.slice(0,-2)
  console.log(`${pathSymbol} ${JSON.stringify(pathAddress)}`)
  return [pathSymbol,pathAddress]
}
