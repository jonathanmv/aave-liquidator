import "core-js/stable";
import "regenerator-runtime/runtime";
import { ChainId, Token, WETH, Fetcher, Route, TokenAmount } from '@uniswap/sdk'
import { useAllCommonPairs, useTradeExactIn } from './uniswap/trades.ts';
import { setGlobals } from './globals';

import { liquidate } from './liquidation/liquidation';
import { getGas,gas_cost } from './utils/gas'
import { fetchV2UnhealthyLoans } from './v2liquidation';
require('isomorphic-fetch');
import { quoteGas }  from "./package/quoteGas";

//infinite loop calling fetchUnhealthyLoans
//sleep for 1 minute before each call
async function run(){
  //var fromTokenAmount = new TokenAmount(TOKEN_LIST["WBTC"], 1000)// this is the number of coins to trade (should have many 0's)
  //console.log (JSON.stringify(useTradeExactIn(fromTokenAmount,TOKEN_LIST["ZRX"]), null, 2))
  //fetchV2UnhealthyLoans("0xfe206f90c58feb8e42474c5074de43c22da8bc35");
  const sleepInMins = 1/6;
  while(true){
console.log(`
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/////////////////       FETCHING LOANS      //////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
`)

    console.log(`Getting gas ...`)
    const quote = await quoteGas();
    console.log(`gas cost`, quote);
    
    console.log("fetching loans...")
    // await fetchV2UnhealthyLoans(undefined);

    await sleep(sleepInMins * 60000);
  }
  //TODO calculate liquidation threshold daily

}

function sleep(ms: number) {
  console.log(`Sleeping ${ms / 1000} secs...`)
  return new Promise<void>(resolve => setTimeout(() => {
    console.log(`Waking up after sleeping ${ms / 1000} secs.`)
    resolve();
  }, ms));
}


/*
This is a place holder for implementing the liquidation call which would fully automate this bot
require('dotenv').config()

setGlobals();
liquidate(
  assetToLiquidate, //the token address of the asset that will be liquidated
  flashAmt, //flash loan amount (number of tokens) which is exactly the amount that will be liquidated
  collateral, //the token address of the collateral. This is the token that will be received after liquidating loans
  userToLiquidate, //user ID of the loan that will be liquidated
  amountOutMin, //when using uniswap this is used to make sure the swap returns a minimum number of tokens, or will revert
  swapPath, //the path that uniswap will use to swap tokens back to original tokens
)
*/

try {
  run();
} catch (e: any) {
  console.error(`Error running ${e.message}`)
  console.error(`
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/////////////////////////       ERROR     ////////////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
  `)
  console.error(e);
}