import {
  createWallet,
  listWallets,
  getWallet,
  signMessage,
} from "@open-wallet-standard/core";

export interface OWSWallet {
  id: string;
  name: string;
  accounts: {
    chainId: string;
    address: string;
    derivationPath: string;
  }[];
  createdAt: string;
}

export interface OWSSignature {
  signature: string;
  recoveryId: number;
}

export function getOrCreateWallet(
  name: string,
  password: string
): OWSWallet {
  const wallets = listWallets() as OWSWallet[];
  const existing = wallets.find((w) => w.name === name);
  if (existing) return existing;
  return createWallet(name, password) as OWSWallet;
}

export function getEvmAddress(wallet: OWSWallet): string | null {
  const evm = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  return evm?.address ?? null;
}

export function getEvmChainId(wallet: OWSWallet): string | null {
  const evm = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  return evm?.chainId ?? null;
}

export function getCAIP10(wallet: OWSWallet): string | null {
  const evm = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  if (!evm) return null;
  return `${evm.chainId}:${evm.address}`;
}

export function owsSignMessage(
  walletName: string,
  chainId: string,
  message: string,
  password: string
): OWSSignature {
  const chain = chainId.startsWith("eip155:") ? "evm" : chainId;
  return signMessage(walletName, chain, message, password) as OWSSignature;
}

export function getWalletByName(name: string): OWSWallet | null {
  try {
    return getWallet(name) as OWSWallet;
  } catch {
    return null;
  }
}
