import { Market } from '@/contract-types';
import { PriceDataUpdateInput } from '@/contract-types/Market';
import { HermesClient } from '@pythnetwork/hermes-client';
import { PythContract } from '@pythnetwork/pyth-fuel-js';
import BigNumber from 'bignumber.js';
import { DateTime, Provider, arrayify } from 'fuels';

const assets: Record<string, string> = {
  '0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07': 'ETH',
  '0x286c479da40dc953bddc3bb4c453b608bba2e0ac483b077bd475174115395e6b': 'USDC',
  '0xa0265fb5c32f6e8db3197af3c7eb05c48ae373605b8165b6f4a51c5b0ba4812e': 'USDT',
  '0x91b3559edb2619cde8ffb2aa7b3c3be97efd794ea46700db7092abeee62281b0': 'ezETH',
  '0x1493d4ec82124de8f9b625682de69dcccda79e882b89a55a8c737b12de67bd68': 'pzETH',
  '0x9e46f919fbf978f3cad7cd34cca982d5613af63ff8aab6c379e4faa179552958': 'sDAI',
  '0x239ed6e12b7ce4089ee245244e3bf906999a6429c2a9a445a1e1faf56914a4ab': 'weETH',
  '0x1a7815cc9f75db5c24a5b0814bfb706bb9fe485333e98254015de8f48f84c67b':
    'wstETH',
  '0x1186afea9affb88809c210e13e2330b5258c2cef04bb8fff5eff372b7bd3f40f':
    'SolvBTC',
  '0x7a4f087c957d30218223c2baaaa365355c9ca81b6ea49004cfb1590a5399216f':
    'SolvBTC.BBN',
};

const main = async () => {
  const provider = new Provider('https://mainnet.fuel.network/v1/graphql');

  const marketContract = new Market(
    '0x657ab45a6eb98a4893a99fd104347179151e8b3828fd8f2a108cc09770d1ebae',
    provider
  );

  for (const assetId in assets) {
    const { value } = await marketContract.functions
      .get_collateral_reserves({ bits: assetId })
      .get();

    const normalized = BigNumber(value.underlying.toString()).minus(
      BigNumber(2).pow(255)
    );

    console.log(`Reserves for ${assets[assetId]}: ${normalized}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
