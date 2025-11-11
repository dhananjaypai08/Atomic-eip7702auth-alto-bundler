// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {SimpleAccount} from "@account-abstraction/accounts/SimpleAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract SimpleAccountScript is Script {
    SimpleAccount public simpleAccount;

    function setUp() public {}

    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        IEntryPoint newEntry = IEntryPoint(entryPoint);

        vm.startBroadcast(deployerKey);

        simpleAccount = new SimpleAccount(newEntry);

        vm.stopBroadcast();
    }
}
