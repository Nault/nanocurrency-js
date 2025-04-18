/*!
 * nanocurrency-js: A toolkit for the Nano cryptocurrency.
 * Copyright (c) 2019 Marvin ROGER <dev at marvinroger dot fr>
 * Licensed under GPL-3.0 (https://git.io/vAZsK)
 */
import { checkAddress, checkAmount, checkHash, checkKey } from './check'

import { deriveAddress, derivePublicKey } from './keys'

import { unsafeHashBlock } from './hash'

import { signBlock } from './signature'

const BLANK_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000'

export interface CommonBlockData {
  /** The PoW. You can give it a `null` if you want to fill this field later */
  work: string | null
  /** The resulting balance */
  balance: string
  /** The representative address */
  representative: string
}

export interface OpenBlockData {
  /** Open block, previous is `null` */
  previous: null
  /** Open block, link is the pairing send block hash, in hexadecimal format */
  link: string
}

export interface ChangeBlockData {
  /** Change block, previous is the hash of the previous block on the account chain, in hexadecimal format */
  previous: string
  /** Change block, link is `null` */
  link: null
}

export interface SendBlockData {
  /** Send block, previous is the hash of the previous block on the account chain, in hexadecimal format */
  previous: string
  /** Send block, link is the destination address, in address format */
  link: string
}

export interface ReceiveBlockData {
  /** Receive block, previous is the hash of the previous block on the account chain, in hexadecimal format */
  previous: string
  /** Receive block, link is the pairing send block hash, in hexadecimal format */
  link: string
}

/** State block data. */
export type BlockData = CommonBlockData &
  (OpenBlockData | ChangeBlockData | SendBlockData | ReceiveBlockData)

/** State block representation. */
export interface BlockRepresentation {
  type: 'state'
  account: string
  previous: string
  representative: string
  balance: string
  link: string
  link_as_account: string
  work: string | null
  signature: string
}

/** State block. */
export interface Block {
  /** The block hash */
  hash: string
  /** The block representation */
  block: BlockRepresentation
}

/** Block params. */
export interface BlockParams {
  /** Whether to use nano_ instead of xrb_ */
  useNanoPrefix?: boolean
  /** Whether to use ban_ instead of xrb_ */
  useBananoPrefix?: boolean
}

/**
 * Create a state block.
 *
 * @param secretKey - The secret key to create the block from, in hexadecimal format
 * @param data - Block data
 * @param BlockParams - Optional block settings
 * @returns Block
 */
export function createBlock(secretKey: string, data: BlockData, params: BlockParams = {}): Block {
  if (!checkKey(secretKey)) throw new Error('Secret key is not valid')
  if (typeof data.work === 'undefined') throw new Error('Work is not set')
  if (!checkAddress(data.representative)) {
    throw new Error('Representative is not valid')
  }
  if (!checkAmount(data.balance)) throw new Error('Balance is not valid')

  let correctedPrevious: string
  if (data.previous === null) {
    correctedPrevious = BLANK_HASH
  } else {
    correctedPrevious = data.previous
    if (!checkHash(correctedPrevious)) throw new Error('Previous is not valid')
  }

  let linkIsAddress = false
  let correctedLink: string
  if (data.link === null) {
    correctedLink = BLANK_HASH
  } else {
    correctedLink = data.link
    if (checkAddress(correctedLink)) linkIsAddress = true
    else if (!checkHash(correctedLink)) throw new Error('Link is not valid')
  }

  /*
    Here, we've checked the inputs and replaced `null` by the blank hash
    Now let's check that inputs are correct blocks.

    > Valid blocks

    Type: previous, link

    Open: null, hash
    Receive: hash, hash
    Send: hash, address
    Change: hash, null

    > Invalid combinations

    null, address
    null, null
  */

  if (
    correctedPrevious === BLANK_HASH &&
    (linkIsAddress || correctedLink === BLANK_HASH)
  ) {
    throw new Error('Block is impossible')
  }

  const publicKey = derivePublicKey(secretKey)
  const account = (params.useNanoPrefix === true) ? deriveAddress(publicKey,{useNanoPrefix:true}) : (params.useBananoPrefix === true) ? deriveAddress(publicKey,{useBananoPrefix:true}) : deriveAddress(publicKey)
  // we use unsafeHashBlock because we already
  // checked the input
  const hash = unsafeHashBlock({
    account,
    previous: correctedPrevious,
    representative: data.representative,
    balance: data.balance,
    link: correctedLink,
  })
  const signature = signBlock({ hash, secretKey })

  let link
  let linkAsAddress
  if (linkIsAddress) {
    linkAsAddress = correctedLink
    link = derivePublicKey(linkAsAddress)
  } else {
    link = correctedLink
    linkAsAddress = deriveAddress(link)
  }

  const block: BlockRepresentation = {
    type: 'state',
    account,
    previous: correctedPrevious,
    representative: data.representative,
    balance: data.balance,
    link,
    // eslint-disable-next-line @typescript-eslint/camelcase
    link_as_account: linkAsAddress,
    work: data.work,
    signature,
  }

  return {
    hash,
    block,
  }
}
