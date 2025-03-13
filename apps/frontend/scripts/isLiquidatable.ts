import { Market } from '@/contract-types';
import { PythContract } from '@pythnetwork/pyth-fuel-js';
import BigNumber from 'bignumber.js';
import { Provider } from 'fuels';

// Read arg
const address = process.argv[2];
console.log(address);

const main = async () => {
  const provider = new Provider('https://mainnet.fuel.network/v1/graphql');

  const marketContract = new Market(
    '0x657ab45a6eb98a4893a99fd104347179151e8b3828fd8f2a108cc09770d1ebae',
    provider
  );

  const pythContract = new PythContract(
    '0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da',
    provider
  );

  const ACCOUNT = address;

  // const { value: userBasic } = await marketContract.functions
  //   .get_user_balance_with_interest({
  //     Address: { bits: ACCOUNT },
  //   })
  //   .get();

  // const normalized = BigNumber(userBasic.underlying.toString())
  //   .minus(BigNumber(2).pow(255))
  //   .dividedBy(10 ** 6);

  // console.log(normalized);

  const { value } = await marketContract.functions
    .is_liquidatable({ Address: { bits: ACCOUNT } })
    .addContracts([pythContract])
    .get();

  console.log(value);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
