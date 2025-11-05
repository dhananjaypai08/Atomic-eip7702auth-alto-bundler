import { parseEther, parseUnits, SignAuthorizationReturnType } from 'viem'
import { account, bundlerClient, walletClient, owner, USDC, usdcUnits } from '../app/client'
import { erc20Abi } from 'viem'

export async function sendUserOperation(amount: string, to: `0x${string}`, authorization: SignAuthorizationReturnType) {
    const hash = await bundlerClient.sendUserOperation({
    account,
    calls: [{
        abi: erc20Abi,
        functionName: 'transfer',
        args: [
            to, 
            parseUnits(amount, usdcUnits)
        ],
        to: USDC,
    }],
    authorization: authorization
    })
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })
    console.log('Included in tx:', receipt.receipt.transactionHash)
    return receipt.receipt.transactionHash;
}

export async function signUserAuth(): Promise<SignAuthorizationReturnType> {
    const authorization = await walletClient.signAuthorization({ 
        account: owner, 
        contractAddress: process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT as `0x${string}`, 
    })
    return authorization;
}