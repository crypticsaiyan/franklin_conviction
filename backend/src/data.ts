import { PriceClient } from '@blockrun/llm';

export interface MarketData {
  symbol: string;
  price: number;
  source?: string;
}

// Common full names → Pyth ticker symbols
const NAME_TO_TICKER: Record<string, string> = {
  BITCOIN:   'BTC',
  ETHEREUM:  'ETH',
  SOLANA:    'SOL',
  CARDANO:   'ADA',
  POLKADOT:  'DOT',
  AVALANCHE: 'AVAX',
  POLYGON:   'MATIC',
  CHAINLINK: 'LINK',
  ARBITRUM:  'ARB',
  OPTIMISM:  'OP',
  UNISWAP:   'UNI',
  DOGECOIN:  'DOGE',
  SHIBA:     'SHIB',
  RIPPLE:    'XRP',
  LITECOIN:  'LTC',
  COSMOS:    'ATOM',
  NEAR:      'NEAR',
  APTOS:     'APT',
  SUI:       'SUI',
  INJECTIVE: 'INJ',
};

function resolveSymbol(token: string): string {
  const upper = token.toUpperCase();
  return NAME_TO_TICKER[upper] ?? upper;
}

let _client: PriceClient | null = null;
function getClient(): PriceClient {
  if (!_client) _client = new PriceClient({ requireWallet: false });
  return _client;
}

export async function fetchMarketData(token: string): Promise<MarketData | null> {
  const ticker = resolveSymbol(token);
  try {
    const pt = await getClient().price('crypto', `${ticker}-USD`);
    return { symbol: ticker, price: pt.price, source: pt.source };
  } catch {
    return null;
  }
}

export function formatForPrompt(d: MarketData): string {
  return `Current live market data: ${d.symbol} = $${d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USD (source: ${d.source ?? 'pyth'})`;
}
