import { renderStaticWaves } from './oceanWaves'

// https://docs.opensea.io/docs/metadata-standards
export interface NftOptions {
  name: string
  symbol: string
  description: string
  image?: string
  /* eslint-disable camelcase */
  external_url?: string
  image_data?: string
  background_color?: string
  /* eslint-enable camelcase */
}

function encodeSvg(svgString: string): string {
  return svgString
    .replace(
      '<svg',
      ~svgString.indexOf('xmlns')
        ? '<svg'
        : '<svg xmlns="http://www.w3.org/2000/svg"'
    )
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\s+/g, ' ')
}

export function generateNftOptions(): NftOptions {
  // TODO: crop image properly in the end as generated SVG waves are a super-wide image,
  // and add a filled background deciding on either black or white.
  const image = renderStaticWaves()
  // const image = new XMLSerializer().serializeToString(waves)
  // const image = `<svg><path d="M0 10.4304L16.3396 10.4304L8.88727 17.6833L10.2401 19L20 9.5L10.2401 0L8.88727 1.31491L16.3396 8.56959L0 8.56959V10.4304Z" /></svg>`

  const newNft: NftOptions = {
    name: 'Ocean Asset v4 NFT',
    symbol: 'OCEAN-V4-NFT',
    description: `This NFT represents an asset in the Ocean Protocol v4 ecosystem.`,
    // TODO: ideally this includes the final DID
    external_url: 'https://market.oceanprotocol.com',
    background_color: '141414', // dark background
    // TODO: figure out if also image URI needs base64 encoding
    // generated SVG embedded as 'data:image/svg+xml' and encoded characters
    image_data: `data:image/svg+xml,${encodeSvg(image)}`
    // generated SVG embedded as 'data:image/svg+xml;base64'
    // image: `data:image/svg+xml;base64,${window?.btoa(image)}`
    // image: `data:image/svg+xml;base64,${Buffer.from(image).toString('base64')}`
  }

  return newNft
}

export function generateNftCreateData(nftOptions: NftOptions): any {
  const nftCreateData = {
    name: nftOptions.name,
    symbol: nftOptions.symbol,
    templateIndex: 1,
    // TODO: figure out if Buffer.from method is working in browser in final build
    // as BTOA is deprecated.
    tokenURI: window?.btoa(JSON.stringify(nftOptions))
    // tokenURI: Buffer.from(JSON.stringify(nftOptions)).toString('base64') // should end up as data:application/json;base64
  }

  return nftCreateData
}
