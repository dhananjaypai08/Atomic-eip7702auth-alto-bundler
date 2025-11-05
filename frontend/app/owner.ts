import { privateKeyToAccount } from 'viem/accounts'

export const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_PRIVATE_KEY as `0x${string}`);