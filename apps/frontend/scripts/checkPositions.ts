import { Market } from '@/contract-types';
import { PythContract } from '@pythnetwork/pyth-fuel-js';
import { Provider } from 'fuels';

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
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
