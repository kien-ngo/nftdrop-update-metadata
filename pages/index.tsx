import { useRef, useState } from "react";
import { BaseContract } from "ethers";
import { SmartContract, ThirdwebSDK } from "@thirdweb-dev/sdk";
import { allChains } from "@thirdweb-dev/chains";
import { ConnectWallet, ThirdwebProvider } from "@thirdweb-dev/react";
// 0xDde615012C5F8E20c1cA96cfE052020E0365bD04
const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;

type LoadedContractInfo = {
  contractAddress: string;
  chainSlug: string;
  instance: SmartContract<BaseContract>
};

export default function Home() {
  const [loadedContract, setLoadedContract] = useState<LoadedContractInfo>();
  const [isLoadingLoadedContract, setIsLoadingContract] = useState(false);
  const loadedContractRef = useRef<HTMLInputElement>(null);
  const loadedChainSlugRef = useRef<HTMLInputElement>(null);
  const chainToDeploy = loadedContract ? allChains.find((item) => item.slug === loadedContract.chainSlug) : undefined;
  const tokenIdRef = useRef<HTMLInputElement>(null);
  const loadContract = async () => {
    const contractAddress = loadedContractRef.current?.value;
    if (!contractAddress) {
      return alert(
        "Please enter the contract address that you locked using our Mitigate tool"
      );
    }
    const chainSlug = loadedChainSlugRef.current?.value;
    if (!chainSlug) {
      return alert(
        "Please enter the network that the locked contract was deployed on"
      );
    }
    try {
      setIsLoadingContract(true);
      const sdk = new ThirdwebSDK(chainSlug, { clientId });
      const contract = await sdk.getContract(contractAddress);
      console.log(contract.abi);
      const isUpdatable = contract.abi.find(item => item.type === "function" && item.name === "updateBatchBaseURI");
      if (!isUpdatable) return alert("This contract does not support method `updateBatchBaseURI`");
      const isErc721 = "erc721" in contract;
      const isErc1155 = "erc1155" in contract;
      if (isErc721) {
        const [
          contractType,
        ] = await Promise.all([
          sdk.resolveContractType(contractAddress),
        ]);
        setLoadedContract({
          contractAddress,
          chainSlug,
          instance: contract
        });
      } else if (isErc1155) {
        alert("ERC1155 contract not supported yet. Stay tuned");
      }
    } catch (err) {
      console.log(err);
      setIsLoadingContract(false);
    }
    setIsLoadingContract(false);
  };
  const loadNeededInfoFromTokenId = async () => {
    if (!loadedContract) return alert("No loaded contract")
    const tokenId = tokenIdRef.current?.value;
    if (!tokenId) return alert("Missing tokenId");
    const contract = loadedContract.instance;
    try {
      const [metadata, _totalCount, tokenURI, _baseURICount] = await Promise.all([
        contract.erc721.get(tokenId),
        contract.erc721.totalCount(),
        contract.call("tokenURI", [tokenId]),
        contract.call("getBaseURICount", [])
      ]);
      const baseURICount = _baseURICount.toNumber();
      const baseURI = tokenURI.replace("ipfs://", "").split("/")[0];
      const totalCount = _totalCount.toNumber();
      const batchIds: number[] = Array.from(
        { length: baseURICount },
        (_, index) => index
      );
      const largestTokenIdEachBatch = ((await Promise.all(batchIds.map(id => contract.call("getBatchIdAtIndex", [id])))).map(item => item.toNumber()));
      const batchIdThatContainsTokenId = largestTokenIdEachBatch.findIndex(item => item >= Number(tokenId));
      const start = batchIdThatContainsTokenId === 0 ? 0 : largestTokenIdEachBatch[batchIdThatContainsTokenId - 1];
      const end = largestTokenIdEachBatch[batchIdThatContainsTokenId]
      const tokenIds: number[] = Array.from({ length: end - start }, (_, index) => index + start);
      console.log({ tokenId, tokenIds, metadata, totalCount, tokenURI, baseURICount, baseURI, largestTokenIdEachBatch, batchIdThatContainsTokenId })

    }
    catch (err) {
      if ((err as any).reason) alert((err as any).reason);
      console.log(err)
    }
  }
  return (
    <>
      <div className="text-black flex flex-col my-20">
        <div className="text-center text-white my-3">
          IMPORTANT: This tool only supports{" "}
          <a
            href="https://thirdweb.com/thirdweb.eth/DropERC721"
            className="text-blue-500 underline"
            target="_blank"
          >
            NFT Drop contracts
          </a>{" "}
          at the moment
        </div>
        <div className="mx-auto lg:w-[600px] flex flex-col gap-5 border rounded p-3">
          <div className="text-white">Step 1: Enter your contract address</div>
          <input
            type="text"
            placeholder="Contract address"
            ref={loadedContractRef}
            className="px-3 py-2"
            defaultValue={"0xDde615012C5F8E20c1cA96cfE052020E0365bD04"}
          />
          <input
            type="text"
            list="network-list"
            placeholder="ethereum"
            className="input input-bordered w-full px-3 py-2"
            ref={loadedChainSlugRef}
            defaultValue={"avalanche-fuji"}
          />
          <datalist id="network-list">
            {allChains.map((item) => (
              <option key={item.chainId} value={item.slug}>
                {item.name}
              </option>
            ))}
          </datalist>

          <div>
            <button
              disabled={isLoadingLoadedContract || Boolean(loadedContract)}
              onClick={loadContract}
              className="bg-white px-3 py-2 flex w-[200px] disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoadingLoadedContract ? (
                <Spinner size={15} />
              ) : (
                <span className="m-auto">
                  {loadedContract ? "Contract loaded" : "Load contract"}
                </span>
              )}
            </button>
          </div>
          {loadedContract && (
            <div className="text-white">
              <hr />
              <div className="mt-3">
                <b className="text-green-500">Contract loaded:</b>{" "}
                <a
                  target="_blank"
                  className="text-blue-500"
                  href={`https://thirdweb.com/${loadedContract.chainSlug}/${loadedContract.contractAddress}`}
                >{`${loadedContract.contractAddress}`}</a>
              </div>
            </div>
          )}

          {loadedContract && (
            <ThirdwebProvider activeChain={chainToDeploy}>
              <div className="">
                <ConnectWallet switchToActiveChain={true} />
              </div>
              <div className="text-white">Select tokenId to update</div>
              <div className="flex flex-row gap-3">
                <input
                  type="number"
                  placeholder="Token Id"
                  min={0}
                  step={1}
                  className="px-3 py-2"
                  ref={tokenIdRef}
                />
                <button className="text-white border px-3" onClick={loadNeededInfoFromTokenId}>Find</button>
              </div>
            </ThirdwebProvider>
          )}
        </div>


      </div>
    </>
  );
}


const Spinner = ({ size }: { size: number }) => {
  return (
    <div role="status" className="m-auto">
      <svg
        height={size}
        width={size}
        aria-hidden="true"
        className="text-black dark:text-white mr-2 h-8 w-8 animate-spin fill-white"
        viewBox="0 0 100 101"
        fill="none"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};