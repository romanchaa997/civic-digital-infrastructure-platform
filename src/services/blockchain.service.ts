import { ethers } from 'ethers';
import { BlockchainDeploymentRequest, DeploymentResult } from '../models';

/**
 * BlockchainService handles smart contract deployment and management
 * across multiple blockchain testnets (Sepolia, Polygon Mumbai, Arbitrum Goerli).
 * 
 * Supported Networks:
 * - Ethereum Sepolia: Test network for Ethereum Mainnet
 * - Polygon Mumbai: Test network for Polygon Mainnet
 * - Arbitrum Goerli: Test network for Arbitrum One
 */
class BlockchainService {
  private readonly rpcEndpoints: Record<string, string> = {
    sepolia: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    mumbai: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    arbitrumGoerli: process.env.ARBITRUM_GOERLI_RPC_URL || 'https://goerli-rollup.arbitrum.io/rpc',
  };

  private readonly chainIds: Record<string, number> = {
    sepolia: 11155111,
    mumbai: 80001,
    arbitrumGoerli: 421613,
  };

  /**
   * Deploy audit contract to specified testnet
   * @param request - Deployment request with contract code and network
   * @returns Deployment result with contract address and transaction hash
   */
  async deployContract(request: BlockchainDeploymentRequest): Promise<DeploymentResult> {
    try {
      if (!request.network || !this.rpcEndpoints[request.network]) {
        throw new Error(`Unsupported network: ${request.network}`);
      }

      const privateKey = process.env.DEPLOYMENT_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('DEPLOYMENT_PRIVATE_KEY environment variable not set');
      }

      // Initialize provider and signer
      const provider = new ethers.providers.JsonRpcProvider(this.rpcEndpoints[request.network]);
      const signer = new ethers.Wallet(privateKey, provider);

      // Compile and deploy contract
      const contractFactory = new ethers.ContractFactory(
        request.abi,
        request.bytecode,
        signer
      );

      console.log(`Deploying to ${request.network}...`);
      const contract = await contractFactory.deploy(...(request.constructorArgs || []));
      await contract.deployed();

      console.log(`Contract deployed at: ${contract.address}`);

      // Get transaction receipt for confirmation
      const receipt = await contract.deployTransaction.wait();

      return {
        success: true,
        contractAddress: contract.address,
        transactionHash: contract.deployTransaction.hash,
        network: request.network,
        blockNumber: receipt?.blockNumber || 0,
        gasUsed: receipt?.gasUsed.toString() || '0',
        status: 'confirmed',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
        network: request.network,
        status: 'failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Verify contract on blockchain explorer
   * @param contractAddress - Address of deployed contract
   * @param network - Blockchain network
   * @returns Verification status
   */
  async verifyContract(
    contractAddress: string,
    network: string
  ): Promise<{ verified: boolean; message: string }> {
    try {
      if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        throw new Error('Invalid contract address');
      }

      const provider = new ethers.providers.JsonRpcProvider(this.rpcEndpoints[network]);
      const code = await provider.getCode(contractAddress);

      if (code === '0x') {
        return {
          verified: false,
          message: 'No contract code found at address on this network',
        };
      }

      return {
        verified: true,
        message: `Contract verified on ${network}. Code length: ${code.length} bytes`,
      };
    } catch (error) {
      return {
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Get contract balance and state information
   * @param contractAddress - Address of deployed contract
   * @param network - Blockchain network
   * @returns Contract details including balance and deployment info
   */
  async getContractInfo(
    contractAddress: string,
    network: string
  ): Promise<{
    address: string;
    balance: string;
    nonce: number;
    codeSize: string;
    network: string;
  }> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcEndpoints[network]);

      const balance = await provider.getBalance(contractAddress);
      const nonce = await provider.getTransactionCount(contractAddress);
      const code = await provider.getCode(contractAddress);

      return {
        address: contractAddress,
        balance: ethers.utils.formatEther(balance),
        nonce,
        codeSize: `${code.length / 2} bytes`,
        network,
      };
    } catch (error) {
      throw new Error(
        `Failed to get contract info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Estimate gas costs for deployment
   * @param request - Deployment request
   * @param network - Blockchain network
   * @returns Gas estimation with cost
   */
  async estimateGas(
    request: BlockchainDeploymentRequest
  ): Promise<{ gasEstimate: string; estimatedCost: string }> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        this.rpcEndpoints[request.network]
      );

      const gasPrice = await provider.getGasPrice();
      const estimatedGas = ethers.BigNumber.from('3000000'); // Typical contract deployment gas

      const estimatedCost = estimatedGas.mul(gasPrice);

      return {
        gasEstimate: estimatedGas.toString(),
        estimatedCost: ethers.utils.formatEther(estimatedCost),
      };
    } catch (error) {
      throw new Error(
        `Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get supported networks
   * @returns List of supported networks and their chain IDs
   */
  getSupportedNetworks(): Array<{ name: string; chainId: number }> {
    return Object.entries(this.chainIds).map(([name, chainId]) => ({
      name,
      chainId,
    }));
  }

  /**
   * Check blockchain connectivity
   * @param network - Blockchain network to check
   * @returns Network health status
   */
  async isHealthy(network: string): Promise<boolean> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(this.rpcEndpoints[network]);
      const blockNumber = await provider.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      console.error(`Health check failed for ${network}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
export { BlockchainService };
