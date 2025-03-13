import { Market } from '@/contract-types';
import { PriceDataUpdateInput } from '@/contract-types/Market';
import { HermesClient } from '@pythnetwork/hermes-client';
import { PythContract } from '@pythnetwork/pyth-fuel-js';
import { DateTime, Provider, Wallet, arrayify } from 'fuels';

// Read arg
const address = process.argv[2];

const main = async () => {
  const provider = new Provider('https://mainnet.fuel.network/v1/graphql');

  const wallet = Wallet.fromPrivateKey(process.env.PRIVATE_KEY!, provider);

  const marketContract = new Market(
    '0x657ab45a6eb98a4893a99fd104347179151e8b3828fd8f2a108cc09770d1ebae',
    wallet
  );

  const pythContract = new PythContract(
    '0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da',
    wallet
  );

  // const ACCOUNTS = [address];
  const ACCOUNTS: string[] = [
    '0x9afae1f7431825af93bba0bbb2cbcfb22f7bbdf0765c189259e0dbec1276aa3a',
    '0xbe8e597562f478ccd6e239838ebc7932bbdbc2b015c0835dc59bd7c70537eda0',
    '0x4c97c88307b9d1acaa6a4b9520841653a71be42128e372a625726783dc44b471',
    // '0xc3393c52ba483d628133cc209e15d3093993e2590a536a83d9c54af0c2ee6ff8',
    // '0x808770c48de7660f60263c3b9fc56768dab42989370b4761b3314a24e297a765',
    // '0xff82b07346be7135676b12e9e7d60495789828ddd23b9919c8f1d8befa735a6c',
    // '0x64afaf4c8af6cad73c52e5d3ee5a391b4d1e6634f9c7952db0471d18c04f48e3',
    // '0xef3bd21434610a564cbd5d0c9a22b961b14bd2142847f4b68f205d04f921d53d',
    // '0xc6bd151fec2257db383bc25608725ece4a158d893a1015acfa3e90483cd760da',
    // '0xfcaa60084f630f297a0bc4a1ba48b3cda6528330d973880079c10d3df8ba8535',
    // '0x265b76861e26894b2a31f13086653d372a76fa8a7438d2ab1c4473b6c3e4b966',
    // '0xe416d484d063def639fc0801d23cf4771ebc82fc4460d25cf2fd113ab186f25b',
    // '0x2aba7cd8ac62f57b0bc9b7deece099b158f81ab4ac761f8aed682a5b4ae10bc0',
    // '0x736aecec4046ad45fb191271a7808b3d395c0171ff08e2c27d3646039b3e0977',
    // '0x5061cab24ce9321821437e62622f874b5cc343cecb54d7986e4054bd5469a9d1',
    // '0xbfb05e291ba9f83fe3f9b1e57398aef2009a61c59a81ae0043e351e11b76b839',
    // '0xc56a248ce02d159d7257b6c8a3bdaf35825cc65f90a9f73023f94cdb0d1861d3',
  ];

  const hermesClient = new HermesClient(
    process.env.NEXT_PUBLIC_HERMES_API ?? 'https://hermes.pyth.network',
    {
      httpRetries: 1,
      timeout: 3000,
    }
  );

  const priceFeedIds = [
    '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    '0x06c217a791f5c4f988b36629af4cb88fad827b2485400a358f3b02886b54de92',
    '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    '0x710659c5a68e2416ce4264ca8d50d34acc20041d91289110eea152c52ff3dc39',
    '0x9ee4e7c60b940440a261eb54b6d8149c23b580ed7da3139f7f08f4ea29dad395',
    '0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784',
    '0x8a757d54e5d34c7ff1aea8502a2d968686027a304d00418092aaf7e60ed98d95',
  ];

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

  const { value: fee } = await marketContract.functions
    .update_fee(updateData)
    .addContracts([pythContract])
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

  //   const { value } = await marketContract.functions
  //     .is_liquidatable({ Address: { bits: ACCOUNT } })
  //     .addContracts([pythContract])
  //     .get();

  const { waitForResult } = await marketContract.functions
    .absorb(
      ACCOUNTS.map((account) => ({
        Address: {
          bits: account,
        },
      })),
      priceUpdateData
    )
    .callParams({
      forward: {
        amount: priceUpdateData.update_fee,
        assetId:
          '0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07',
      },
    })
    .addContracts([pythContract])
    .call();

  const transactionResult = await waitForResult();

  console.log(transactionResult.transactionId);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
