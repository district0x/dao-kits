# TCR Kit

DAO Kit for Token Curated Registries.

## Test

If you want to test it locally on the geth image, follow these steps:

- Run `docker-composer up` from `kits/beta` folder to spin up a geth image.
- Run `export OWNER=0x1f7402f55e142820ea3812106d0657103fc1709e; ./scripts/deploy_ens_apm_tokens.sh` to deploy `ENS` and `APM` and some tokens locally.
- TODO

To test it on a local devchain:
- Spin it up in a separate tab with `aragon run devchain --reset`
- Deloy a token:
```
cd ../../helpers/test-token-deployer
npm run migrate:local
cd -
```
- Deploy Kit and an instance of it:

```
rm -Rf build/contracts
npx truffle compile
ENS=0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1 OWNER=0xb4124cEB3451635DAcedd11767f004d8a28c6eE7 npx truffle exec --network rpc scripts/deploy_kit.js
OWNER=0xb4124cEB3451635DAcedd11767f004d8a28c6eE7 npx truffle exec --network rpc scripts/deploy_tcr.js /tmp/tcr_params.json /tmp/result.json
```
