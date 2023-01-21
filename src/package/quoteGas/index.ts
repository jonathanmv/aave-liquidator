import {quoteGasFromOwlracle} from "./owlracle";
import invariant from "tiny-invariant";

const key = process.env.GAS_QUOTER_API_KEY;
invariant(key, `Missing required environment variable 'GAS_QUOTER_API_KEY'. Get one at https://owlracle.info/`);
const quoter = quoteGasFromOwlracle(key)

export function quoteGas() {
    return quoter();
}