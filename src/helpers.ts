import { BigInt, Bytes, ethereum, ipfs, json, log } from '@graphprotocol/graph-ts'
import { Space, ExecutionStrategy } from '../generated/schema'

const TUPLE_PREFIX = '0x0000000000000000000000000000000000000000000000000000000000000020'
const DEPLOY_PROXY_SIGNATURE = '(address,bytes,bytes32)'
const SET_UP_AVATAR_SIGNATURE = 'bytes'
const SET_UP_AVATAR_INIT_PARAMS_SIGNATURE = '(address,address,address[],uint256)'

export function getAvatarQuorum(input: Bytes): BigInt | null {
  let proxyDeployBytes = Bytes.fromByteArray(
    Bytes.fromHexString(TUPLE_PREFIX + input.toHexString().slice(10))
  )
  let proxyDeployArguments = ethereum.decode(DEPLOY_PROXY_SIGNATURE, proxyDeployBytes)
  if (!proxyDeployArguments) return null

  let argsTuple = proxyDeployArguments.toTuple()
  let initializer = argsTuple[1].toBytes()

  let setUpBytes = Bytes.fromByteArray(Bytes.fromHexString(initializer.toHexString().slice(10)))
  let setUpArguments = ethereum.decode(SET_UP_AVATAR_SIGNATURE, setUpBytes)
  if (!setUpArguments) return null

  let initParamsBytes = Bytes.fromByteArray(
    Bytes.fromHexString(
      TUPLE_PREFIX +
        setUpArguments
          .toBytes()
          .toHexString()
          .slice(2)
    )
  )
  let initParams = ethereum.decode(SET_UP_AVATAR_INIT_PARAMS_SIGNATURE, initParamsBytes)
  if (!initParams) return null

  let initParamsTuple = initParams.toTuple()
  let quorum = initParamsTuple[3].toBigInt()

  return quorum
}

export function updateSpaceMetadata(space: Space, metadataUri: string): void {
  if (!metadataUri.startsWith('ipfs://')) return

  let hash = metadataUri.slice(7)
  let data = ipfs.cat(hash)

  let value = json.try_fromBytes(data as Bytes)
  let obj = value.value.toObject()
  let name = obj.get('name')
  let description = obj.get('description')
  let externalUrl = obj.get('external_url')
  let properties = obj.get('properties')

  if (name) space.name = name.toString()
  space.about = description ? description.toString() : ''
  space.external_url = externalUrl ? externalUrl.toString() : ''

  if (properties) {
    const propertiesObj = properties.toObject()

    let github = propertiesObj.get('github')
    let twitter = propertiesObj.get('twitter')
    let discord = propertiesObj.get('discord')
    let wallets = propertiesObj.get('wallets')
    let executionStrategies = propertiesObj.get('executionStrategies')

    space.github = github ? github.toString() : ''
    space.twitter = twitter ? twitter.toString() : ''
    space.discord = discord ? discord.toString() : ''
    space.wallet = wallets && wallets.toArray().length > 0 ? wallets.toArray()[0].toString() : ''

    if (executionStrategies) {
      space.executors = executionStrategies
        .toArray()
        .map<Bytes>((strategy) => Bytes.fromByteArray(Bytes.fromHexString(strategy.toString())))
      space.executors_types = space.executors.map<string>((executor) => {
        let executionStrategy = ExecutionStrategy.load(executor.toHexString())
        if (executionStrategy === null) return 'unknown'

        return executionStrategy.type
      })
    } else {
      space.executors = []
      space.executors_types = []
    }
  } else {
    space.github = ''
    space.twitter = ''
    space.discord = ''
    space.wallet = ''
    space.executors = []
    space.executors_types = []
  }
}
