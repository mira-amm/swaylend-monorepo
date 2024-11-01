import { Market } from '@/contract-types';
import { FUEL_ETH_ASSET_ID, PythContract } from '@pythnetwork/pyth-fuel-js';
import { arrayify, DateTime, Provider, Wallet } from 'fuels';
import { HermesClient } from '@pythnetwork/hermes-client';
import { PriceDataUpdateInput } from '@/contract-types/Market';
import BigNumber from 'bignumber.js';

const main = async () => {
  const provider = await Provider.create(
    'https://mainnet.fuel.network/v1/graphql'
  );

  const wallet = Wallet.fromPrivateKey('', provider);
  const pythContract = new PythContract(
    '0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da',
    wallet
  );

  const marketContract = new Market(
    '0x657ab45a6eb98a4893a99fd104347179151e8b3828fd8f2a108cc09770d1ebae',
    wallet
  );

  const priceFeedIds = [
    '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    '0x06c217a791f5c4f988b36629af4cb88fad827b2485400a358f3b02886b54de92',
    '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    '0x710659c5a68e2416ce4264ca8d50d34acc20041d91289110eea152c52ff3dc39',
    '0x9ee4e7c60b940440a261eb54b6d8149c23b580ed7da3139f7f08f4ea29dad395',
    '0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784',
  ];

  const hermesClient = new HermesClient('https://hermes.pyth.network');

  // Fetch price updates from Hermes client
  const priceUpdates = await hermesClient.getLatestPriceUpdates(priceFeedIds);

  if (
    !priceUpdates ||
    !priceUpdates.parsed ||
    priceUpdates.parsed.length === 0
  ) {
    throw new Error('Failed to fetch price');
  }

  const buffer = Buffer.from(priceUpdates.binary.data[0], 'hex');
  const updateData = [arrayify(buffer)];

  const { value: fee } = await pythContract.functions
    .update_fee(updateData)
    // .addContracts([pythContract])
    .get();

  // Prepare the PriceDateUpdateInput object
  const priceUpdateData: PriceDataUpdateInput = {
    update_fee: fee,
    publish_times: priceUpdates.parsed.map((parsedPrice) =>
      DateTime.fromUnixSeconds(parsedPrice.price.publish_time).toTai64()
    ),
    price_feed_ids: priceFeedIds,
    update_data: updateData,
  };

  const { waitForResult } = await pythContract.functions
    .update_price_feeds_if_necessary(
      priceUpdateData.price_feed_ids,
      priceUpdateData.publish_times,
      priceUpdateData.update_data
    )
    .callParams({
      forward: {
        amount: priceUpdateData.update_fee,
        assetId:
          '0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07',
      },
    })
    .call();

  const result = await waitForResult();

  console.log(result.transactionId);

  //   const amount = BigNumber(10).pow(9).times(0.0001);

  //   const { waitForResult } = await marketContract.functions
  //     .withdraw_collateral(
  //       {
  //         bits: '0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07',
  //       },
  //       amount.toFixed(0),
  //       priceUpdateData
  //     )
  //     .callParams({
  //       forward: {
  //         amount: priceUpdateData.update_fee,
  //         assetId:
  //           '0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07',
  //       },
  //     })
  //     .call();

  //   const result = await waitForResult();

  //   console.log(result);
};

main().catch(console.error);
