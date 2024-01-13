import dotenv from 'dotenv';

dotenv.config();

export default {
  port: 8080,
  host: 'localhost',
  adminPrivateKey: process.env.ADMIN_PK,
  relayerAddressA: process.env.RElAYER_ADDRESS_A,
  relayerAddressB: process.env.RElAYER_ADDRESS_B,
  rpcUrlA: process.env.RPC_URL_A,
  rpcUrlB: process.env.RPC_URL_B
};
