// import { toNano } from '@ton/core';
// import { Example } from '../wrappers/Example';
// import { compile, NetworkProvider } from '@ton/blueprint';

// export async function run(provider: NetworkProvider) {
//     const example = provider.open(
//         Example.createFromConfig(
//             {
//                 id: Math.floor(Math.random() * 10000),
//                 counter: 0,
//             },
//             await compile('Example')
//         )
//     );

//     await example.sendDeploy(provider.sender(), toNano('0.05'));

//     await provider.waitForDeploy(example.address);

//     console.log('ID', await example.getID());
// }

import dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, Cell, WalletContractV4, toNano, WalletContractV3R2 } from "@ton/ton";
import { Example } from '../wrappers/Example';

export async function run() {
  // initialize ton rpc client on testnet
  const endpoint = await getHttpEndpoint({ network: "testnet" });
  // const client = new TonClient({ endpoint });
  const client = new TonClient({ endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC", apiKey: process.env.API_KEY });

  // prepare Counter's initial code and data cells for deployment
  const counterCode = Cell.fromBoc(fs.readFileSync("build/example.cell"))[0]; // compilation output from step 6
  const initialCounterValue = Date.now(); // to avoid collisions use current number of milliseconds since epoch as initial value
//   const example = Example.createForDeploy(counterCode, initialCounterValue);
  const example = Example.createFromConfig({ id: Math.floor(Math.random() * 10000), counter: 0 }, counterCode);

  // exit if contract is already deployed
  console.log("contract address:", example.address.toString());
  if (await client.isContractDeployed(example.address)) {
    return console.log("Counter already deployed");
  }

  // open wallet v4 (notice the correct wallet version here)
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  const key = await mnemonicToWalletKey(mnemonic!.split(" "));
  const wallet = WalletContractV3R2.create({ publicKey: key.publicKey, workchain: 0 });
  console.log('Wallet Address: ', wallet.address);
  if (!await client.isContractDeployed(wallet.address)) {
    return console.log("wallet is not deployed");
  }

  // open wallet and read the current seqno of the wallet
  const walletContract = client.open(wallet);
  const walletSender = walletContract.sender(key.secretKey);
  const seqno = await walletContract.getSeqno();

  // send the deploy transaction
  const exampleContract = client.open(example);
  await exampleContract.sendDeploy(walletSender, toNano('0.05'));

  // wait until confirmed
  let currentSeqno = seqno;
  while (currentSeqno == seqno) {
    //console.log("waiting for deploy transaction to confirm...");
    await sleep(1500);
    currentSeqno = await walletContract.getSeqno();
  }
  console.log("deploy transaction confirmed!");
}

run()

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}