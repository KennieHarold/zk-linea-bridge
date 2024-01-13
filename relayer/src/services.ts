import ethers from 'ethers';
import config from 'config';
import { log } from '@/utils/logger';

import ZKLineaBridgeForge from '../../bridge/build/contracts/ZKLineaBridgeForge.json';
import ZKLineaBridgeVault from '../../bridge/build/contracts/ZKLineaBridgeVault.json';

const rpcUrlA = config.get<string>('rpcUrlA');
const rpcUrlB = config.get<string>('rpcUrlB');
const providerA = new ethers.JsonRpcProvider(rpcUrlA);
const providerB = new ethers.JsonRpcProvider(rpcUrlB);

const adminPrivateKey = config.get<string>('adminPrivateKey');
const adminWalletA = new ethers.Wallet(adminPrivateKey, providerA);
const adminWalletB = new ethers.Wallet(adminPrivateKey, providerB);

const relayerAddress = config.get<string>('relayerAddress');
const forgeContract = new ethers.Contract(relayerAddress, ZKLineaBridgeForge.abi, adminWalletA);
const vaultContract = new ethers.Contract(relayerAddress, ZKLineaBridgeVault.abi, adminWalletB);

export const listenForgeContractEvents = () => {
  forgeContract.on('Burn', async (commitment, token, amount) => {
    const tx = await vaultContract.addCommitment(commitment);
    log.info(`Transaction hash: ${tx.hash}`);
  });
};

export const listenVaultContractEvents = () => {
  vaultContract.on('Locked', async (commitment, token, amount) => {
    const tx = await forgeContract.addCommitment(commitment);
    log.info(`Transaction hash: ${tx.hash}`);
  });
};
