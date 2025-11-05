// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {EntryPoint} from "@account-abstraction/core/EntryPoint.sol";

contract DeployEntryPoint is Script {
    EntryPoint public entryPoint;

    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        entryPoint = new EntryPoint();

        vm.stopBroadcast();
    }
}
