import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
 
const relay = privateKeyToAccount('0xd53b4392b771447c330d79dd04ad9fd673cb117e5fe355002ae3d3c3bd04e3ce')
 
export const walletClient = createWalletClient({
  account: relay,
  chain: sepolia,
  transport: http(),
})