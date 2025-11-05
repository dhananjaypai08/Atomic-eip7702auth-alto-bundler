import { createPublicClient, createWalletClient, http } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { to7702SimpleSmartAccount } from "permissionless/accounts"
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
 
export const client = createPublicClient({
  chain: sepolia,
  transport: http()
})
export const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_PRIVATE_KEY as `0x${string}`)
export const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
export const simpleAccount = process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT as any;
export const ENTRY_POINT = process.env.NEXT_PUBLIC_ENTRY_POINT as `0x${string}`;
export const usdcUnits = 6;
 
if(!simpleAccount){
  throw new Error("Missing NEXT_PUBLIC_SIMPLE_ACCOUNT in .env");
}
export const account = await to7702SimpleSmartAccount({
  client: client,
  owner,
  address: simpleAccount,
  entryPoint: {
    address: ENTRY_POINT,
    version: '0.8',
  }
})

export const walletClient = createWalletClient({
  account: account,
  chain: sepolia,
  transport: http(),
})

export const bundlerClient = createBundlerClient({
  client,
  chain: sepolia,
  transport: http('https://api.pimlico.io/v2/sepolia/rpc?apikey=' + process.env.NEXT_PUBLIC_PIMLICO_API_KEY),
})