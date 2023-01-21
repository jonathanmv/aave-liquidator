import { ChainId, TokenAmount, Pair, Currency, Fetcher } from '@uniswap/sdk'
import { wrappedCurrency } from '../utils/wrappedCurrency'
var providers = require('ethers').providers;
export enum PairState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID
}

export async function usePairs(currencies: [Currency | undefined, Currency | undefined][], chainId : ChainId): Pair[] {

//convert to to wrapped tokens where needed
  const tokens =
      currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId)
      ])
//convert to pairs and get their reserves
  const reserves = await getReserves(tokens)
  // console.log(`results ${JSON.stringify(reserves,null,2)}`)
  return reserves
}

export async function usePair(tokenA?: Currency, tokenB?: Currency): Pair[] {
  return usePairs([[tokenA, tokenB]])[0]
}

async function getReserves(tokens:[Token,Token][]): Pair[] {
  const results = await Promise.all(tokens.map(async([tokenA, tokenB]) => {
      if (tokenA && tokenB && tokenA.equals(tokenB)){
        return
      }
      //console.log (`tokenA ${tokenA.symbol} tokenB ${tokenB.symbol}`)
      try {
        return await Fetcher.fetchPairData(tokenA, tokenB)
      } catch(e){
        // console.log(`Error Fetching Pair Data`, tokenA, tokenB)
        // console.log(e);
      }
    }
  ))
  return results.filter(pair => !!pair);
}
