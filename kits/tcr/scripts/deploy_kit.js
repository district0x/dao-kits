const path = require('path')
const fs = require('fs')

const namehash = require('eth-ens-namehash').hash

const deployDAOFactory = require('@aragon/os/scripts/deploy-daofactory.js')
const logDeploy = require('@aragon/os/scripts/helpers/deploy-logger')

const errorOut = msg => { console.error(msg); process.exit(1) }

const apps = ['curation', 'plcr', 'registry']
const appContracts = ['Curation', 'PLCR', 'RegistryApp']
const appIds = apps.map(app => namehash(`${app}.aragonpm.eth`))

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const defaultOwner = process.env.OWNER
const defaultENSAddress = process.env.ENS
const defaultDAOFactoryAddress = process.env.DAO_FACTORY

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    owner = defaultOwner,
    ensAddress = defaultENSAddress,
    daoFactoryAddress = defaultDAOFactoryAddress,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const kitName = 'TCRKit'
  const kitContractName = kitName

  if (process.argv.length < 5) {
    errorOut('Usage: truffle exec --network <network> scripts/deploy.js')
  }
  // get network
  const network = process.argv[4]
  log(`${kitName} in ${network} network with ENS ${ensAddress}`)

  const kitEnsName = kitName + '.aragonpm.eth'

  const DAOFactory = artifacts.require('DAOFactory')
  const ENS = artifacts.require('ENS')
  const TCRKit = artifacts.require('TCRKit')

  const newRepo = async (apm, name, acc, contract) => {
    log(name, acc, contract)
    log(`Creating Repo for ${contract}`)
    const c = await artifacts.require(contract).new()
    log('Contract Address:', c.address)
    return await apm.newRepoWithVersion(name, acc, [1, 0, 0], c.address, '0x1245')
  }

  let arappFileName
  if (network != 'rpc' && network != 'devnet') {
    arappFileName = 'arapp.json'
  } else {
    arappFileName = 'arapp_local.json'
  }
  if (!ensAddress) {
    const betaArapp = require('../' + arappFileName)
    ensAddress = betaArapp.environments[network].registry
  }

  if (!ensAddress) {
    errorOut('ENS environment variable not passed, aborting.')
  }
  log('Using ENS', ensAddress)
  const ens = ENS.at(ensAddress)

  let daoFactory
  if (daoFactoryAddress) {
    log(`Using provided DAOFactory: ${daoFactoryAddress}`)
    daoFactory = DAOFactory.at(daoFactoryAddress)
  } else {
    daoFactory = (await deployDAOFactory(null, { artifacts, verbose: false })).daoFactory
  }


  const kit = await TCRKit.new(daoFactory.address, ens.address)
  log('TCRKit:', kit.address)
  await logDeploy(kit)

  let staking
  if (network == 'rpc' || network == 'devnet') { // Useful for testing to avoid manual deploys with aragon-dev-cli
    const apmAddr = await artifacts.require('PublicResolver').at(await ens.resolver(namehash('aragonpm.eth'))).addr(namehash('aragonpm.eth'))
    log('APM address', apmAddr)
    const apm = artifacts.require('APMRegistry').at(apmAddr)

    for (let i = 0; i < apps.length; i++) {
      if (await ens.owner(appIds[i]) == '0x0000000000000000000000000000000000000000') {
        await newRepo(apm, apps[i], owner, appContracts[i])
      }
    }
    const tokenObj = require('../../../helpers/test-token-deployer/index.js')
    const tokenAddress = tokenObj[network].tokens[0]
    console.log('tokenAddress', tokenAddress)
    const Staking = artifacts.require('Staking')
    staking = await Staking.new(tokenAddress)

    if (await ens.owner(namehash(kitEnsName)) == '0x0000000000000000000000000000000000000000') {
      log(`creating APM package for ${kitName} at ${kit.address}`)
      await apm.newRepoWithVersion(kitName, owner, [1, 0, 0], kit.address, 'ipfs:')
    } else {
      // TODO: update APM Repo?
    }
  }

  const kitArappPath = path.resolve(".") + "/" + arappFileName
  let arappObj = {}
  if (fs.existsSync(kitArappPath))
    arappObj = require(kitArappPath)
  if (arappObj.environments === undefined)
    arappObj.environments = {}
  if (arappObj.environments[network] === undefined)
    arappObj.environments[network] = {}
  arappObj.environments[network].registry = ens.address
  arappObj.environments[network].appName = kitEnsName
  arappObj.environments[network].address = kit.address
  arappObj.environments[network].network = network
  if (staking !== undefined)
    arappObj.environments[network].staking = staking.address
  if (arappObj.path === undefined)
    arappObj.path = "contracts/" + kitContractName + ".sol"
  const arappFile = JSON.stringify(arappObj, null, 2)
  // could also use https://github.com/yeoman/stringify-object if you wanted single quotes
  fs.writeFileSync(kitArappPath, arappFile)
  log(`Kit addresses saved to ${arappFileName}`)

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return arappObj
  }
}
