// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Simple7702Account} from "@account-abstraction/accounts/Simple7702Account.sol";

contract Simple7702AccountScript is Script {
    Simple7702Account public simpleAccount;

    function setUp() public {}

    function run() public {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        simpleAccount = new Simple7702Account();

        vm.stopBroadcast();
    }
}
