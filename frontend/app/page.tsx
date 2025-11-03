"use client";
import { privateKeyToAccount } from 'viem/accounts'
import { walletClient } from './client'
import { verifyAuthorization } from 'viem/utils'
import { useState } from 'react';
import { SignAuthorizationReturnType } from 'viem';
import {abi, contractAddress} from './contract';

export default function Home() {
    const eoa = privateKeyToAccount('0xd53b4392b771447c330d79dd04ad9fd673cb117e5fe355002ae3d3c3bd04e3ce')
    const [authorization, setAuthorization] = useState<SignAuthorizationReturnType>();

    const verifyAuth = async(authorization: SignAuthorizationReturnType) => {
      const valid = await verifyAuthorization({ 
        address: eoa.address, 
        authorization, 
      })
      return valid;
    }
    const handleSign = async () => {
      console.log('Starting to sign authorization...');
      const authorization = await walletClient.signAuthorization({ 
            account: eoa, 
            contractAddress: contractAddress, 
          })
        try {
          const result = await verifyAuth(authorization);
          if(result) {
            console.log('Authorization verified successfully.');
            const hash = await walletClient.writeContract({
              abi,
              address: contractAddress,
              authorizationList: [authorization],
              //                  ↑ 3. Pass the Authorization as a parameter.
              functionName: 'increment',
            })
            console.log('Authorization signed and contract method called. Tx Hash:', hash);
          } else {
            console.log('Authorization signed:', authorization);
            const hash = await walletClient.sendTransaction({
              authorizationList: [authorization],
              data: '0x',
              to: eoa.address,
            })
            console.log('Authorization signed and transaction sent. Tx Hash:', hash);
          }
        } catch (error) {
            console.error('Failed to sign authorization:', error);
        }
    };

    return (
        <button onClick={handleSign}>
            Sign EIP-7702 Authorization
        </button>
    );
}