import { ethers } from "hardhat";
import {
  deployConstantInitialVoiceCreditProxy,
  deployFreeForAllSignUpGatekeeper,
  deployMaci,
  deployMockVerifier,
  deployPoseidonContracts,
  deployVkRegistry,
  type ConstantInitialVoiceCreditProxy,
  type FreeForAllGatekeeper,
  type MockVerifier,
  type VkRegistry,
} from "maci-contracts";

import type { ContractFactory, Signer } from "ethers";

import { type MACI } from "../typechain-types";

/**
 * An interface that represents argument for deployment test contracts
 */
export interface IDeployedTestContractsArgs {
  initialVoiceCreditBalance: number;
  stateTreeDepth: number;
  signer?: Signer;
  quiet?: boolean;
  gatekeeper?: FreeForAllGatekeeper;
}

/**
 * An interface holding all of the smart contracts part of MACI.
 */
export interface IDeployedTestContracts {
  mockVerifierContract: MockVerifier;
  gatekeeperContract: FreeForAllGatekeeper;
  constantInitialVoiceCreditProxyContract: ConstantInitialVoiceCreditProxy;
  maciContract: MACI;
  vkRegistryContract: VkRegistry;
}

/**
 * Deploy a set of smart contracts that can be used for testing.
 * @param initialVoiceCreditBalance - the initial voice credit balance for each user
 * @param stateTreeDepth - the depth of the state tree
 * @param signer - the signer to use
 * @param quiet - whether to suppress console output
 * @param gatekeeper - the gatekeeper contract to use
 * @returns the deployed contracts
 */
export const deployTestContracts = async ({
  initialVoiceCreditBalance,
  stateTreeDepth,
  signer,
  quiet = true,
  gatekeeper,
}: IDeployedTestContractsArgs): Promise<IDeployedTestContracts> => {
  const mockVerifierContract = await deployMockVerifier(signer, true);

  let gatekeeperContract = gatekeeper;
  if (!gatekeeperContract) {
    gatekeeperContract = await deployFreeForAllSignUpGatekeeper(signer, true);
  }

  const constantInitialVoiceCreditProxyContract = await deployConstantInitialVoiceCreditProxy(
    initialVoiceCreditBalance,
    signer,
    true,
  );

  // VkRegistry
  const vkRegistryContract = await deployVkRegistry(signer, true);
  const [gatekeeperContractAddress, constantInitialVoiceCreditProxyContractAddress] = await Promise.all([
    gatekeeperContract.getAddress(),
    constantInitialVoiceCreditProxyContract.getAddress(),
  ]);

  const { PoseidonT3Contract, PoseidonT4Contract, PoseidonT5Contract, PoseidonT6Contract } =
    await deployPoseidonContracts(signer, {}, quiet);

  const poseidonAddresses = await Promise.all([
    PoseidonT3Contract.getAddress(),
    PoseidonT4Contract.getAddress(),
    PoseidonT5Contract.getAddress(),
    PoseidonT6Contract.getAddress(),
  ]).then(([poseidonT3, poseidonT4, poseidonT5, poseidonT6]) => ({
    poseidonT3,
    poseidonT4,
    poseidonT5,
    poseidonT6,
  }));

  const factories = await Promise.all(
    [
      "contracts/maci/MACI.sol:MACI",
      "contracts/maci/PollFactory.sol:PollFactory",
      "MessageProcessorFactory",
      "TallyFactory",
    ].map((factory) =>
      ethers.getContractFactory(factory, {
        libraries: {
          "maci-contracts/contracts/crypto/PoseidonT3.sol:PoseidonT3": PoseidonT3Contract,
          "maci-contracts/contracts/crypto/PoseidonT4.sol:PoseidonT4": PoseidonT4Contract,
          "maci-contracts/contracts/crypto/PoseidonT5.sol:PoseidonT5": PoseidonT5Contract,
          "maci-contracts/contracts/crypto/PoseidonT6.sol:PoseidonT6": PoseidonT6Contract,
        },
      }),
    ),
  );

  const { maciContract } = await deployMaci({
    signUpTokenGatekeeperContractAddress: gatekeeperContractAddress,
    initialVoiceCreditBalanceAddress: constantInitialVoiceCreditProxyContractAddress,
    signer,
    stateTreeDepth,
    poseidonAddresses,
    factories: factories as [ContractFactory, ContractFactory, ContractFactory, ContractFactory],
    quiet,
  });

  return {
    mockVerifierContract,
    gatekeeperContract,
    constantInitialVoiceCreditProxyContract,
    maciContract: maciContract as MACI,
    vkRegistryContract,
  };
};
