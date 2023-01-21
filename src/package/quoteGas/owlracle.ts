import fetch from "node-fetch";

//https://owlracle.info/docs#endpoint-gas

type OwlracleGasQuoteResponse = {
  timestamp: string; // DATE ISO String
  lastBlock: number;
  avgTime: number;
  avgTx: number;
  avgGas: number;
  speeds: [
    {
      acceptance: number;
      maxFeePerGas: number;
      maxPriorityFeePerGas: number;
      baseFee: number;
      estimatedFee: number;
    }
  ];
};

type OwlracleGasQuoteRequestParams = {
  apikey: string;
  blocks?: number;
  percentile?: number;
  accept?: number[];
  feeinusd?: boolean;
  eip1559?: boolean;
  reportwei?: boolean;
};

export const fetchGasQuote = async (
  params: OwlracleGasQuoteRequestParams
): Promise<OwlracleGasQuoteResponse> => {
  const network = "eth";
  const res = await fetch(
    `https://api.owlracle.info/v3/${network}/gas?apikey=${params.apikey}`
  );
  return res.json();
};

const rateLimiter = (rateInMs: number) => {
  let waitUntil = 0;
  return {
    reset: () => (waitUntil = Date.now() + rateInMs),
    mustWait: () => waitUntil - Date.now() > 0,
  };
};

const oneSlotCache = <T>() => {
  let memory: T;
  return {
    set: (value: T) => (memory = value),
    get: () => memory,
  }
};

export function quoteGasFromOwlracle(apikey: string) {
  const c = oneSlotCache<OwlracleGasQuoteResponse>();
  const r = rateLimiter((3600 / 100) * 1000); // Owlracle has a rate limit of 100 req/h
  return async () => {
    if (r.mustWait()) {
      console.log("Hit api limit. Returned cache result", c.get());
      return c.get();
    }

    console.log(`Gas cache miss. Fetching...`);
    r.reset();
    c.set(await fetchGasQuote({ apikey }));
    return c.get();
  };
}
