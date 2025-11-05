// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {SimpleAccount} from "@account-abstraction/samples/SimpleAccount.sol";
import {EntryPoint} from "@account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract SimpleAccountScript is Script {
    SimpleAccount public simpleAccount;

    function setUp() public {}

    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        IEntryPoint newEntrypoint = IEntryPoint(vm.envAddress("ENTRY_POINT"));
        vm.startBroadcast(deployerKey);

        simpleAccount = new SimpleAccount(newEntrypoint);

        vm.stopBroadcast();
    }
}
